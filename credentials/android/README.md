# Android upload keystore

Ce dossier contient la clé de signature Play Store (gitignorée).

## Fichiers locaux (à sauvegarder hors git)

- `egc-covoiturage-upload.keystore` — clé d’upload
- `keystore.properties` — mots de passe + alias

**Sans ces fichiers, tu ne pourras plus publier de mises à jour** de `fr.egc.covoiturage` sur le Play Store. Garde une copie sécurisée (password manager / coffre).

## Build AAB local

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd android && ./gradlew bundleRelease
```

Sortie : `android/app/build/outputs/bundle/release/app-release.aab`
