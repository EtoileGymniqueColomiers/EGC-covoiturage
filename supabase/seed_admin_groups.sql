-- Point 6 + 7 SETUP.md — seed admin + groupes
-- Idempotent: safe to re-run

DO $$
DECLARE
  v_auth_id  UUID;
  v_instance UUID;
  v_email    TEXT := 'admin@egc.fr';
  -- Mot de passe temporaire (à changer après première connexion)
  v_password TEXT := 'EGC-Admin-2026!';
BEGIN
  -- Auth user (si absent)
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
      '{"role":"admin"}'::jsonb,
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
  END IF;

  -- Profil public.users
  INSERT INTO users (auth_id, role, email, first_name, last_name, profile_complete, is_active)
  VALUES (v_auth_id, 'admin', v_email, 'Admin', 'EGC', true, true)
  ON CONFLICT (email) DO UPDATE
    SET auth_id = EXCLUDED.auth_id,
        role = 'admin',
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        profile_complete = true,
        is_active = true;
END $$;

-- Groupes d'entraînement
INSERT INTO groups (name, schedule, coach_name)
SELECT * FROM (VALUES
  (
    'Gym Artistique U10',
    '[{"day":"lundi","time":"17:30"},{"day":"mercredi","time":"14:00"}]'::jsonb,
    'Coach Dupont'
  ),
  (
    'Gym Artistique U12',
    '[{"day":"mardi","time":"18:00"},{"day":"jeudi","time":"18:00"}]'::jsonb,
    'Coach Martin'
  ),
  (
    'Gym Rythmique Senior',
    '[{"day":"lundi","time":"19:00"},{"day":"vendredi","time":"18:30"}]'::jsonb,
    'Coach Bernard'
  )
) AS v(name, schedule, coach_name)
WHERE NOT EXISTS (
  SELECT 1 FROM groups g WHERE g.name = v.name
);

-- Vérification
SELECT 'users' AS kind, role::text, email, is_active::text AS active FROM users
UNION ALL
SELECT 'group', name, coach_name, id::text FROM groups
ORDER BY 1, 2;
