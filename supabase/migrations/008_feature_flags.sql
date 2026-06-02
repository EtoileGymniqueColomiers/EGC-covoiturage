-- ============================================================
-- EGC — Feature flags pour les fonctionnalités payantes
-- Modifiez les valeurs directement dans Supabase SQL Editor :
--   UPDATE app_settings SET value = 'true'  WHERE key = '...';
--   UPDATE app_settings SET value = 'false' WHERE key = '...';
-- ============================================================

-- Flag : emails transactionnels via Resend + pg_net
-- true  = emails activés (coût ~0,80€/1000 emails)
-- false = emails désactivés, uniquement notifications in-app
INSERT INTO app_settings (key, value)
VALUES ('email_notifications_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Flag : SMS (non implémenté, réservé pour usage futur)
-- true  = SMS activés (coût ~0,05€/SMS via Twilio/Vonage)
-- false = SMS désactivés
INSERT INTO app_settings (key, value)
VALUES ('sms_notifications_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Mise à jour de send_email : vérifie le flag avant d'envoyer
-- ============================================================

CREATE OR REPLACE FUNCTION send_email(
  p_to      TEXT,
  p_subject TEXT,
  p_html    TEXT
) RETURNS VOID AS $$
DECLARE
  v_api_key TEXT;
  v_from    TEXT;
  v_enabled TEXT;
BEGIN
  -- Vérifier si les emails sont activés
  SELECT value INTO v_enabled
  FROM app_settings WHERE key = 'email_notifications_enabled';

  IF v_enabled IS DISTINCT FROM 'true' THEN
    RETURN;
  END IF;

  -- Ne pas envoyer aux adresses internes des licenciés
  IF p_to IS NULL OR p_to = '' OR p_to LIKE '%@egc.internal' THEN
    RETURN;
  END IF;

  SELECT value INTO v_api_key FROM app_settings WHERE key = 'resend_api_key';
  SELECT value INTO v_from    FROM app_settings WHERE key = 'email_from';

  PERFORM net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object(
      'from',    v_from,
      'to',      ARRAY[p_to],
      'subject', p_subject,
      'html',    p_html
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Email non envoyé à % : %', p_to, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
