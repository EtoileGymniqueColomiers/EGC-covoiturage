-- Combined migrations for manual SQL Editor run
-- Generated 2026-10-01T08:48:44Z
BEGIN;

-- ============================================================
-- FILE: supabase/migrations/001_initial_schema.sql
-- ============================================================
-- ============================================================
-- EGC Covoiturage — Schéma initial
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Enumerations
-- ============================================================

CREATE TYPE user_role     AS ENUM ('licencie', 'parent', 'encadrant', 'admin');
CREATE TYPE trip_type     AS ENUM ('regulier', 'ponctuel', 'evenement');
CREATE TYPE trip_status   AS ENUM ('actif', 'complet', 'annule', 'termine');
CREATE TYPE trip_direction AS ENUM ('aller', 'retour');
CREATE TYPE booking_status AS ENUM ('en_attente', 'accepte', 'refuse', 'annule');

-- ============================================================
-- Groupes d'entraînement
-- ============================================================

CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  schedule    JSONB DEFAULT '[]',   -- [{"day": "lundi", "time": "18:00"}, ...]
  coach_name  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Événements / Compétitions
-- ============================================================

CREATE TABLE events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  event_date         DATE NOT NULL,
  end_date           DATE,                   -- null = événement sur 1 jour
  is_multi_day       BOOLEAN DEFAULT false,
  location           TEXT NOT NULL,
  lat                DECIMAL(9, 6),
  lng                DECIMAL(9, 6),
  description        TEXT,
  accommodation_note TEXT,                   -- infos hébergement si nuitée
  created_by         UUID,                   -- admin
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Utilisateurs
-- ============================================================

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id          UUID UNIQUE,              -- lié à auth.users de Supabase
  role             user_role NOT NULL,
  license_number   TEXT UNIQUE,             -- licenciés uniquement
  email            TEXT UNIQUE,
  first_name       TEXT,
  last_name        TEXT,
  phone            TEXT,
  address          TEXT,
  lat              DECIMAL(9, 6),
  lng              DECIMAL(9, 6),
  group_id         UUID REFERENCES groups(id) ON DELETE SET NULL,
  car_capacity     SMALLINT DEFAULT 0,      -- 0 = pas de voiture
  is_active        BOOLEAN DEFAULT true,
  profile_complete BOOLEAN DEFAULT false,
  push_token       TEXT,                    -- token Expo Push Notifications
  created_at       TIMESTAMPTZ DEFAULT now(),
  suspended_at     TIMESTAMPTZ,
  suspended_reason TEXT
);

-- ============================================================
-- Relation Parent ↔ Enfant licencié
-- ============================================================

CREATE TABLE parent_child (
  parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
  child_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  validated BOOLEAN DEFAULT false,
  PRIMARY KEY (parent_id, child_id)
);

-- ============================================================
-- Trajets
-- ============================================================

CREATE TABLE trips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id          UUID REFERENCES events(id) ON DELETE SET NULL,
  type              trip_type NOT NULL,
  direction         trip_direction,          -- null pour trajets non liés à un événement
  status            trip_status DEFAULT 'actif',
  departure_address TEXT NOT NULL,
  departure_lat     DECIMAL(9, 6),
  departure_lng     DECIMAL(9, 6),
  arrival_address   TEXT NOT NULL,
  arrival_lat       DECIMAL(9, 6),
  arrival_lng       DECIMAL(9, 6),
  departure_time    TIMESTAMPTZ NOT NULL,
  available_seats   SMALLINT NOT NULL CHECK (available_seats >= 1 AND available_seats <= 9),
  booked_seats      SMALLINT DEFAULT 0,
  comment           TEXT,
  recurrence_rule   TEXT,                   -- iCal RRULE pour trajets réguliers
  group_id          UUID REFERENCES groups(id) ON DELETE SET NULL,
  intermediate_stop TEXT,
  is_offer          BOOLEAN DEFAULT true,   -- true = offre, false = demande
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Réservations
-- ============================================================

CREATE TABLE bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  passenger_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           booking_status DEFAULT 'en_attente',
  seats_requested  SMALLINT DEFAULT 1,
  message          TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (trip_id, passenger_id)
);

-- ============================================================
-- Conversations
-- ============================================================

CREATE TABLE conversations (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id   UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (trip_id, user_a_id, user_b_id)
);

-- ============================================================
-- Messages
-- ============================================================

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Notifications
-- ============================================================

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  data       JSONB,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Audit log admin
-- ============================================================

CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Configuration globale de l'application
-- ============================================================

CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Valeurs par défaut à adapter
INSERT INTO app_settings (key, value) VALUES
  ('club_name',    'EGC'),
  ('club_address', 'Adresse du club à renseigner'),
  ('club_lat',     '0'),
  ('club_lng',     '0'),
  ('club_phone',   ''),
  ('club_email',   '');

-- ============================================================
-- Index de performance
-- ============================================================

CREATE INDEX idx_users_auth_id        ON users(auth_id);
CREATE INDEX idx_users_license        ON users(license_number);
CREATE INDEX idx_users_group          ON users(group_id);
CREATE INDEX idx_trips_departure_time ON trips(departure_time);
CREATE INDEX idx_trips_driver         ON trips(driver_id);
CREATE INDEX idx_trips_event          ON trips(event_id);
CREATE INDEX idx_trips_group          ON trips(group_id);
CREATE INDEX idx_trips_status         ON trips(status);
CREATE INDEX idx_bookings_passenger   ON bookings(passenger_id);
CREATE INDEX idx_bookings_trip        ON bookings(trip_id);
CREATE INDEX idx_messages_conv        ON messages(conversation_id, created_at);
CREATE INDEX idx_notifications_user   ON notifications(user_id, created_at);
CREATE INDEX idx_conversations_a      ON conversations(user_a_id);
CREATE INDEX idx_conversations_b      ON conversations(user_b_id);


-- ============================================================
-- FILE: supabase/migrations/002_rls_policies.sql
-- ============================================================
-- ============================================================
-- EGC Covoiturage — Row Level Security (RLS)
-- Chaque utilisateur ne voit que ce à quoi il a droit.
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Fonction utilitaire : récupère le profil de l'utilisateur courant
-- ============================================================

CREATE OR REPLACE FUNCTION current_user_profile()
RETURNS users AS $$
  SELECT * FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- USERS
-- ============================================================

-- Lecture : chaque membre voit les profils des autres membres actifs (pour afficher conducteur, etc.)
CREATE POLICY "users_select_members" ON users
  FOR SELECT USING (
    is_active = true
    AND (current_user_id() IS NOT NULL OR is_admin())
  );

-- Lecture complète pour les admins
CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (is_admin());

-- Mise à jour : uniquement son propre profil
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth_id = auth.uid());

-- Insertion : uniquement par les admins (création de licenciés)
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (is_admin());

-- Suppression : uniquement par les admins
CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (is_admin());

-- ============================================================
-- GROUPS
-- ============================================================

-- Lecture : tous les membres connectés
CREATE POLICY "groups_select_members" ON groups
  FOR SELECT USING (current_user_id() IS NOT NULL);

-- Écriture : admins uniquement
CREATE POLICY "groups_write_admin" ON groups
  FOR ALL USING (is_admin());

-- ============================================================
-- EVENTS
-- ============================================================

-- Lecture : tous les membres
CREATE POLICY "events_select_members" ON events
  FOR SELECT USING (current_user_id() IS NOT NULL);

-- Écriture : admins uniquement
CREATE POLICY "events_write_admin" ON events
  FOR ALL USING (is_admin());

-- ============================================================
-- TRIPS
-- ============================================================

-- Lecture : tous les membres actifs voient les trajets actifs
CREATE POLICY "trips_select_members" ON trips
  FOR SELECT USING (
    current_user_id() IS NOT NULL
    AND (status = 'actif' OR driver_id = current_user_id() OR is_admin())
  );

-- Création : tout membre avec une voiture (car_capacity > 0)
CREATE POLICY "trips_insert_driver" ON trips
  FOR INSERT WITH CHECK (
    driver_id = current_user_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = current_user_id() AND car_capacity > 0)
  );

-- Mise à jour : uniquement par le conducteur ou admin
CREATE POLICY "trips_update_driver" ON trips
  FOR UPDATE USING (driver_id = current_user_id() OR is_admin());

-- Suppression : admin uniquement
CREATE POLICY "trips_delete_admin" ON trips
  FOR DELETE USING (is_admin());

-- ============================================================
-- BOOKINGS
-- ============================================================

-- Lecture : passager concerné ou conducteur du trajet ou admin
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT USING (
    passenger_id = current_user_id()
    OR EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND driver_id = current_user_id())
    OR is_admin()
  );

