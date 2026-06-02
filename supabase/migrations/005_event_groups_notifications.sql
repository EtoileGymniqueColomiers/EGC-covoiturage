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
