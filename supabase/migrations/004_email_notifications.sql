-- ============================================================
-- EGC Covoiturage — Notifications email via pg_net + Resend
-- ============================================================
-- Prérequis :
--   1. Activer l'extension pg_net dans Supabase :
--      Dashboard → Settings → Database → Extensions → pg_net ✓
--   2. Créer un compte Resend gratuit (resend.com) → récupérer l'API key
--   3. Exécuter ce SQL pour stocker la clé :
--        UPDATE app_settings SET value = 'YOUR_RESEND_API_KEY' WHERE key = 'resend_api_key';
--        UPDATE app_settings SET value = 'noreply@votredomaine.fr' WHERE key = 'email_from';
-- ============================================================

-- Ajouter les paramètres email dans app_settings
INSERT INTO app_settings (key, value) VALUES
  ('resend_api_key', 'REMPLACER_PAR_VOTRE_CLE_RESEND'),
  ('email_from',     'EGC Covoiturage <noreply@egc.fr>')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Fonction utilitaire : envoi d'un email via Resend + pg_net
-- ============================================================

CREATE OR REPLACE FUNCTION send_email(
  p_to      TEXT,
  p_subject TEXT,
  p_html    TEXT
) RETURNS VOID AS $$
DECLARE
  v_api_key TEXT;
  v_from    TEXT;
BEGIN
  SELECT value INTO v_api_key FROM app_settings WHERE key = 'resend_api_key';
  SELECT value INTO v_from    FROM app_settings WHERE key = 'email_from';

  -- Ne pas envoyer si l'adresse est interne (licencié sans email perso)
  IF p_to IS NULL OR p_to = '' OR p_to LIKE '%@egc.internal' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object(
      'from',    v_from,
      'to',      ARRAY[p_to],
      'subject', p_subject,
      'html',    p_html
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'opération principale si l'email échoue
  RAISE WARNING 'Email non envoyé à % : %', p_to, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger : email au conducteur lors d'une nouvelle réservation
-- ============================================================

CREATE OR REPLACE FUNCTION email_notify_booking_request()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_email    TEXT;
  v_driver_name     TEXT;
  v_passenger_name  TEXT;
  v_trip_departure  TEXT;
  v_trip_arrival    TEXT;
  v_trip_date       TEXT;
BEGIN
  IF NEW.status = 'en_attente' AND TG_OP = 'INSERT' THEN

    SELECT
      u.email,
      CONCAT(u.first_name, ' ', u.last_name)
    INTO v_driver_email, v_driver_name
    FROM trips t JOIN users u ON u.id = t.driver_id
    WHERE t.id = NEW.trip_id;

    SELECT CONCAT(first_name, ' ', last_name) INTO v_passenger_name
    FROM users WHERE id = NEW.passenger_id;

    SELECT
      departure_address,
      arrival_address,
      TO_CHAR(departure_time, 'DD/MM/YYYY à HH24:MI')
    INTO v_trip_departure, v_trip_arrival, v_trip_date
    FROM trips WHERE id = NEW.trip_id;

    PERFORM send_email(
      v_driver_email,
      '🚗 Nouvelle demande de covoiturage — EGC',
      '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">'
      || '<h2 style="color:#1A56DB">Nouvelle demande de covoiturage</h2>'
      || '<p>Bonjour ' || v_driver_name || ',</p>'
      || '<p><strong>' || v_passenger_name || '</strong> demande une place dans votre trajet :</p>'
      || '<table style="border-collapse:collapse;width:100%">'
      || '<tr><td style="padding:8px;border:1px solid #eee"><strong>Départ</strong></td><td style="padding:8px;border:1px solid #eee">' || v_trip_departure || '</td></tr>'
      || '<tr><td style="padding:8px;border:1px solid #eee"><strong>Arrivée</strong></td><td style="padding:8px;border:1px solid #eee">' || v_trip_arrival || '</td></tr>'
      || '<tr><td style="padding:8px;border:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border:1px solid #eee">' || v_trip_date || '</td></tr>'
      || '</table>'
      || '<p>Ouvrez l''application EGC Covoiturage pour accepter ou refuser.</p>'
      || '<hr style="margin-top:32px"><p style="color:#999;font-size:12px">EGC Covoiturage — Application réservée aux membres du club</p>'
      || '</div>'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_email_booking_request
AFTER INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION email_notify_booking_request();

-- ============================================================
-- Trigger : email au conducteur lors d'une annulation passager
-- ============================================================

CREATE OR REPLACE FUNCTION email_notify_booking_cancelled()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_email    TEXT;
  v_driver_name     TEXT;
  v_passenger_name  TEXT;
  v_trip_departure  TEXT;
  v_trip_date       TEXT;
BEGIN
  IF NEW.status = 'annule' AND OLD.status IN ('en_attente', 'accepte') THEN

    SELECT
      u.email,
      CONCAT(u.first_name, ' ', u.last_name)
    INTO v_driver_email, v_driver_name
    FROM trips t JOIN users u ON u.id = t.driver_id
    WHERE t.id = NEW.trip_id;

    SELECT CONCAT(first_name, ' ', last_name) INTO v_passenger_name
    FROM users WHERE id = NEW.passenger_id;

    SELECT
      departure_address,
      TO_CHAR(departure_time, 'DD/MM/YYYY à HH24:MI')
    INTO v_trip_departure, v_trip_date
    FROM trips WHERE id = NEW.trip_id;

    PERFORM send_email(
      v_driver_email,
      '❌ Annulation de réservation — EGC',
      '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">'
      || '<h2 style="color:#EF4444">Annulation de réservation</h2>'
      || '<p>Bonjour ' || v_driver_name || ',</p>'
      || '<p><strong>' || v_passenger_name || '</strong> a annulé sa réservation pour le trajet :</p>'
      || '<table style="border-collapse:collapse;width:100%">'
      || '<tr><td style="padding:8px;border:1px solid #eee"><strong>Départ</strong></td><td style="padding:8px;border:1px solid #eee">' || v_trip_departure || '</td></tr>'
      || '<tr><td style="padding:8px;border:1px solid #eee"><strong>Date</strong></td><td style="padding:8px;border:1px solid #eee">' || v_trip_date || '</td></tr>'
      || '</table>'
      || '<p>Une place s''est libérée dans votre trajet.</p>'
      || '<hr style="margin-top:32px"><p style="color:#999;font-size:12px">EGC Covoiturage — Application réservée aux membres du club</p>'
      || '</div>'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_email_booking_cancelled
AFTER UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION email_notify_booking_cancelled();
