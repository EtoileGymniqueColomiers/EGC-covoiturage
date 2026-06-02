# EGC Covoiturage
## Document de conception — Architecture & Produit

**Version** 1.0 · **Date** Mai 2026  
**Client** École de Gymnastique — EGC  
**Statut** MVP en développement  

---

## Table des matières

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [Vision produit](#2-vision-produit)
3. [Utilisateurs et rôles](#3-utilisateurs-et-rôles)
4. [Cas d'usage](#4-cas-dusage)
5. [Architecture technique](#5-architecture-technique)
6. [Modèle de données](#6-modèle-de-données)
7. [Sécurité](#7-sécurité)
8. [UX / Parcours utilisateurs](#8-ux--parcours-utilisateurs)
9. [Fonctionnalités avancées](#9-fonctionnalités-avancées)
10. [Roadmap produit](#10-roadmap-produit)
11. [Infrastructure et coûts](#11-infrastructure-et-coûts)
12. [Recommandations](#12-recommandations)

---

## 1. Contexte et objectifs

### Contexte

L'EGC est une association de gymnastique comptant environ **1 600 licenciés**, principalement des enfants et leurs parents. L'organisation des trajets vers les entraînements et compétitions repose aujourd'hui sur des échanges informels (téléphone, WhatsApp), ce qui génère une charge logistique importante pour les familles et le club.

### Problème à résoudre

- Pas d'outil centralisé pour coordonner les covoiturages
- Risque de double sollicitation ou d'oubli
- Aucune traçabilité des trajets impliquant des enfants mineurs
- Charge administrative pour les coordinateurs du club

### Objectifs produit

| Objectif | Indicateur de succès |
|---|---|
| Simplifier l'organisation des trajets | Temps moyen pour trouver un trajet < 3 minutes |
| Mettre en relation rapidement les membres | Taux de réservation acceptée > 70 % |
| Réduire la charge logistique | Réduction des appels/messages organisationnels |
| Créer une solution sécurisée | 0 incident lié à un accès non autorisé |

---

## 2. Vision produit

### Positionnement

**EGC Covoiturage** est une application mobile fermée de mise en relation pour le transport entre membres d'un club sportif. Ce n'est pas un service de transport public ouvert : c'est un **outil de coordination interne**, extension numérique du lien de confiance existant au sein du club.

> « Trouver un covoiturage vers le gymnase aussi simplement qu'envoyer un message. »

### Proposition de valeur

| Pour | EGC Covoiturage permet de |
|---|---|
| Les parents conducteurs | Organiser leurs trajets et remplir leur voiture avec des enfants connus du club |
| Les parents passagers | Trouver un trajet fiable en moins de 3 taps, sans appels ni messages WhatsApp |
| Le club | Réduire la charge logistique et garder le contrôle sur les déplacements |
| Les administrateurs | Gérer les comptes de façon centralisée et sécurisée |

### Différenciateurs clés

- **Accès fermé** : aucun inconnu, tous les membres sont vérifiés par le club
- **Confiance par défaut** : pas d'évaluation par étoiles nécessaire, la communauté est déjà établie
- **Adapté aux enfants** : logique de sécurité spécifique aux mineurs (confirmation renforcée, traçabilité)
- **Simple** : pensé pour des parents non techniques, max 3 taps pour une réservation

### Principes de design

1. **Zéro friction** — un parent doit pouvoir trouver et réserver un trajet en moins de 3 interactions
2. **Confiance visible** — chaque profil est nominatif, pas d'anonymat
3. **Mobile-first** — optimisé pour une utilisation rapide depuis un téléphone
4. **Progressive disclosure** — les fonctions avancées ne s'affichent que si pertinentes

---

## 3. Utilisateurs et rôles

### Types de comptes

| Rôle | Création du compte | Identifiants | Droits |
|---|---|---|---|
| **Licencié** | Par l'administrateur uniquement | N° de licence + date de naissance | Consulter et réserver des trajets |
| **Parent** | Inscription libre (email validé) | Email + mot de passe | Proposer et réserver des trajets, associer des enfants |
| **Encadrant** | Inscription libre | Email + mot de passe | Mêmes droits que Parent |
| **Administrateur** | Créé manuellement en base | Email + mot de passe fort | Accès complet, gestion des comptes et événements |

### Règles spécifiques

- Les comptes **licenciés sont créés uniquement par l'admin** (via formulaire ou import CSV)
- Le mot de passe initial d'un licencié est sa **date de naissance** (à modifier lors de la 1ʳᵉ connexion)
- Les admins peuvent **suspendre et supprimer** tout compte
- Toute action admin est **tracée dans un journal d'audit**
- La relation parent-enfant doit être **validée par un admin**

### Profil utilisateur

**Champs obligatoires**
- Prénom, Nom
- Adresse (géocodée pour le calcul de distance)
- Rôle

**Champs optionnels**
- Téléphone (visible uniquement par les covoitureurs confirmés)
- Nombre de places dans la voiture (0 = pas de véhicule)
- Groupe d'entraînement (pour les licenciés)

---

## 4. Cas d'usage

### 4.1 Covoiturage régulier

**Contexte** : trajets récurrents vers les entraînements hebdomadaires.

- Le conducteur crée un trajet de type **Régulier** avec une règle de récurrence (ex : tous les lundis à 18h)
- Les passagers réservent une fois, la réservation s'applique automatiquement chaque semaine
- Le conducteur reçoit une notification de confirmation chaque semaine

### 4.2 Covoiturage ponctuel

**Contexte** : besoin exceptionnel, remplacement, imprévu.

- Publication rapide en moins de 2 minutes
- Notification automatique aux membres du même groupe
- Réservation en 1 tap

### 4.3 Covoiturage événement / compétition

**Contexte** : déplacement vers une compétition, parfois avec nuitée.

- L'admin crée l'événement (nom, lieu, date, infos hébergement si multi-jours)
- Les conducteurs proposent des trajets **Aller** et/ou **Retour** séparément
- Pour les événements multi-jours : confirmation renforcée avec affichage du conducteur et son téléphone
- L'admin dispose d'un tableau de synthèse enfant/conducteur pour chaque événement

---

## 5. Architecture technique

### Stack technologique

| Composant | Technologie | Justification |
|---|---|---|
| **Mobile** | React Native + Expo SDK 54 | Cross-platform iOS/Android, une seule base de code |
| **Navigation** | Expo Router 4 | File-based routing, deep links natifs, TypeScript |
| **État global** | Zustand | Léger, simple, sans boilerplate |
| **Cache données** | TanStack Query | Gestion cache, requêtes, invalidation |
| **Backend** | Supabase (Free tier) | BaaS managé : PostgreSQL, Auth, Realtime, Storage |
| **Base de données** | PostgreSQL (via Supabase) | Relationnel, RLS natif, robuste |
| **Authentification** | Supabase Auth (JWT) | Flows custom supportés, tokens rotatifs |
| **Messagerie temps réel** | Supabase Realtime (WebSocket) | Inclus dans Supabase, pas de serveur custom |
| **Notifications push** | Expo Push Notifications | Gratuit, intégration native Expo |
| **Cartes** | react-native-maps + OpenStreetMap | Gratuit, sans API key |
| **Géocodage** | Nominatim (OpenStreetMap) | Gratuit, open source, sans limite critique |
| **Monitoring** | Sentry (Free tier) | Remontée automatique des erreurs |
| **Builds** | Expo EAS (Free tier) | 30 builds/mois, suffisant pour un club |

### Vue d'ensemble architecture

```
┌────────────────────────────────────────────────┐
│           APPLICATION MOBILE                   │
│         React Native + Expo SDK 54             │
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Expo    │ │ Zustand  │ │ TanStack      │  │
│  │  Router  │ │  Store   │ │ Query Cache   │  │
│  └──────────┘ └──────────┘ └───────────────┘  │
└────────────────────┬───────────────────────────┘
                     │ HTTPS / WebSocket
┌────────────────────▼───────────────────────────┐
│                  SUPABASE                      │
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Auth    │ │PostgreSQL│ │   Realtime    │  │
│  │  JWT     │ │  + RLS   │ │  WebSocket    │  │
│  └──────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────────────────────────┐ │
│  │ Storage  │ │  Triggers + Functions SQL    │ │
│  │ (avatars)│ │  (notifications, matching)   │ │
│  └──────────┘ └──────────────────────────────┘ │
└────────────────────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────┐
│              SERVICES EXTERNES                 │
│  Expo Push API (gratuit) │ Nominatim (gratuit) │
│  Sentry Free             │ cron-job.org (gratuit)│
└────────────────────────────────────────────────┘
```

### Structure des fichiers

```
EGC/
├── app/                          # Écrans (Expo Router)
│   ├── _layout.tsx               # Root layout + Auth Gate
│   ├── (auth)/                   # Écrans non authentifiés
│   │   ├── login.tsx             # Connexion (licencié / parent)
│   │   └── complete-profile.tsx  # Complétion profil 1ère connexion
│   ├── (app)/                    # Écrans membres
│   │   ├── index.tsx             # Accueil
│   │   ├── trips/                # Gestion des trajets
│   │   │   ├── index.tsx         # Liste des trajets
│   │   │   ├── [id].tsx          # Détail + réservation
│   │   │   └── create.tsx        # Création (3 étapes)
│   │   ├── messages/             # Messagerie
│   │   │   ├── index.tsx         # Liste des conversations
│   │   │   └── [id].tsx          # Chat temps réel
│   │   └── profile.tsx           # Profil utilisateur
│   └── (admin)/                  # Interface administrateur
│       ├── index.tsx             # Tableau de bord
│       ├── users.tsx             # Gestion membres
│       └── events.tsx            # Gestion événements
│
├── src/
│   ├── components/               # Composants réutilisables
│   │   ├── ui/                   # Composants de base
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── Badge.tsx
│   │   ├── TripCard.tsx          # Carte de trajet
│   │   └── MessageBubble.tsx     # Bulle de message
│   ├── constants/
│   │   └── theme.ts              # Couleurs, spacing, typographie
│   ├── hooks/                    # Logique métier
│   │   ├── useTrips.ts
│   │   ├── useMessages.ts
│   │   └── useBookings.ts
│   ├── lib/                      # Utilitaires
│   │   ├── supabase.ts           # Client Supabase + helpers auth
│   │   ├── notifications.ts      # Expo Push
│   │   └── geocoding.ts          # Nominatim
│   ├── stores/
│   │   └── auth.store.ts         # État d'authentification global
│   └── types/
│       └── index.ts              # Interfaces TypeScript
│
└── supabase/
    └── migrations/               # Scripts SQL à exécuter dans l'ordre
        ├── 001_initial_schema.sql
        ├── 002_rls_policies.sql
        └── 003_functions_triggers.sql
```

---

## 6. Modèle de données

### Schéma relationnel simplifié

```
groups ──────────────────────────────────┐
  │                                      │
  ▼                                      │
users ──────────────────────────────┐    │
  │  (role: licencie/parent/admin)  │    │
  │                                 │    │
  ├── parent_child (parent→enfant)  │    │
  │                                 │    │
  ├── trips (as driver) ────────────┼────┘
  │     │                           │
  │     ├── bookings ←──────────────┘ (as passenger)
  │     │
  │     └── conversations
  │               │
  │               └── messages
  │
  └── notifications
  
events ──→ trips
```

### Tables principales

#### `users` — Membres du club

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant interne |
| `auth_id` | UUID | Lié à Supabase Auth |
| `role` | ENUM | licencie / parent / encadrant / admin |
| `license_number` | TEXT | Numéro de licence (licenciés uniquement) |
| `email` | TEXT | Email (parents/encadrants) |
| `first_name` | TEXT | Prénom |
| `last_name` | TEXT | Nom |
| `phone` | TEXT | Téléphone (optionnel) |
| `address` | TEXT | Adresse domicile |
| `lat` / `lng` | DECIMAL | Coordonnées géocodées |
| `group_id` | UUID | Groupe d'entraînement |
| `car_capacity` | SMALLINT | Nombre de places (0 = pas de voiture) |
| `is_active` | BOOLEAN | Compte actif/suspendu |
| `profile_complete` | BOOLEAN | Profil complété lors de la 1ère connexion |
| `push_token` | TEXT | Token Expo Push Notifications |

#### `trips` — Trajets

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant |
| `driver_id` | UUID | Conducteur |
| `event_id` | UUID | Événement associé (optionnel) |
| `type` | ENUM | regulier / ponctuel / evenement |
| `direction` | ENUM | aller / retour (pour les événements) |
| `status` | ENUM | actif / complet / annule / termine |
| `departure_address` | TEXT | Adresse de départ |
| `arrival_address` | TEXT | Adresse d'arrivée |
| `departure_time` | TIMESTAMPTZ | Date et heure de départ |
| `available_seats` | SMALLINT | Places proposées (1–9) |
| `booked_seats` | SMALLINT | Places réservées (calculé automatiquement) |
| `comment` | TEXT | Note du conducteur |
| `recurrence_rule` | TEXT | Règle iCal pour trajets réguliers |
| `intermediate_stop` | TEXT | Arrêt intermédiaire optionnel |
| `group_id` | UUID | Ciblage par groupe d'entraînement |

#### `bookings` — Réservations

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant |
| `trip_id` | UUID | Trajet concerné |
| `passenger_id` | UUID | Passager |
| `status` | ENUM | en_attente / accepte / refuse / annule |
| `seats_requested` | SMALLINT | Nombre de places demandées |
| `message` | TEXT | Message d'accompagnement optionnel |

#### `events` — Compétitions et événements

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant |
| `name` | TEXT | Nom de l'événement |
| `event_date` | DATE | Date de début |
| `end_date` | DATE | Date de fin (si multi-jours) |
| `is_multi_day` | BOOLEAN | Événement sur plusieurs jours |
| `location` | TEXT | Lieu |
| `accommodation_note` | TEXT | Informations hébergement si nuitée |

#### `conversations` + `messages` — Messagerie

Une conversation est liée à un trajet et deux utilisateurs. Les messages sont chargés et livrés en temps réel via Supabase Realtime (WebSocket).

#### `admin_audit_log` — Journal d'audit

Toutes les actions sensibles des administrateurs sont tracées : création de compte, suspension, suppression, création d'événement.

---

## 7. Sécurité

### Authentification

**Licencié**
```
Login    : numéro de licence
Password : date de naissance (format YYYY-MM-DD)
Email interne généré : {licence}@egc.internal (jamais visible)
```

**Parent / Encadrant**
```
Login    : adresse email
Password : mot de passe choisi (min 8 caractères)
Validation email obligatoire à l'inscription
```

**Administrateur**
```
Compte créé manuellement en base
MFA recommandé
Tokens JWT avec expiration courte (1h) + refresh tokens rotatifs
```

### Row Level Security (RLS)

Toutes les tables ont le RLS activé. Les règles garantissent :

- Un utilisateur **ne voit que les trajets actifs** (pas les annulés sauf les siens)
- Un utilisateur **ne voit que ses propres messages et conversations**
- Un passager **ne peut pas réserver son propre trajet**
- Seuls les **admins peuvent créer des comptes licenciés**
- Seuls les **admins peuvent suspendre/supprimer** des comptes
- Les **logs d'audit sont en lecture seule** pour les non-admins

### Mesures de sécurité complémentaires

| Mesure | Détail |
|---|---|
| HTTPS uniquement | Certificat TLS géré par Supabase |
| Rate limiting | Anti brute-force sur les endpoints de login |
| Données enfants non exposées | Les noms d'enfants ne sont jamais dans les listes publiques |
| Téléphone masqué | Visible uniquement après confirmation d'une réservation |
| Signalement | Bouton sur chaque trajet/conversation → notification admin immédiate |
| Conformité RGPD | Droit à l'effacement, pas de données sensibles stockées en clair |

---

## 8. UX / Parcours utilisateurs

### Navigation principale

```
┌─────────────────────────────────────┐
│            BARRE DE TABS            │
│  [Accueil]  [Trajets]  [Messages]  [Profil]
└─────────────────────────────────────┘
```

### Parcours 1 — Première connexion (Licencié)

```
Écran de bienvenue
    │
    ▼
Sélection mode : [Licencié] ou [Parent/Encadrant]
    │ (mode licencié)
    ▼
Saisie : numéro de licence + date de naissance
    │ (succès)
    ▼
Modal obligatoire "Complétez votre profil"
    ├── Prénom, Nom
    ├── Adresse (pour le calcul de distance)
    └── Nombre de places en voiture
    │ (validation)
    ▼
Accueil de l'application
```

### Parcours 2 — Trouver un trajet (3 taps)

```
Accueil
    │ tap "Je cherche"
    ▼
Liste des trajets disponibles
    │ tap sur une carte de trajet
    ▼
Détail du trajet
    ├── Itinéraire, date, places restantes
    ├── Profil du conducteur
    └── [Demander une place]  ← tap 3
    │
    ▼
Notification push au conducteur
```

### Parcours 3 — Proposer un trajet (3 étapes guidées)

```
Étape 1 / 3 — Destination
    ├── Départ : [● Devant le club EGC] (pré-sélectionné)
    │           [○ Autre adresse]
    └── Arrivée : sélection événement OU saisie libre

Étape 2 / 3 — Détails
    ├── Type : [Ponctuel] [Régulier] [Compétition]
    ├── Aller / Retour (si compétition)
    ├── Date et heure
    ├── Nombre de places (1 à 6)
    └── Commentaire optionnel

Étape 3 / 3 — Récapitulatif
    └── [Publier le trajet] → visible immédiatement
```

### Parcours 4 — Gestion admin

Interface web accessible depuis un navigateur (ordinateur du club).

```
Tableau de bord
    ├── Statistiques (membres, trajets actifs, réservations)
    └── Journal des actions récentes

Gestion membres
    ├── Recherche par nom / numéro de licence
    ├── Créer un compte licencié (formulaire ou import CSV)
    └── Suspendre / réactiver un compte

Gestion événements
    ├── Créer une compétition (nom, lieu, date, hébergement)
    └── Voir les trajets organisés par événement
```

### Événements multi-jours — Confirmation renforcée

Pour tout trajet vers un événement avec nuitée, la réservation affiche :

```
┌─────────────────────────────────────────────┐
│  Vous confirmez :                           │
│                                             │
│  ALLER  — Sam 14 juin à 07:00              │
│  Conducteur : Paul D.  📞 06 xx xx xx xx   │
│  Votre enfant : Léa (U12)                  │
│                                             │
│  RETOUR — Dim 15 juin à 18:00              │
│  Conducteur : Marc T.  📞 06 xx xx xx xx   │
│                                             │
│  [Confirmer les deux trajets]               │
└─────────────────────────────────────────────┘
```

### Charte graphique

| Élément | Valeur |
|---|---|
| Couleur principale | `#1A56DB` (bleu EGC) |
| Couleur accent | `#F59E0B` (or) |
| Succès | `#10B981` (vert) |
| Erreur | `#EF4444` (rouge) |
| Fond | `#F1F5F9` (gris clair) |
| Surface | `#FFFFFF` |
| Police | System (San Francisco / Roboto) |
| Border radius | 12px (cards), 999px (chips) |

---

## 9. Fonctionnalités avancées

### Matching intelligent

L'algorithme de suggestion classe les trajets selon un score composite :

```
Score (sur 100) =
  40 pts × même groupe d'entraînement
+ 30 pts × proximité géographique (rayon 2 km)
+ 20 pts × trajet dans les 7 prochains jours
+ 10 pts × places disponibles
```

Implémentation : **fonction SQL PostgreSQL** `suggest_trips_for_user()` — aucun serveur applicatif nécessaire.

### Notifications push

| Événement | Destinataire | Délencheur |
|---|---|---|
| Nouvelle demande de place | Conducteur | Trigger SQL INSERT sur bookings |
| Demande acceptée | Passager | Trigger SQL UPDATE sur bookings |
| Demande refusée | Passager | Trigger SQL UPDATE sur bookings |
| Nouveau message | Interlocuteur | Trigger SQL INSERT sur messages |
| Trajet annulé | Tous les passagers | Trigger SQL UPDATE sur trips |
| Rappel 2h avant le trajet | Conducteur + passagers | Cron externe (futur) |

### Logique de sécurité pour les enfants

- Tableau admin `enfant → conducteur` pour chaque événement
- Téléphone du conducteur affiché **uniquement** après confirmation de réservation
- Signalement en un tap → notification immédiate à l'admin
- Journal d'audit de toutes les actions sensibles

### Trajets réguliers

- Règle de récurrence au format iCal (`RRULE:FREQ=WEEKLY;BYDAY=MO`)
- Occurrence générée à la demande (pas de cron job à maintenir)
- Passagers récurrents réinvités automatiquement chaque semaine

---

## 10. Roadmap produit

### MVP — Semaines 1 à 10

```
Semaines 1-2  : Configuration Supabase + Authentification
Semaines 3-4  : Création et liste des trajets
Semaines 5-6  : Réservations + Messagerie temps réel
Semaines 7-8  : Notifications push + Interface admin
Semaines 9-10 : Tests avec 10 familles pilotes + corrections
```

**Livrable MVP** : authentification, trajets ponctuels, réservations, messagerie, admin basique.

### V1.1 — 4 semaines après le MVP

- Matching intelligent (suggestions personnalisées)
- Trajets réguliers avec récurrence
- Gestion complète des événements et compétitions
- Import CSV des licenciés (admin)
- Rappels automatiques avant chaque trajet

### V1.2 — 4 semaines après V1.1

- Tableau de bord admin enrichi (statistiques détaillées)
- Système de signalement
- Historique des trajets par membre
- Validation des associations parent-enfant
- Mode hors-ligne (consultation des trajets sauvegardés)

### V2.0 — Long terme

- Carte interactive avec visualisation des itinéraires
- Export calendrier (iCal) des trajets confirmés
- Application web complémentaire (PWA)
- Statistiques d'usage pour le club
- Widgets iOS/Android (prochain trajet sur l'écran d'accueil)

---

## 11. Infrastructure et coûts

### Architecture zéro maintenance

Tous les services sont **entièrement managés** — aucun serveur à administrer.

| Service | Usage | Coût mensuel |
|---|---|---|
| Supabase Free | Base de données, Auth, Realtime, Storage | **0 €** |
| Expo EAS Free | Builds iOS/Android (30/mois), OTA updates | **0 €** |
| Expo Push Notifications | Notifications push illimitées | **0 €** |
| OpenStreetMap / Nominatim | Cartes et géocodage | **0 €** |
| Sentry Free | Monitoring erreurs (5 000/mois) | **0 €** |
| cron-job.org | Ping anti-pause Supabase (toutes les 72h) | **0 €** |
| **Apple Developer Program** | Publication App Store iOS | **~8 €/mois** |
| **Google Play Store** | Publication Android | **25 € (×1)** |

**Total récurrent : ~8 €/mois**  
**Coût année 1 : ~120 €**  
**Coût années suivantes : ~99 €/an**

*Soit moins de 0,07 €/licencié/an.*

### Capacités du plan gratuit Supabase

| Ressource | Limite | Usage estimé EGC |
|---|---|---|
| Stockage base de données | 500 MB | ~50 MB (1 600 users + trajets) |
| Stockage fichiers | 1 GB | ~160 MB (avatars) |
| Connexions Realtime simultanées | 200 | Pic estimé : 30-50 |
| Utilisateurs actifs/mois | 50 000 | 1 600 |

### Mesure anti-pause

Le plan Supabase gratuit met en pause les projets inactifs après 7 jours. Un ping automatique depuis **cron-job.org** (gratuit) toutes les 72 heures maintient le projet actif en permanence, y compris pendant les vacances scolaires.

### Évolutivité

Si le club atteint 5 000 membres ou souhaite des backups quotidiens automatiques, la migration vers **Supabase Pro (25 €/mois)** se fait en un clic depuis le dashboard, sans aucun changement de code.

---

## 12. Recommandations

### Bonnes pratiques appliquées

**Sécurité**
- Row Level Security sur toutes les tables (données isolées par utilisateur)
- Jamais de donnée sensible exposée publiquement
- Tokens JWT à expiration courte + refresh tokens rotatifs
- Téléphone masqué jusqu'à confirmation de réservation

**Fiabilité**
- Logique métier en base de données (triggers SQL) — pas de serveur custom à maintenir
- Services 100 % managés — pas de VPS, pas de patches de sécurité manuels
- Monitoring automatique (Sentry) — remontée des erreurs sans surveillance active

**Simplicité utilisateur**
- Maximum 3 taps pour une action principale
- Formulaire de création de trajet en 3 étapes guidées
- Point de départ "Devant le club" pré-sélectionné par défaut
- Interface distincte pour les administrateurs (accès web depuis le bureau)

### Risques identifiés et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Inscription d'un non-membre | Faible | Critique | Invitation uniquement, validation admin |
| Compte admin unique compromis | Faible | Critique | Plusieurs comptes admin, MFA recommandé |
| Pause Supabase en vacances | Moyenne | Élevé | Ping automatique cron-job.org |
| Perte de données | Faible | Élevé | Export manuel mensuel (pg_dump via dashboard) |
| Abandon par les conducteurs | Moyenne | Élevé | Onboarding guidé, max 3 étapes pour créer un trajet |
| Harcèlement via messagerie | Faible | Élevé | Signalement en 1 tap, logs admin, blocage rapide |

### Ce qu'il ne faut pas faire

- ❌ Ne pas implémenter de géolocalisation en temps réel (disproportionné + RGPD)
- ❌ Ne pas ouvrir l'inscription au public sans validation
- ❌ Ne pas stocker les mots de passe en clair (Supabase Auth gère cela via bcrypt)
- ❌ Ne pas héberger soi-même sans équipe technique dédiée
- ❌ Ne pas exposer les numéros de téléphone dans les listes publiques

### Checklist avant la mise en production

- [ ] Migrations SQL exécutées dans l'ordre (001, 002, 003)
- [ ] Adresse du club mise à jour dans `app_settings`
- [ ] Compte administrateur créé et testé
- [ ] Ping anti-pause configuré sur cron-job.org
- [ ] Variables d'environnement `.env` renseignées
- [ ] Test de connexion avec un compte licencié fictif
- [ ] Test de connexion avec un compte parent fictif
- [ ] Test complet du parcours réservation (de bout en bout)
- [ ] Test de la messagerie temps réel
- [ ] Compte Apple Developer activé (pour iOS)
- [ ] Compte Google Play créé (pour Android)
- [ ] Politique de confidentialité rédigée (obligatoire RGPD + stores)

---

*Document généré pour le projet EGC Covoiturage — Mai 2026*  
*Architecture : React Native + Expo SDK 54 + Supabase*
