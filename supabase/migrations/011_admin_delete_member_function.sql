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
