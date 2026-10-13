-- Demo parent account for Fastlane Snapshot (`ios/fastlane/.env` SNAPSHOT_*).
-- Idempotent: safe to re-run. Role must be parent/encadrant (not admin) so UI lands on app tabs.

DO $$
DECLARE
  v_auth_id  UUID;
  v_instance UUID;
  v_email    TEXT := 'user@egc.fr';
  v_password TEXT := 'EGC-User-2026!';
BEGIN
  SELECT id INTO v_auth_id FROM auth.users WHERE email = v_email;

  IF v_auth_id IS NULL THEN
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
      crypt(v_password, gen_salt('bf', 10)),
      now(),
      '', '',
      '', '', '',
      '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"parent"}'::jsonb,
      false, false, false,
      now(), now()
    );

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
      jsonb_build_object(
        'sub', v_auth_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    -- Keep password in sync with ios/fastlane/.env for local screenshot runs
    UPDATE auth.users
    SET encrypted_password = crypt(v_password, gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_auth_id;
  END IF;

  INSERT INTO users (auth_id, role, email, first_name, last_name, profile_complete, is_active)
  VALUES (v_auth_id, 'parent', v_email, 'Demo', 'Parent', true, true)
  ON CONFLICT (email) DO UPDATE
    SET auth_id = EXCLUDED.auth_id,
        role = 'parent',
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        profile_complete = true,
        is_active = true;
END $$;

SELECT email, role::text, profile_complete, is_active
FROM users
WHERE email = 'user@egc.fr';
