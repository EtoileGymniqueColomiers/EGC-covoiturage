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
