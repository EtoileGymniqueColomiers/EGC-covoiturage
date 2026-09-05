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
