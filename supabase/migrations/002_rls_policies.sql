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
