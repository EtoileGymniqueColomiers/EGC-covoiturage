# Android / Play Store — screenshots

Les captures phone Play Store sont dans :

`metadata/android/fr-FR/images/phoneScreenshots/`

Format : **1080×1920** (9:16), PNG 24-bit sans alpha.

## Régénérer depuis les screenshots iOS

Après un `fastlane ios screenshots` (dossier `ios/fastlane/screenshots/fr-FR/asc-1284x2778/`) :

```bash
python3 scripts/ios_to_playstore_screenshots.py
```

Les captures iPhone (~9:19.5) sont trop hautes pour le ratio Play Store (9:16) :
le script recadre depuis le haut (barre d’onglets conservée) puis redimensionne.

## Upload manuel

Play Console → Fiche Play Store → Graphismes → Captures d’écran téléphone
→ uploader les 5 PNG du dossier ci-dessus.
