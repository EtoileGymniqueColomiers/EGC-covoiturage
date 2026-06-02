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
