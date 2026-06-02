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
