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
