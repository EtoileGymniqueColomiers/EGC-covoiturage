-- ============================================================
-- EGC Covoiturage — Fonctions et Triggers
-- Logique métier côté base de données (zéro serveur custom)
-- ============================================================

-- ============================================================
-- Trigger 1 : Mettre à jour booked_seats sur les bookings
-- ============================================================

CREATE OR REPLACE FUNCTION update_trip_booked_seats()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcule le nombre de places réservées (acceptées uniquement)
  UPDATE trips SET
    booked_seats = (
      SELECT COALESCE(SUM(seats_requested), 0)
      FROM bookings
      WHERE trip_id = COALESCE(NEW.trip_id, OLD.trip_id)
        AND status = 'accepte'
    ),
    status = CASE
      WHEN (
        SELECT COALESCE(SUM(seats_requested), 0)
        FROM bookings
        WHERE trip_id = COALESCE(NEW.trip_id, OLD.trip_id)
          AND status = 'accepte'
      ) >= available_seats THEN 'complet'::trip_status
      ELSE 'actif'::trip_status
    END
  WHERE id = COALESCE(NEW.trip_id, OLD.trip_id)
    AND status != 'annule';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_booking_seats
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_trip_booked_seats();

-- ============================================================
-- Trigger 2 : Insérer une notification lors d'une demande de réservation
-- ============================================================

CREATE OR REPLACE FUNCTION notify_booking_request()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_id UUID;
  v_passenger_name TEXT;
  v_trip_departure TEXT;
BEGIN
  IF NEW.status = 'en_attente' AND (TG_OP = 'INSERT' OR OLD.status != 'en_attente') THEN
    -- Récupérer l'ID du conducteur
    SELECT driver_id INTO v_driver_id FROM trips WHERE id = NEW.trip_id;

    -- Récupérer le nom du passager
    SELECT CONCAT(first_name, ' ', last_name) INTO v_passenger_name
    FROM users WHERE id = NEW.passenger_id;

    -- Récupérer l'adresse de départ (courte)
    SELECT LEFT(departure_address, 30) INTO v_trip_departure
    FROM trips WHERE id = NEW.trip_id;

    -- Insérer la notification pour le conducteur
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_driver_id,
      'booking_request',
      'Nouvelle demande de place',
      v_passenger_name || ' demande une place pour ' || v_trip_departure || '...',
      jsonb_build_object('booking_id', NEW.id, 'trip_id', NEW.trip_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_booking_request
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION notify_booking_request();

-- ============================================================
-- Trigger 3 : Notification lors de la réponse du conducteur
-- ============================================================

CREATE OR REPLACE FUNCTION notify_booking_response()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_name TEXT;
  v_trip_departure TEXT;
BEGIN
  IF NEW.status IN ('accepte', 'refuse') AND OLD.status = 'en_attente' THEN
    SELECT CONCAT(u.first_name, ' ', u.last_name) INTO v_driver_name
    FROM trips t JOIN users u ON u.id = t.driver_id
    WHERE t.id = NEW.trip_id;

    SELECT LEFT(departure_address, 30) INTO v_trip_departure
    FROM trips WHERE id = NEW.trip_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.passenger_id,
      'booking_' || NEW.status,
      CASE NEW.status
        WHEN 'accepte' THEN 'Réservation confirmée !'
        ELSE 'Réservation refusée'
      END,
      CASE NEW.status
        WHEN 'accepte' THEN v_driver_name || ' a accepté votre demande pour ' || v_trip_departure || '...'
        ELSE v_driver_name || ' ne peut pas vous prendre pour ' || v_trip_departure || '...'
      END,
      jsonb_build_object('booking_id', NEW.id, 'trip_id', NEW.trip_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_booking_response
AFTER UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION notify_booking_response();

-- ============================================================
-- Trigger 4 : Notification de nouveau message
-- ============================================================

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
BEGIN
  -- Déterminer le destinataire (l'autre participant)
  SELECT
    CASE WHEN c.user_a_id = NEW.sender_id THEN c.user_b_id ELSE c.user_a_id END
  INTO v_recipient_id
  FROM conversations c WHERE c.id = NEW.conversation_id;

  SELECT CONCAT(first_name, ' ', last_name) INTO v_sender_name
  FROM users WHERE id = NEW.sender_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_recipient_id,
    'new_message',
    v_sender_name,
    LEFT(NEW.content, 80),
    jsonb_build_object('conversation_id', NEW.conversation_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_new_message();

-- ============================================================
-- Trigger 5 : Mise à jour de updated_at sur bookings
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Fonction : créer un compte licencié (appelée par l'admin)
-- ============================================================

CREATE OR REPLACE FUNCTION create_licencie(
  p_license_number TEXT,
  p_birthdate      TEXT,   -- format YYYY-MM-DD
  p_first_name     TEXT DEFAULT NULL,
  p_last_name      TEXT DEFAULT NULL,
  p_group_id       UUID   DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  v_email := LOWER(TRIM(p_license_number)) || '@egc.internal';

  INSERT INTO users (role, license_number, email, first_name, last_name, group_id, profile_complete)
  VALUES ('licencie', p_license_number, v_email, p_first_name, p_last_name, p_group_id, false)
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fonction : suggestions de trajets compatibles (matching)
-- ============================================================

CREATE OR REPLACE FUNCTION suggest_trips_for_user(p_user_id UUID)
RETURNS TABLE (
  trip_id      UUID,
  score        NUMERIC,
  score_detail JSONB
) AS $$
DECLARE
  v_group_id UUID;
  v_lat      DECIMAL;
  v_lng      DECIMAL;
BEGIN
  SELECT group_id, lat, lng INTO v_group_id, v_lat, v_lng
  FROM users WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    t.id AS trip_id,
    -- Score composite (sur 100)
    (
      -- Même groupe : +40 points
      CASE WHEN t.group_id = v_group_id THEN 40 ELSE 0 END
      +
      -- Proximité géographique (si coordonnées disponibles) : jusqu'à 30 points
      CASE
        WHEN v_lat IS NOT NULL AND t.departure_lat IS NOT NULL THEN
          GREATEST(0, 30 - (
            SQRT(POWER(t.departure_lat - v_lat, 2) + POWER(t.departure_lng - v_lng, 2)) * 111
          )::INT * 5)
        ELSE 0
      END
      +
      -- Trajet dans les 7 prochains jours : +20 points
      CASE WHEN t.departure_time BETWEEN now() AND now() + INTERVAL '7 days' THEN 20 ELSE 0 END
      +
      -- Places disponibles : +10 points
      CASE WHEN t.available_seats - t.booked_seats > 0 THEN 10 ELSE 0 END
    )::NUMERIC AS score,
    jsonb_build_object(
      'same_group',  t.group_id = v_group_id,
      'seats_left',  t.available_seats - t.booked_seats
    ) AS score_detail
  FROM trips t
  WHERE t.status = 'actif'
    AND t.departure_time > now()
    AND t.driver_id != p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.trip_id = t.id AND b.passenger_id = p_user_id AND b.status != 'annule'
    )
  ORDER BY score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
