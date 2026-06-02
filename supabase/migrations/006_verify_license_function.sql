-- ============================================================
-- EGC — Fonction publique de vérification de licence
-- Permet aux visiteurs non authentifiés de vérifier qu'un
-- numéro de licence existe avant de créer un compte parent.
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire,
-- contournant le RLS sur la table users.
-- ============================================================

CREATE OR REPLACE FUNCTION verify_license_exists(p_license TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, first_name, last_name INTO v_user
  FROM users
  WHERE license_number = TRIM(p_license)
    AND is_active = true
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  RETURN jsonb_build_object(
    'exists',     true,
    'id',         v_user.id,
    'first_name', v_user.first_name,
    'last_name',  v_user.last_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Autoriser les appels anonymes (anon role)
GRANT EXECUTE ON FUNCTION verify_license_exists(TEXT) TO anon;
