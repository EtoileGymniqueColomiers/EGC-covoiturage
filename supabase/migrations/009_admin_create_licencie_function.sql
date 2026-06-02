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
