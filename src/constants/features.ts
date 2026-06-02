// ============================================================
// Fonctionnalités payantes — activez / désactivez ici
// ============================================================
// Chaque flag est documenté avec :
//   - ce qu'il contrôle
//   - où il est appliqué (TypeScript et/ou SQL)
//   - le coût associé
// ============================================================

/**
 * Emails transactionnels (Resend + pg_net)
 *
 * Quand true  → conducteur reçoit un email à chaque réservation et annulation
 * Quand false → uniquement notifications in-app, aucun email envoyé
 *
 * Coût : ~0,80 € / 1 000 emails (plan Resend gratuit = 3 000 emails/mois)
 *
 * Appliqué côté SQL : function send_email() vérifie app_settings.email_notifications_enabled
 * Pour synchroniser, exécutez dans Supabase SQL Editor :
 *   UPDATE app_settings SET value = 'true'  WHERE key = 'email_notifications_enabled';
 *   UPDATE app_settings SET value = 'false' WHERE key = 'email_notifications_enabled';
 */
export const FEATURE_EMAIL_NOTIFICATIONS = true

/**
 * Confirmation email à l'inscription (Supabase Auth SMTP)
 *
 * Quand true  → Supabase envoie un email de vérification après signUp()
 *               (limité à 3–4 emails/heure sur le plan gratuit → erreur "rate limit")
 * Quand false → pas d'email de confirmation ; les comptes sont validés manuellement
 *               par l'administrateur via la page admin (comportement recommandé pour EGC)
 *
 * Coût : gratuit mais quota très bas (3/h). Plan Pro = 100/h ($25/mois)
 *
 * Ce flag n'est PAS appliqué automatiquement côté app.
 * Action requise dans Supabase Dashboard :
 *   Authentication → Configuration → Email → "Confirm email" → décocher
 */
export const FEATURE_AUTH_EMAIL_CONFIRMATION = false // Recommandé : false

/**
 * Notifications SMS
 *
 * Non implémenté. Prévu pour : alertes urgentes aux parents (annulation dernière minute)
 *
 * Coût : ~0,05 € / SMS via Twilio ou Vonage
 *
 * Pour activer :
 *   1. Supabase Dashboard → Authentication → Phone → choisir un provider SMS
 *   2. Ajouter la logique d'envoi dans les triggers SQL (send_sms)
 *   3. Passer ce flag à true
 */
export const FEATURE_SMS_NOTIFICATIONS = false
