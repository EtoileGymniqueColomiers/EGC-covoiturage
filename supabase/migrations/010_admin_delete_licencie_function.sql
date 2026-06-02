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