-- Création : tout membre peut réserver (pas son propre trajet)
CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT WITH CHECK (
    passenger_id = current_user_id()
    AND NOT EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND driver_id = current_user_id())
  );

-- Mise à jour : passager (annulation) ou conducteur (acceptation/refus) ou admin
CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE USING (
    passenger_id = current_user_id()
    OR EXISTS (SELECT 1 FROM trips WHERE id = trip_id AND driver_id = current_user_id())
    OR is_admin()
  );

-- ============================================================
-- CONVERSATIONS
-- ============================================================

-- Lecture/écriture : uniquement les participants
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    user_a_id = current_user_id() OR user_b_id = current_user_id() OR is_admin()
  );

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (
    user_a_id = current_user_id() OR user_b_id = current_user_id()
  );

-- ============================================================
-- MESSAGES
-- ============================================================

-- Lecture : participants à la conversation
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (user_a_id = current_user_id() OR user_b_id = current_user_id())
    )
    OR is_admin()
  );

-- Envoi : uniquement l'expéditeur, participant à la conversation
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = current_user_id()
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (user_a_id = current_user_id() OR user_b_id = current_user_id())
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = current_user_id());

-- Insertion via service role uniquement (triggers)
CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- PARENT_CHILD
-- ============================================================

CREATE POLICY "parent_child_select" ON parent_child
  FOR SELECT USING (
    parent_id = current_user_id() OR child_id = current_user_id() OR is_admin()
  );

CREATE POLICY "parent_child_insert" ON parent_child
  FOR INSERT WITH CHECK (parent_id = current_user_id());

-- Validation uniquement par admin
CREATE POLICY "parent_child_update_admin" ON parent_child
  FOR UPDATE USING (is_admin());

-- ============================================================
-- ADMIN_AUDIT_LOG
-- ============================================================

CREATE POLICY "audit_select_admin" ON admin_audit_log
  FOR SELECT USING (is_admin());

CREATE POLICY "audit_insert_admin" ON admin_audit_log
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- APP_SETTINGS
-- ============================================================

-- Lecture : tous les membres
CREATE POLICY "settings_select" ON app_settings
  FOR SELECT USING (current_user_id() IS NOT NULL);

-- Modification : admins uniquement
CREATE POLICY "settings_write_admin" ON app_settings
  FOR ALL USING (is_admin());


-- ============================================================
-- FILE: supabase/migrations/003_functions_triggers.sql
-- ============================================================
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


-- ============================================================
-- FILE: supabase/migrations/004_email_notifications.sql
-- ============================================================
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


-- ============================================================
-- FILE: supabase/migrations/005_event_groups_notifications.sql
-- ============================================================
-- ============================================================
-- EGC — Groupes ciblés par événement + notifications
-- ============================================================

-- Ajout d'un tableau de groupes ciblés sur les événements
ALTER TABLE events ADD COLUMN IF NOT EXISTS group_ids UUID[] DEFAULT '{}';

-- ============================================================
-- Trigger : notifier les membres des groupes à la création d'un événement
-- ============================================================

CREATE OR REPLACE FUNCTION notify_new_event_to_groups()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_user     RECORD;
BEGIN
  -- Si aucun groupe ciblé → notifier tous les membres actifs
  IF array_length(NEW.group_ids, 1) IS NULL THEN
    FOR v_user IN
      SELECT id FROM users WHERE is_active = true AND role != 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_user.id,
        'new_event',
        '📅 Nouvel événement : ' || NEW.name,
        NEW.location || ' — ' || TO_CHAR(NEW.event_date, 'DD/MM/YYYY'),
        jsonb_build_object('event_id', NEW.id)
      );
    END LOOP;
  ELSE
    -- Notifier uniquement les membres des groupes ciblés
    FOREACH v_group_id IN ARRAY NEW.group_ids LOOP
      FOR v_user IN
        SELECT id FROM users
        WHERE group_id = v_group_id AND is_active = true
      LOOP
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          v_user.id,
          'new_event',
          '📅 Nouvel événement : ' || NEW.name,
          NEW.location || ' — ' || TO_CHAR(NEW.event_date, 'DD/MM/YYYY'),
          jsonb_build_object('event_id', NEW.id)
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_new_event
AFTER INSERT ON events
FOR EACH ROW EXECUTE FUNCTION notify_new_event_to_groups();

-- RLS : politique déjà créée dans 002_rls_policies.sql — rien à faire ici


