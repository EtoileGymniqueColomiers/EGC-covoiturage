# EGC Covoiturage — Guide de démarrage

## 1. Installer Node.js

Téléchargez et installez Node.js LTS depuis https://nodejs.org
Choisissez la version **LTS (Long Term Support)**.

Vérifiez l'installation :
```
node --version   # doit afficher v20.x ou supérieur
npm --version    # doit afficher 10.x ou supérieur
```

---

## 2. Créer le projet Supabase (gratuit)

1. Allez sur https://supabase.com → "Start your project"
2. Créez un compte gratuit
3. Cliquez **New project** → choisissez une région Europe (ex: Frankfurt)
4. Notez le **Project URL** et la clé **anon/public**

### Exécuter les migrations SQL

Dans votre dashboard Supabase → **SQL Editor** :
- Copiez-collez et exécutez dans cet ordre :
  1. `supabase/migrations/001_initial_schema.sql`
  2. `supabase/migrations/002_rls_policies.sql`
  3. `supabase/migrations/003_functions_triggers.sql`

### Configurer l'adresse du club

Dans le SQL Editor, mettez à jour les paramètres :
```sql
UPDATE app_settings SET value = 'Votre vraie adresse du club' WHERE key = 'club_address';
UPDATE app_settings SET value = '48.8566' WHERE key = 'club_lat';   -- latitude
UPDATE app_settings SET value = '2.3522'  WHERE key = 'club_lng';   -- longitude
```

---

## 3. Configurer les variables d'environnement

Copiez le fichier d'exemple :
```
copy .env.example .env
```

Ouvrez `.env` et remplissez avec vos valeurs Supabase :
```
EXPO_PUBLIC_SUPABASE_URL=https://VOTRE_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=VOTRE_ANON_KEY
```

---

## 4. Installer les dépendances et lancer l'app

```bash
npm install
npm start
```

Scannez le QR code avec **Expo Go** (téléchargeable sur App Store / Play Store).

---

## 5. Configurer le ping anti-pause (important !)

Pour éviter que la base de données se mette en pause pendant les vacances :

1. Allez sur https://cron-job.org → créer un compte gratuit
2. Créez un nouveau cron job :
   - URL : `https://VOTRE_PROJECT_ID.supabase.co/rest/v1/`
   - Header : `apikey: VOTRE_ANON_KEY`
   - Fréquence : tous les 3 jours
3. Activez le job → votre base ne dormira jamais

---

## 6. Créer le premier compte admin

Dans le dashboard Supabase → **Authentication → Users** → **Add user** :
- Email : `admin@egc.fr`
- Password : mot de passe fort
- Confirm email : ✓

Puis dans **SQL Editor** :
```sql
INSERT INTO users (auth_id, role, email, first_name, last_name, profile_complete, is_active)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@egc.fr'),
  'admin',
  'admin@egc.fr',
  'Admin',
  'EGC',
  true,
  true
);
```

---

## 7. Créer des groupes d'entraînement

Dans **SQL Editor** :
```sql
INSERT INTO groups (name, schedule, coach_name) VALUES
  ('Gym Artistique U10', '[{"day":"lundi","time":"17:30"},{"day":"mercredi","time":"14:00"}]', 'Coach Dupont'),
  ('Gym Artistique U12', '[{"day":"mardi","time":"18:00"},{"day":"jeudi","time":"18:00"}]', 'Coach Martin'),
  ('Gym Rythmique Senior', '[{"day":"lundi","time":"19:00"},{"day":"vendredi","time":"18:30"}]', 'Coach Bernard');
```

---

## 8. Publier iOS sur TestFlight (Fastlane — gratuit)

Prérequis : compte Apple Developer ($99/an), Xcode CLI tools, Ruby/Bundler.
Pas besoin d’ouvrir Xcode : la signature utilise la clé API App Store Connect (cloud signing).

### Config
```bash
cd ios
bundle install
cp fastlane/.env.example fastlane/.env
# Éditer fastlane/.env :
#   FASTLANE_TEAM_ID
#   APP_STORE_CONNECT_KEY_ID / ISSUER_ID / KEY_PATH
# Placer AuthKey_*.p8 dans ios/secrets/ (gitignored)
```

Créer l’app dans [App Store Connect](https://appstoreconnect.apple.com) avec le bundle id `fr.egc.covoiturage` si elle n’existe pas.

La clé API doit être une **Team Key** avec rôle **Admin** ou **App Manager** (les Individual keys ne gèrent pas le provisioning).

### Build + upload TestFlight
```bash
# depuis la racine du repo
npm run ios:beta

# ou depuis ios/
cd ios && bundle exec fastlane beta
```

Lanes utiles :
- `bundle exec fastlane build` — IPA seulement
- `bundle exec fastlane upload` — upload d’un IPA déjà généré
- `bundle exec fastlane bump_build` — +1 sur le build number

Avant un build, vérifier que `.env` (Supabase) est à jour : les variables `EXPO_PUBLIC_*` sont lues au moment du bundle JS Xcode.

---

## Coûts récapitulatifs

| Service            | Coût          |
|--------------------|---------------|
| Supabase (Free)    | 0 €/mois      |
| Expo EAS (Free)    | 0 €/mois      |
| cron-job.org       | 0 €/mois      |
| Apple Developer    | ~8 €/mois     |
| Google Play        | 25 € (×1)     |
| **Total récurrent**| **~8 €/mois** |