-- ============================================================
-- FILE: supabase/migrations/006_verify_license_function.sql
-- ============================================================
-- ============================================================
-- EGC — Fonction publique de vérification de licence
-- Permet aux visiteurs non authentifiés de vérifier qu'un
-- numéro de licence existe avant de créer un compte parent.
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire,
-- contournant le RLS sur la table users.
-- ============================================================

CREATE OR REPLACE FUNCTION verify_license_exists(p_license TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, first_name, last_name INTO v_user
  FROM users
  WHERE license_number = TRIM(p_license)
    AND is_active = true
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  RETURN jsonb_build_object(
    'exists',     true,
    'id',         v_user.id,
    'first_name', v_user.first_name,
    'last_name',  v_user.last_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Autoriser les appels anonymes (anon role)
GRANT EXECUTE ON FUNCTION verify_license_exists(TEXT) TO anon;


-- ============================================================
-- FILE: supabase/migrations/007_register_parent_function.sql
-- ============================================================
-- ============================================================
-- EGC — Inscription des parents (contournement RLS)
-- La fonction vérifie que auth.uid() = p_auth_id pour
-- éviter toute usurpation, puis insère le profil, le lien
-- parent-enfant et notifie les admins.
-- ============================================================

CREATE OR REPLACE FUNCTION register_parent_account(
  p_auth_id    UUID,
  p_email      TEXT,
  p_first_name TEXT,
  p_last_name  TEXT,
  p_phone      TEXT,
  p_address    TEXT,
  p_child_id   UUID
)
RETURNS VOID AS $$
DECLARE
  v_admin RECORD;
BEGIN
  -- Vérification de sécurité : l'appelant doit être le compte qui s'inscrit
  IF auth.uid() IS DISTINCT FROM p_auth_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1. Créer le profil (is_active = false, en attente de validation)
  INSERT INTO users (
    auth_id, role, email, first_name, last_name,
    phone, address, is_active, profile_complete
  ) VALUES (
    p_auth_id, 'parent', p_email, p_first_name, p_last_name,
    p_phone, p_address, false, true
  );

  -- 2. Lier l'enfant (non validé)
  INSERT INTO parent_child (parent_id, child_id, validated)
  VALUES (p_auth_id, p_child_id, false);

  -- 3. Notifier les admins
  FOR v_admin IN
    SELECT id FROM users WHERE role = 'admin' AND is_active = true
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_admin.id,
      'new_registration',
      '👤 Nouvelle demande d''inscription',
      p_first_name || ' ' || p_last_name || ' demande à rejoindre le club.',
      jsonb_build_object('applicant_email', p_email, 'child_id', p_child_id)
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Autoriser les utilisateurs authentifiés à appeler cette fonction
GRANT EXECUTE ON FUNCTION register_parent_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;


-- ============================================================
-- FILE: supabase/migrations/008_feature_flags.sql
-- ============================================================
-- ============================================================
-- EGC — Feature flags pour les fonctionnalités payantes
-- Modifiez les valeurs directement dans Supabase SQL Editor :
--   UPDATE app_settings SET value = 'true'  WHERE key = '...';
--   UPDATE app_settings SET value = 'false' WHERE key = '...';
-- ============================================================

-- Flag : emails transactionnels via Resend + pg_net
-- true  = emails activés (coût ~0,80€/1000 emails)
-- false = emails désactivés, uniquement notifications in-app
INSERT INTO app_settings (key, value)
VALUES ('email_notifications_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Flag : SMS (non implémenté, réservé pour usage futur)
-- true  = SMS activés (coût ~0,05€/SMS via Twilio/Vonage)
-- false = SMS désactivés
INSERT INTO app_settings (key, value)
VALUES ('sms_notifications_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Mise à jour de send_email : vérifie le flag avant d'envoyer
-- ============================================================

CREATE OR REPLACE FUNCTION send_email(
  p_to      TEXT,
  p_subject TEXT,
  p_html    TEXT
) RETURNS VOID AS $$
DECLARE
  v_api_key TEXT;
  v_from    TEXT;
  v_enabled TEXT;
BEGIN
  -- Vérifier si les emails sont activés
  SELECT value INTO v_enabled
  FROM app_settings WHERE key = 'email_notifications_enabled';

  IF v_enabled IS DISTINCT FROM 'true' THEN
    RETURN;
  END IF;

  -- Ne pas envoyer aux adresses internes des licenciés
  IF p_to IS NULL OR p_to = '' OR p_to LIKE '%@egc.internal' THEN
    RETURN;
  END IF;

  SELECT value INTO v_api_key FROM app_settings WHERE key = 'resend_api_key';
  SELECT value INTO v_from    FROM app_settings WHERE key = 'email_from';

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
  RAISE WARNING 'Email non envoyé à % : %', p_to, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- FILE: supabase/migrations/0091_user_groups.sql
-- ============================================================
-- ============================================================
-- EGC — Table de jointure user_groups
-- Un licencié peut appartenir à plusieurs groupes d'entraînement
-- Remplace la colonne users.group_id (1 seul groupe)
-- ============================================================

-- 1. Table de jointure
CREATE TABLE user_groups (
  user_id  UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

CREATE INDEX idx_user_groups_user  ON user_groups(user_id);
CREATE INDEX idx_user_groups_group ON user_groups(group_id);

-- 2. Migration des données existantes
INSERT INTO user_groups (user_id, group_id)
SELECT id, group_id FROM users WHERE group_id IS NOT NULL;

-- 3. Suppression de l'ancienne colonne
DROP INDEX IF EXISTS idx_users_group;
ALTER TABLE users DROP COLUMN IF EXISTS group_id;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

-- Lecture : tout membre connecté peut voir les groupes
CREATE POLICY "user_groups_select_members" ON user_groups
  FOR SELECT USING (current_user_id() IS NOT NULL);

-- Écriture : admins uniquement
CREATE POLICY "user_groups_write_admin" ON user_groups
  FOR ALL USING (is_admin());

-- ============================================================
-- Mise à jour du trigger de notification des événements
-- (utilisait users.group_id, maintenant utilise user_groups)
-- ============================================================

CREATE OR REPLACE FUNCTION notify_new_event_to_groups()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_user     RECORD;
BEGIN
  -- Si aucun groupe ciblé → notifier tous les membres actifs
  IF array_length(NEW.group_ids, 1) IS NULL THEN
    FOR v_user IN
      SELECT id FROM users WHERE is_active = true AND role != 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_user.id,
        'new_event',
        '📅 Nouvel événement : ' || NEW.name,
        NEW.location || ' — ' || TO_CHAR(NEW.event_date, 'DD/MM/YYYY'),
        jsonb_build_object('event_id', NEW.id)
      );
    END LOOP;
  ELSE
    -- Notifier uniquement les membres des groupes ciblés
    FOREACH v_group_id IN ARRAY NEW.group_ids LOOP
      FOR v_user IN
        SELECT u.id
        FROM users u
        JOIN user_groups ug ON ug.user_id = u.id
        WHERE ug.group_id = v_group_id AND u.is_active = true
      LOOP
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          v_user.id,
          'new_event',
          '📅 Nouvel événement : ' || NEW.name,
          NEW.location || ' — ' || TO_CHAR(NEW.event_date, 'DD/MM/YYYY'),
          jsonb_build_object('event_id', NEW.id)
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- FILE: supabase/migrations/009_admin_create_licencie_function.sql
-- ============================================================
-- ============================================================
-- EGC — Création d'un compte licencié par un admin
-- Contourne le besoin de la service_role key côté app.
-- Vérifie que l'appelant est bien un admin actif avant
-- d'insérer dans auth.users et public.users.
-- ============================================================

CREATE OR REPLACE FUNCTION admin_create_licencie(
  p_license_number TEXT,
  p_birthdate      TEXT,          -- format YYYY-MM-DD, devient le mot de passe initial
  p_first_name     TEXT DEFAULT '',
  p_last_name      TEXT DEFAULT '',
  p_group_ids      UUID[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_email     TEXT;
  v_auth_id   UUID;
  v_user_id   UUID;
  v_group_id  UUID;
  v_instance  UUID;
BEGIN
  -- Vérification : l'appelant doit être un admin actif
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role = 'admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé — admin uniquement';
  END IF;

  v_email   := LOWER(TRIM(p_license_number)) || '@egc.internal';
  v_auth_id := gen_random_uuid();
  v_instance := COALESCE(
    (SELECT instance_id FROM auth.users LIMIT 1),
    '00000000-0000-0000-0000-000000000000'
  );

  -- 1. Créer le compte Supabase Auth
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous,
    created_at, updated_at
  ) VALUES (
    v_auth_id,
    v_instance,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_birthdate, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', 'licencie', 'license_number', p_license_number),
    false, false, false,
    now(), now()
  );

  -- 2. Créer le profil dans public.users
  INSERT INTO users (
    auth_id, role, license_number, email,
    first_name, last_name,
    profile_complete, is_active
  ) VALUES (
    v_auth_id,
    'licencie',
    TRIM(p_license_number),
    v_email,
    NULLIF(TRIM(p_first_name), ''),
    NULLIF(TRIM(p_last_name), ''),
    (TRIM(p_first_name) <> '' AND TRIM(p_last_name) <> ''),
    true
  )
  RETURNING id INTO v_user_id;

  -- 3. Associer aux groupes
  IF p_group_ids IS NOT NULL THEN
    FOREACH v_group_id IN ARRAY p_group_ids LOOP
      INSERT INTO user_groups (user_id, group_id)
      VALUES (v_user_id, v_group_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- 4. Journal d'audit
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (
    (SELECT id FROM users WHERE auth_id = auth.uid()),
    'create_licencie',
    'user',
    v_user_id,
    'Licence: ' || TRIM(p_license_number)
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Autoriser les utilisateurs authentifiés à appeler cette fonction
-- (la vérification admin est faite à l'intérieur)
GRANT EXECUTE ON FUNCTION admin_create_licencie(TEXT, TEXT, TEXT, TEXT, UUID[]) TO authenticated;


-- ============================================================
-- FILE: supabase/migrations/010_admin_delete_licencie_function.sql
-- ============================================================
-- ============================================================
-- EGC — Suppression définitive d'un licencié par un admin
-- Supprime en cascade : trajets, réservations, conversations,
-- messages, notifications, liens parent-enfant (pas le parent).
-- Supprime aussi le compte Supabase Auth.
-- ============================================================

CREATE OR REPLACE FUNCTION admin_delete_licencie(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_auth_id  UUID;
  v_admin_id UUID;
BEGIN
  -- Vérification : l'appelant doit être un admin actif
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role = 'admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé — admin uniquement';
  END IF;

  -- Vérification : ne supprimer que des licenciés
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND role = 'licencie'
  ) THEN
    RAISE EXCEPTION 'Ce compte n''est pas un licencié';
  END IF;

  SELECT id      INTO v_admin_id FROM users WHERE auth_id = auth.uid();
  SELECT auth_id INTO v_auth_id  FROM users WHERE id = p_user_id;

  -- Journal d'audit (avant suppression pour conserver la traçabilité)
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (v_admin_id, 'delete_licencie', 'user', p_user_id, 'Suppression définitive du licencié');

  -- Supprimer le profil
  -- La cascade ON DELETE CASCADE gère automatiquement :
  --   trips (driver_id)     → bookings, conversations, messages
  --   bookings (passenger_id)
  --   parent_child (child_id)  ← uniquement le lien, pas le compte parent
  --   notifications (user_id)
  --   conversations (user_a_id / user_b_id)
  DELETE FROM users WHERE id = p_user_id;

  -- Supprimer le compte Supabase Auth
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_delete_licencie(UUID) TO authenticated;


-- ============================================================
-- FILE: supabase/migrations/011_admin_delete_member_function.sql
-- ============================================================
-- ============================================================
-- EGC — Suppression définitive d'un membre (licencié, parent,
-- encadrant) par un admin. Remplace admin_delete_licencie.
-- La suppression en cascade (ON DELETE CASCADE) gère :
--   licencié : trips, bookings, conversations, messages,
--              lien parent-enfant (child_id), notifications
--   parent   : trips, bookings, conversations, messages,
--              lien parent-enfant (parent_id), notifications
--              → les comptes enfants ne sont PAS supprimés
-- ============================================================

CREATE OR REPLACE FUNCTION admin_delete_member(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_auth_id  UUID;
  v_admin_id UUID;
  v_role     TEXT;
BEGIN
  -- Vérification : l'appelant doit être un admin actif
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role = 'admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé — admin uniquement';
  END IF;

  -- Récupérer le rôle et l'auth_id de la cible
  SELECT role, auth_id INTO v_role, v_auth_id
  FROM users WHERE id = p_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;

  -- Interdire la suppression d'un admin
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'Impossible de supprimer un compte administrateur';
  END IF;

  SELECT id INTO v_admin_id FROM users WHERE auth_id = auth.uid();

  -- Journal d'audit (action = delete_licencie / delete_parent / delete_encadrant)
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (v_admin_id, 'delete_' || v_role, 'user', p_user_id, 'Suppression définitive');

  -- Supprimer le profil — la cascade gère tout le reste
  DELETE FROM users WHERE id = p_user_id;

  -- Supprimer le compte Supabase Auth
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_delete_member(UUID) TO authenticated;


-- ============================================================
-- FILE: supabase/migrations/012_fix_event_trigger.sql
-- ============================================================
-- ============================================================
-- EGC — Correction du trigger notify_new_event_to_groups
-- La migration 005 a écrasé la version corrigée de 009_user_groups
-- qui utilisait encore users.group_id (colonne supprimée).
-- Ce fichier restaure la version correcte avec user_groups.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_new_event_to_groups()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_user     RECORD;
BEGIN
  -- Si aucun groupe ciblé → notifier tous les membres actifs
  IF array_length(NEW.group_ids, 1) IS NULL THEN
    FOR v_user IN
      SELECT id FROM users WHERE is_active = true AND role != 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_user.id,
        'new_event',
        '📅 Nouvel événement : ' || NEW.name,
        NEW.location || ' — ' || TO_CHAR(NEW.event_date, 'DD/MM/YYYY'),
        jsonb_build_object('event_id', NEW.id)
      );
    END LOOP;
  ELSE
    -- Notifier uniquement les membres des groupes ciblés (via user_groups)
    FOREACH v_group_id IN ARRAY NEW.group_ids LOOP
      FOR v_user IN
        SELECT u.id
        FROM users u
        JOIN user_groups ug ON ug.user_id = u.id
        WHERE ug.group_id = v_group_id AND u.is_active = true
      LOOP
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          v_user.id,
          'new_event',
          '📅 Nouvel événement : ' || NEW.name,
          NEW.location || ' — ' || TO_CHAR(NEW.event_date, 'DD/MM/YYYY'),
          jsonb_build_object('event_id', NEW.id)
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- FILE: supabase/migrations/013_fix_admin_create_licencie.sql
-- ============================================================
-- ============================================================
-- EGC — Correction de admin_create_licencie
-- Ajout de confirmed_at et des champs token vides requis
-- par Supabase Auth pour valider la connexion par mot de passe.
-- ============================================================

CREATE OR REPLACE FUNCTION admin_create_licencie(
  p_license_number TEXT,
  p_birthdate      TEXT,
  p_first_name     TEXT DEFAULT '',
  p_last_name      TEXT DEFAULT '',
  p_group_ids      UUID[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_email     TEXT;
  v_auth_id   UUID;
  v_user_id   UUID;
  v_group_id  UUID;
  v_instance  UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role = 'admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé — admin uniquement';
  END IF;

  v_email    := LOWER(TRIM(p_license_number)) || '@egc.internal';
  v_auth_id  := gen_random_uuid();
  v_instance := COALESCE(
    (SELECT instance_id FROM auth.users LIMIT 1),
    '00000000-0000-0000-0000-000000000000'
  );

  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current, email_change,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous,
    created_at, updated_at
  ) VALUES (
    v_auth_id,
    v_instance,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_birthdate, gen_salt('bf', 10)),
    now(),
    '', '',
    '', '', '',
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', 'licencie', 'license_number', p_license_number),
    false, false, false,
    now(), now()
  );

  -- Enregistrement de l'identité email (requis par GoTrue pour valider le login)
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_auth_id::text,
    v_auth_id,
    jsonb_build_object('sub', v_auth_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  );

  INSERT INTO users (
    auth_id, role, license_number, email,
    first_name, last_name, profile_complete, is_active
  ) VALUES (
    v_auth_id, 'licencie', TRIM(p_license_number), v_email,
    NULLIF(TRIM(p_first_name), ''), NULLIF(TRIM(p_last_name), ''),
    false, true
  ) RETURNING id INTO v_user_id;

  IF p_group_ids IS NOT NULL THEN
    FOREACH v_group_id IN ARRAY p_group_ids LOOP
      INSERT INTO user_groups (user_id, group_id)
      VALUES (v_user_id, v_group_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
  VALUES (
    (SELECT id FROM users WHERE auth_id = auth.uid()),
    'create_licencie', 'user', v_user_id, 'Licence: ' || TRIM(p_license_number)
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_create_licencie(TEXT, TEXT, TEXT, TEXT, UUID[]) TO authenticated;

COMMIT;
