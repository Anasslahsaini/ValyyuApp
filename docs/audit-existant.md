# Audit de l'existant — Valyyu-App

> Étape 1 du chantier de refonte. Aucune ligne de code modifiée.
> Date : 2026-10-19. Auteur : Claude Code, pour Rayan.

## Décisions validées par Rayan (2026-10-19)

| Sujet | Décision |
| --- | --- |
| Comptes | **Clerk** (voulu par Anass). Supabase Auth **n'est pas utilisé**. |
| Base + photos | **Supabase** (Postgres + Storage, région UE), branché sur Clerk en « third-party auth » pour la RLS. Remplace Neon et R2 dans les §8 et §9. |
| Dépôt | **Nouveau repo `Anasslahsaini/ValyyuApp`**, sans historique importé. `Valyyu-App` devient la référence en lecture seule. |
| Branches | `main` (protégée par Anass : PR + CI obligatoires), `develop` (intégration), une branche par lot → PR vers `develop`. |
| UI | Unistyles ou NativeWind : **décision reportée** au premier export Claude Design ; tokens au format neutre TS d'ici là. |
| Logo | Planche reçue : « valyyu » en minuscules, symbole « yy » (y clair = options, y plein = décision), 4 déclinaisons. Sources SVG à demander. |
| Données (K1) | **Option 2 : téléphone d'abord pour la V1** (SQLite local, 0 € de base). Toutes les lectures/écritures passent par une couche de données unique, tables identiques au futur schéma Postgres (UUID, `updatedAt`, suppression logique) pour brancher la synchro plus tard sans toucher aux écrans. Export/import manuel conservé. Règles critiques (mineurs, plafonds) testées dans `packages/domain`. L'API reste nécessaire (clé Gemini). |
| Push | **Rien n'est poussé, ni dans `ValyyuApp` ni ailleurs, jusqu'à nouvel ordre de Rayan.** |
| Communauté (posts, discussions) | **Dernier lot, après la fin de l'app. D'ici là : design seulement (emplacement prévu dans les maquettes), aucun code.** On réserve seulement sa place : un accès depuis l'en-tête de l'Accueil + un groupe de routes `(community)` désactivé par un flag. Contredit « Hors projet : fonctions communautaires » de `PROJET.md` §2 : à mettre à jour avec l'accord d'Anass. Arrivera avec le serveur (la communauté ne peut pas être locale). |

## 0. Périmètre et conditions de l'audit

| Point | Constat |
| --- | --- |
| Branche auditée | **`ameliorations`** (`0c27660`), et non `main`. C'est `main` + 20 commits, et c'est la seule branche qui contient `PROJET.md` et la table `valyyu_ai_usage` citée dans le prompt. `redesign-step1` (1 commit) est une version antérieure du même travail, remplacée par `ameliorations`. Les autres branches (`account-paywall-admin`, `feat/time-saving`, `rename-valyyu`…) sont déjà fusionnées dans `main` ou obsolètes. |
| `PROJET.md` | Présent sur `ameliorations` uniquement (+ `Valyyu-projet.pdf`, sa version PDF, même contenu). |
| `docs/brief/` + 13 maquettes | **Absents sur toutes les branches.** Le Google Drive n'était pas accessible (connecteur à ré-authentifier). L'écart code ↔ brief (§7) est donc établi à partir du **résumé du brief dans le prompt (§1)**, pas du brief lui-même. À refaire quand le brief sera là. |
| Environnement | Node **22.22** (le repo épingle **24** dans `.nvmrc`), pnpm 10.28.0. |

### Résultats réels des commandes

| Commande | Résultat |
| --- | --- |
| `pnpm i` | OK, 856 paquets, 15,9 s. Aucun avertissement bloquant. |
| `pnpm run typecheck` | **OK** (libs `tsc --build` + `api-server` + `valyyu`), exit 0. |
| `pnpm test` | **OK** : `check-dead-routes` ok, **API 77/77**, **app 371/371**, exit 0. |

Ces chiffres correspondent à ceux annoncés dans `PROJET.md` §6. Attention : ce sont des tests **`node:test` lancés avec `tsx`**, pas Vitest, et ils ne testent que la **logique pure** (voir §5).

---

## 1. Cartographie

### 1.1 Architecture

```
Valyyu-App/                  pnpm workspaces (artifacts/*, lib/*)  — layout du template monorepo Replit
├─ artifacts/valyyu          App Expo SDK 57, RN 0.86, React 19.2, expo-router, React Compiler (iOS/Android/web)
├─ artifacts/api-server      API Express 5, bundle esbuild, pino
├─ lib/api-spec              openapi.yaml (1 374 l.) + orval → génère :
├─ lib/api-zod               schémas zod des requêtes/réponses
├─ lib/api-client-react      hooks TanStack Query + client fetch
├─ lib/db                    Drizzle + pg (4 tables), drizzle-kit push
├─ lib/life-data             LifeSchema (zod) : le format de TOUTES les données utilisateur
├─ scripts/                  preinstall (garde pnpm), check-dead-routes
└─ tests/                    1 scénario E2E écrit à la main (markdown, non automatisé)
```

**Modèle fondamental : local-first.** Toutes les données de l'utilisateur (dressing, repas, séances, poids, profil) vivent dans **un seul objet JSON** (`LifeState`) stocké dans **AsyncStorage** sur le téléphone. Le serveur ne possède **aucune donnée métier** : il sert de proxy IA, de proxy météo/codes-barres, de stockage de sauvegarde (snapshot) et d'admin.

### 1.2 Flux de données

```
                ┌───────────────────────── App (téléphone) ─────────────────────────┐
  photo / voix →│ LifeContext (AsyncStorage, JSON unique)  ← moteurs locaux purs :   │
                │   planner repas, targets, outfit-engine, training, voice/intents  │
                └──────┬───────────────┬───────────────────┬────────────────┬───────┘
                       │ JWT Clerk     │ JWT Clerk          │ public         │ SDK
                       ▼               ▼                    ▼                ▼
                 /valyyu/agent   /valyyu/cloud (PUT     /valyyu/weather    RevenueCat
                 /coach/* /nutrition/*  snapshot entier,  /food/barcode     (achat in-app)
                 /assistant       base64 photos inclus)  /food/photo …
                       │               │                    │
                       ▼               ▼                    ▼
                 Gemini (REST)   Postgres jsonb      MET Norway / OFF / Pexels
                 + valyyu_ai_usage
```

- L'IA ne renvoie que des **propositions validées** (actions, suggestions) ; c'est l'app qui les applique, avec Annuler. Le serveur n'écrit rien.
- La synchro cloud est **manuelle et consentie** : l'app envoie tout le `LifeState` (≤ 10 Mo, photos du dressing en `data:` base64), avec compare-and-swap sur `revision`.
- L'abonnement est lu par le serveur via l'API REST v1 de RevenueCat (cache 60 s), **pas via webhooks**.

### 1.3 Tables Drizzle (`lib/db/src/schema`)

| Table | Clé | Contenu | Remarque |
| --- | --- | --- | --- |
| `valyyu_cloud_workspaces` | `user_id` (Clerk) | `revision`, `snapshot jsonb` (tout le LifeState), `updated_at` | Données de santé + photos en clair dans un jsonb. Pas de FK, pas de table métier. |
| `valyyu_app_settings` | `key` | valeur (chiffrée AES-256-GCM si secret), `updated_by` | Réglages modifiables depuis l'admin, prioritaires sur l'env. |
| `valyyu_change_requests` | `id` uuid | `kind`, `summary`, `payload` (chiffré si secret), statut, auteur, décideur | Règle des 2 admins + journal d'audit. |
| `valyyu_ai_usage` | (`user_id`, `month`, `bucket`) | coût en µ€, nb de requêtes | `user_id` peut valoir `ip:<adresse>` (adresse IP stockée). |

Aucune migration versionnée : seulement `drizzle-kit push` (et `push-force`).

### 1.4 Routes de l'API (`/api/...`)

| Route | Auth | Abonnement | Rôle |
| --- | --- | --- | --- |
| `GET /healthz` | — | — | santé |
| `GET /valyyu/config` | — | — | config publique (clés RevenueCat publiques, liens, message) |
| `GET /valyyu/weather` | — | — | MET Norway, coordonnées arrondies, cache |
| `GET /food/barcode/:ean` | — | — | Open Food Facts |
| `GET /food/photo`, `GET /style/photos` | — | — | Pexels (**absentes d'OpenAPI**) |
| `POST /valyyu/errors` | — | — | rapports de crash de l'app (texte libre) |
| `POST /valyyu/assistant` | optionnelle | si RC configuré | Gemini multimodal (texte, photos ≤ 3, audio), 14 Mo |
| `POST /valyyu/agent` | optionnelle | si RC configuré | micro : Gemini + function calling (15 outils) |
| `POST /valyyu/onboarding/profile` | **aucune** | **aucun** | premier lancement vocal → profil |
| `POST /valyyu/coach/programs` | optionnelle | **sauf si `onboarding: true`** | 3 programmes |
| `POST /valyyu/nutrition/picks` | optionnelle | **sauf si `onboarding: true`** | choix de recettes du catalogue |
| `POST /valyyu/nutrition/fridge-recipe` | optionnelle | si RC configuré | recette inventée depuis le frigo |
| `GET/PUT/DELETE /valyyu/cloud` | requise | si RC configuré | snapshot, CAS |
| `GET /valyyu/subscription` | requise | — | état du droit |
| `DELETE /valyyu/account` | requise | — | supprime snapshot + utilisateur Clerk |
| `/valyyu/admin/*` (14 routes) | requise + rôle | — | 404 si pas staff ; tableau de bord, utilisateurs, accès gratuits, offres RC, réglages, validations |

### 1.5 Écrans de l'app (`artifacts/valyyu/app`)

`sign-in` → `onboarding` → `paywall` → onglets `(tabs)` : **Accueil** (`index`), **Repas** (`meals` : 3 vues Frigo / Semaine / Journal), **micro central**, **Sport** (`fitness`), **Style** (`style`) ; plus `profile`, `account`, `my-info`, `achievements`, `admin`, `+not-found`.
Environ 22 000 lignes TS/TSX. État : 6 Context React (`Life`, `Preferences`, `CloudSync`, `Subscription`, `AppConfig`, `Voice`), pas de TanStack Query pour les données métier (elles sont locales). Tokens de couleurs dans `constants/theme.ts` (une source, déjà propre), textes dans `constants/strings.ts` + `voice-strings.ts` (i18n maison fr/en/ar).

---

## 2. Garder / refactorer / jeter

Légende : **G** garder tel quel · **R** refactorer · **J** jeter.

### API (`artifacts/api-server`)

| Module | Verdict | Raison |
| --- | --- | --- |
| `lib/auth.ts` (`requestAuth`, `privateOriginAllowed`) | **R** | Bonne base : identité tirée du JWT vérifié par `clerkMiddleware`, jamais du body. Ajouter `authorizedParties`, et un middleware `requireUser` unique au lieu de 4 variantes. |
| `lib/config.ts`, `logger.ts`, `app.ts` (handler JSON d'erreurs, CORS, limites de body par route, logs sans query string) | **G/R** | Sain. Ajouter en-têtes de sécurité (helmet), `requestId`, Sentry, et une validation d'env au démarrage (zod) qui **refuse de démarrer en prod** sans les clés critiques. |
| `routes/cloud.ts` (CAS sur `revision`, tombstone) | **R** | Le mécanisme de concurrence est exemplaire et sera réutilisé. Le format (un blob jsonb de 10 Mo avec photos base64) est à remplacer (voir §9). |
| `lib/approvals.ts` (règle des 2 admins, « claim » atomique `UPDATE … WHERE status='pending'`, purge des secrets après décision) | **G** | Bien pensé, testé. À déplacer dans une transaction SQL et à compléter (cf. sécurité E6). |
| `lib/settings.ts` (réglages admin chiffrés AES-GCM) | **R** | Fonctionne, mais modifier des **clés secrètes de prod depuis un téléphone** est un risque (§3). À restreindre aux réglages non-secrets ; secrets dans le gestionnaire de l'hébergeur. |
| `lib/ai-budget.ts` (estimation coût, mode éco, plafond, essai) | **G/R** | Logique pure bien testée. Corriger le *fail-open* et la course check→call→record (réservation atomique). |
| `middlewares/ai-guard.ts` | **R** | Interface `AiUsageStore` prévue, mais implémentation mémoire, **une instance par route**. Passer sur Postgres (ou Redis) partagé. |
| `middlewares/subscription.ts` | **R** | Fail-open si clé RevenueCat absente. Remplacer par une table `entitlements` alimentée par webhook + lecture REST en secours. |
| `lib/revenuecat.ts`, `revenuecat-offers.ts` | **R** | Client REST correct. Ajouter le récepteur de webhooks (signature + idempotence). |
| `routes/agent.ts`, `coach.ts`, `lib/agent-tools.ts`, `lib/coach-ai.ts`, `lib/valyyu-response.ts` | **R** | Bonne idée (l'IA propose, l'app exécute ; sorties validées). Unifier en **un seul client Gemini** (retry, timeout, coût, validation **zod** partout au lieu de validateurs écrits à la main). |
| `routes/valyyu.ts` (`/assistant`) | **R** | Route la plus coûteuse (images, 14 Mo) et **non comptée dans le budget IA**. À fusionner dans le client Gemini commun. |
| `lib/met-weather.ts`, `open-food-facts.ts`, `lru-cache.ts`, `style-photos.ts`, `routes/recipe-photo.ts` | **G** | Petits, testés, respectent les CGU (User-Agent, arrondi, cache, crédits Pexels). Ajouter les routes Pexels à OpenAPI. |
| `lib/monitor.ts` + `POST /valyyu/errors` | **J** | Remplacé par Sentry (dédoublonnage, symbolication, scrubbing PII). |
| `middlewares/clerkProxyMiddleware.ts` | **J** | Code de template (Cloud Run/Replit), inutile avec un domaine Clerk standard. |
| `routes/account.ts` (admin) | **R** | Découper (`admin/users`, `admin/offers`, `admin/settings`), et minimiser les données exposées aux sous-admins. |

### Bibliothèques partagées

| Module | Verdict | Raison |
| --- | --- | --- |
| `lib/api-spec` + orval → `api-zod`, `api-client-react` | **G** | Le contrat OpenAPI et la génération sont exactement ce qu'on veut. |
| `lib/life-data` (LifeSchema) | **R** | Schéma zod riche et borné : excellente base pour les **tables** Postgres et les DTO. Le concept « un seul document » disparaît. |
| `lib/db` | **R** | Garder Drizzle ; remplacer `push` par `drizzle-kit generate` + `migrate`, retirer `push-force`, retirer le commentaire de template. |

### App (`artifacts/valyyu`)

| Module | Verdict | Raison |
| --- | --- | --- |
| `lib/mealplan/*`, `lib/targets.ts`, `lib/nutrition.ts`, `lib/outfit-engine.ts`, `lib/training/*`, `lib/streak.ts`, `lib/achievements.ts`, `lib/grocery-builder.ts`, `lib/pantry-match.ts`, `lib/wear.ts` | **G → déplacer** | C'est le vrai capital du projet : logique métier pure, testée (371 tests). À déplacer dans un paquet `packages/domain` partagé app + API, pour que les règles critiques (mineurs, plafonds) tournent **aussi côté serveur**. |
| `lib/voice/*` (parseur local d'intentions FR/EN/AR, exécution avec Annuler) | **G → déplacer** | Utile hors-ligne et en mode « sans IA ». |
| `data/` (242 recettes, free-exercise-db, USDA) + `scripts/build-recipes.mjs` | **G** | Données vérifiées, licences documentées. |
| `constants/theme.ts` | **R** | Une seule source de couleurs : bon point de départ pour `packages/ui/tokens`. Manquent typo, espacements, tailles, ombres. |
| `constants/strings.ts`, `voice-strings.ts`, `i18n.ts` | **R** | i18n maison sans pluriels ni interpolation standard ; passer à i18next/ICU, garder les traductions. |
| `app/*`, `components/*` (tous les écrans) | **J** | Ta demande. Constats qui confirment : écrans de 400 à 600 lignes, logique dans le JSX, 33 `accessibilityLabel` pour 95 boutons, pas de tests de composants. |
| `hooks/*Context.tsx` (6 contextes) | **J** | Remplacés par TanStack Query (données serveur) + un petit store Zustand (UI). |
| `lib/purchases*.ts`, `lib/auth.ts`, `lib/remote-config.ts` | **R** | Réutilisables à condition de les isoler derrière des hooks. |
| `lib/legacy-storage.ts`, `life-backup.ts`, `export-life.ts`, `restore-cloud-media.ts`, `cloud-photos.ts`, `wardrobe-media.ts` | **J** | Liés au modèle « snapshot local ». Remplacés par l'API + stockage objet. |
| `server/serve.js`, `metro.config.js` (proxy `/api`), `http-proxy-middleware` en dépendance de l'app | **J** | Sert la version web ; le web n'est pas une cible (voir questions). |
| `components/BodyMap.tsx`, `ExercisePhotoCache` | **R** | Fonctionnels, à reconstruire dans `packages/ui`. |

---

## 3. Sécurité

Référentiels : OWASP API Security Top 10 (2023), OWASP MASVS v2.

### Critique

**C1 — Contournement du paywall par un champ du body** (API1/API5, BOLA/BFLA)
`coach.ts:447` : `subscriptionUnlessFirstLaunch` saute le contrôle d'abonnement si `req.body.onboarding === true`. Ce champ est fourni par le client. Résultat : n'importe qui, **même non connecté**, appelle `/coach/programs` et `/nutrition/picks` sans payer. Le budget utilisé est alors celui de l'identité « IP ».
→ L'état « premier lancement » doit venir du serveur (profil non complété en base), jamais du body.

**C2 — IA appelable sans compte, coût non borné** (API4 consommation de ressources, API6)
`/valyyu/onboarding/profile` n'a ni auth ni abonnement (`coach.ts:453`). `/assistant`, `/agent`, `/fridge-recipe` acceptent aussi les anonymes tant que RevenueCat n'est pas configuré. Le budget anonyme est par IP (0,50 € / mois / IP pour l'onboarding) : en changeant d'IP, la dépense Gemini n'a pas de limite. De plus, **`/assistant` n'enregistre aucun coût** dans `valyyu_ai_usage` (seul le compteur de requêtes mémoire s'applique), alors que c'est la route la plus chère (images + 8 192 tokens de sortie).
→ Toute route IA exige un JWT Clerk. L'onboarding exige un compte (c'est déjà l'ordre des écrans : connexion → premier lancement).

**C3 — Fail-open de la sécurité selon la configuration** (API8 mauvaise configuration)
- `subscriptionsEnforced() = REVENUECAT_SECRET_KEY !== ''` : si la clé est vide (oubli, ou **vidée depuis la page admin**), toutes les routes payantes s'ouvrent, y compris aux anonymes. Rien n'empêche ce mode en production.
- `agent.ts:268`, `coach.ts:357` : si la vérification du budget plante → `allowed: true`.
- `DbAiBudgetStore` : sur erreur DB, bascule silencieusement en mémoire (compteurs à zéro).
→ En production, toute erreur de contrôle = refus (503), et le serveur refuse de démarrer sans les clés de contrôle.

### Élevé

**E1 — Rate limiting inefficace** : `aiGuard()` crée un `MemoryAiUsageStore` **à chaque appel**, donc un compteur séparé pour chacune des 5 routes IA (limites × 5), par instance, remis à zéro à chaque redémarrage. Aucune limite sur `DELETE /account`, les routes admin, ni les routes publiques (météo, Pexels, OFF) qui peuvent servir de relais et épuiser nos quotas tiers.

**E2 — Course sur le budget IA** : lecture du cumul → appel Gemini (jusqu'à 45 s) → écriture. Des requêtes parallèles dépassent le plafond. → Réservation atomique (`UPDATE … SET reserved = reserved + estimate WHERE spent + reserved < cap RETURNING`) puis régularisation.

**E3 — Suppression de compte incomplète** (RGPD art. 17, règle Apple 5.1.1(v))
`DELETE /valyyu/account` supprime le snapshot puis l'utilisateur Clerk. Restent : les lignes `valyyu_ai_usage`, le **client RevenueCat** (à supprimer via l'API), et les **e-mails/téléphones écrits en clair dans `change_requests.summary`** (« Accès gratuit 1 mois pour jean@… »). Pas transactionnel : si Clerk échoue après la suppression en base, le message « Nothing was removed » est faux.

**E4 — Données de santé non protégées** (MASVS-STORAGE, RGPD art. 9 et 32)
Sur le téléphone : poids, âge, sexe, blessures, journal alimentaire en clair dans AsyncStorage (pas de chiffrement, sauvegardé dans iCloud/Google Backup). Sur le serveur : même chose en jsonb, photos comprises. Ces données partent aussi vers Gemini (`workspaceContext`, `injuries`, profil).

**E5 — Compte admin = clés de la prod depuis un téléphone**
Un admin peut changer la clé Gemini, la clé RevenueCat, la liste des admins, depuis l'app. Avec **un seul admin**, aucun second contrôle ; avec la connexion par SMS active, le compte admin est vulnérable au SIM-swap. Pas de MFA exigée, pas de re-authentification (step-up) avant une action sensible.
→ Secrets dans l'hébergeur uniquement ; admin protégé par MFA Clerk obligatoire + session récente ; idéalement admin en web séparé, pas dans l'app grand public.

**E6 — Règle des 2 admins : angles morts**
- Avec 1 admin, il peut s'ajouter un second admin « complice » directement (pas de validation), puis faire valider ce qu'il veut.
- Les rôles viennent du cache des réglages, rafraîchi toutes les 60 s : un admin retiré garde l'accès jusqu'à 60 s sur les autres instances.
- `execute()` n'est pas dans une transaction avec la mise à jour du statut ; un crash entre les deux laisse une demande bloquée en `applying`.

### Moyen

- **M1** `POST /valyyu/errors` anonyme accepte du texte libre (500 car.) affiché aux sous-admins : risque de PII et de pollution. → Sentry avec scrubbing.
- **M2** Les **sous-admins** voient e-mail, téléphone et fournisseurs de connexion de tous les comptes (minimisation, art. 5.1.c).
- **M3** `clerkMiddleware` sans `authorizedParties` : le claim `azp` n'est pas imposé. Pour une app native ce n'est pas exploitable directement, mais c'est la recommandation Clerk.
- **M4** Pas d'en-têtes de sécurité (helmet), `ALLOWED_ORIGINS=*` accepté avec `credentials: true`.
- **M5** Règle des mineurs **uniquement côté client** (`lib/targets.ts`). Le serveur ne connaît pas l'âge : `/nutrition/picks` avec `goal: lose` et l'outil vocal `set_targets` (calories libres) peuvent produire un déficit pour un mineur.
- **M6** Pas de migrations versionnées ; `PROJET.md` demande de lancer `db push` en production.
- **M7** `valyyu_ai_usage.user_id = ip:<adresse>` : adresse IP stockée sans durée de conservation.

### Faible / bonnes pratiques déjà en place (à conserver)

- JWT Clerk vérifié par le SDK officiel, identité jamais lue dans le body ✅
- Clés secrètes (Gemini, Pexels, RevenueCat secret) uniquement côté serveur ✅ ; la clé publique RevenueCat est envoyée par `/config` (normal).
- Logs pino sans query string ni corps ; corps d'erreur Gemini jamais logués ✅
- Entrées validées par zod généré depuis OpenAPI ✅ ; sorties IA filtrées (IDs autorisés, bornes) ✅
- CAS sur la synchro, « claim » atomique des validations, secrets purgés après décision ✅
- Proxy Clerk : prend le premier `X-Forwarded-Host` (falsifiable) pour construire `Clerk-Proxy-Url` si `CLERK_PROXY_URL` n'est pas défini. Désactivé par défaut ; à supprimer avec le module.

### Points demandés spécifiquement

| Sujet | État |
| --- | --- |
| Vérification JWT Clerk | ✅ correcte (via `@clerk/express`), à compléter (`authorizedParties`, middleware unique). |
| Contrôle d'accès par ressource | ✅ pour la seule ressource existante (snapshot filtré par `userId` du token). Sera critique avec des tables métier : à garantir par construction (repository qui prend toujours `userId`) + tests. |
| Secrets | ✅ jamais commités (`.env.example` seulement). ⚠️ modifiables depuis l'app (E5). |
| Webhooks RevenueCat | ❌ **absents**. Vérification par appel REST v1 avec cache 60 s. C'est une vérification serveur valable, mais sans historique, sans réaction aux remboursements en temps réel, et dépendante de la disponibilité de RevenueCat à chaque requête. |
| Page admin + règle des 2 admins | ✅ implémentée et testée, ⚠️ E5, E6, M2. |
| Appels IA | ⚠️ C1, C2, C3, E1, E2. |
| Upload de photos | ⚠️ pas de stockage objet : photos en base64 dans le JSON (jusqu'à 2 Mo par vêtement, 10 Mo au total), aucun contrôle de type réel (seulement le préfixe `data:image/...`), aucune suppression EXIF/GPS. |

---

## 4. RGPD et santé

### Où sont les données sensibles

| Donnée | Catégorie | Où | Vers qui |
| --- | --- | --- | --- |
| Poids, taille, âge (année de naissance), sexe | santé / art. 9 (poids, IMC) | AsyncStorage, snapshot jsonb | Gemini (contexte) |
| Blessures / douleurs | **santé, art. 9** | AsyncStorage, snapshot | Gemini (`injuries`) |
| Journal alimentaire, régime, allergies | santé (allergies) / pouvant révéler religion (halal…) | AsyncStorage, snapshot | Gemini |
| Photos du dressing | personnelle (peut contenir visage, EXIF GPS) | base64 dans snapshot | Gemini (si envoyée) |
| Voix | personnelle | **non stockée** ✅ (envoyée à Gemini pour la requête seulement) | Gemini |
| Position | personnelle | arrondie avant MET Norway ✅ | MET Norway |
| E-mail, téléphone | identité | Clerk ; recopiés dans `change_requests.summary` ⚠️ | Clerk, admins, sous-admins |
| Adresse IP | identifiant | `valyyu_ai_usage` ⚠️ | — |

### Ce qui manque

1. **Consentement explicite art. 9** séparé (case non pré-cochée, retirable) avant toute saisie de poids, blessures, photo du corps. Aujourd'hui : un consentement « IA » unique et un consentement « synchro ». Retirer le consentement doit effacer les données concernées.
2. **Registre des traitements** et **AIPD** (analyse d'impact) : obligatoire pour des données de santé à grande échelle (art. 35).
3. **Durées de conservation** : aucune (ni pour les comptes inactifs, ni pour `ai_usage`, ni pour le journal d'audit).
4. **Export complet** côté serveur (art. 15/20) : il existe un export local (`export-life.ts`), rien côté serveur.
5. **Suppression complète** : voir E3 (RevenueCat, ai_usage, audit log, futures photos en stockage objet).
6. **Chiffrement** au repos des données de santé (chiffrement applicatif par colonne ou au minimum chiffrement disque géré + accès restreint) ; chiffrement local (SecureStore pour la clé, base locale chiffrée).
7. **Politique de confidentialité, CGU, page support** : non rédigées (TODO fondateurs dans `PROJET.md`).
8. **Transferts hors UE** : Clerk, RevenueCat, Google (Gemini) sont américains → DPA + clauses contractuelles types / Data Privacy Framework à vérifier pour chacun. **Gemini : seul le niveau payant garantit que les données ne servent pas à l'entraînement** (déjà prévu dans `PROJET.md` §4 ✅).
9. **Mentions santé** : présentes dans les prompts (« never diagnose », « estimation ») ✅ ; à rendre systématiques dans l'UI (composant unique `HealthDisclaimer`).

### Sous-traitants actuels

| Sous-traitant | Rôle | Données | Localisation |
| --- | --- | --- | --- |
| Clerk | comptes | e-mail, téléphone, IdP Google/Apple | US |
| RevenueCat | abonnements | ID Clerk, achats | US |
| Google (Gemini API) | IA | texte, voix, photos, contexte santé | US (région non choisie) |
| Hébergeur API + Postgres | non choisi | tout le snapshot | à choisir (UE recommandé) |
| Pexels, MET Norway, Open Food Facts | contenus publics | requête (nom de plat, coordonnées arrondies, code-barres) | CA / NO / FR |
| Apple / Google (stores, push) | paiement, notifications | — | US |

---

## 5. Qualité

### Tests : couverture réelle

- **448 tests**, tous verts, tous sur de la **logique pure** (planner, cibles, moteur de tenues, parseur vocal, budget IA, validations des réponses IA, règle des 2 admins en fonction pure).
- **Aucun** test de route HTTP (supertest), **aucun** test SQL/base, **aucun** test de composant React Native, **aucun** E2E automatisé (`tests/valyyu-cloud-sync.e2e.md` est une procédure manuelle).
- Pas de mesure de couverture. Lanceur `node:test` + `tsx` (pas Vitest comme demandé).
- Les failles C1–C3 n'auraient été attrapées que par des tests de route.

### Outillage

| Élément | État |
| --- | --- |
| CI | ❌ aucun `.github/workflows` |
| ESLint | ❌ absent |
| Prettier | installé, aucune config, non appliqué |
| Node | `.nvmrc` = 24 ✅ (mais `@types/node` ^25, et la CI n'existe pas pour l'imposer) |
| TypeScript | **5.9** à la racine et dans l'API, **6.0** dans l'app : deux versions dans le même monorepo |
| EAS | ❌ pas de `eas.json`, pas de `bundleIdentifier` / `package` Android |
| Observabilité | monitor maison en mémoire, pas de Sentry |

### Dépendances à surveiller

- **Toutes les dépendances de l'app sont en `devDependencies`** (fonctionne avec Expo, mais trompeur et casse certains outils d'audit).
- `babel-plugin-react-compiler@19.0.0-beta-…-20250117` : bêta de janvier 2025 alors que le compilateur est stable depuis ; à aligner sur la version recommandée par le SDK Expo.
- `expo-speech-recognition` (communautaire, jamsch) : maintenu et utilisé, mais hors SDK Expo ; à garder sous surveillance.
- `http-proxy-middleware` dans l'app et l'API : uniquement pour le proxy Clerk/web, à retirer.
- `tiny-inflate` + `png-pixels.ts` : décodage PNG maison pour la couleur dominante des vêtements ; à remplacer quand la segmentation sera faite (§7).
- Pas de `pnpm audit` en CI. Bon point : `minimumReleaseAge: 1440` et overrides de sécurité (esbuild, js-yaml) ✅.

### Traces de Replit

Largement nettoyées (`feat/time-saving` a retiré les notes d'agent). Restent : la structure `artifacts/*` + `lib/api-*` (template monorepo Replit), le commentaire de template dans `lib/db/src/schema/index.ts`, `clerkProxyMiddleware.ts` (pensé pour l'edge Cloud Run des déploiements Replit), `server/serve.js`, la mention `@replit/connectors-sdk` dans `THIRD_PARTY_LICENSES.md`.

### Dette technique principale

1. Modèle « un seul document JSON » : impossible de faire du contrôle d'accès fin, des requêtes, de la pagination, des photos en stockage objet, de l'export partiel, des règles serveur (mineurs).
2. Règles critiques côté client uniquement.
3. Écrans monolithiques (logique + rendu), accessibilité partielle (≈ 1 label pour 3 boutons).
4. Deux canaux IA proches (`/assistant` générique et `/agent` + routes spécialisées) avec du code de retry/coût dupliqué.

---

## 6. Écart entre le code et le brief (résumé du prompt)

| Fonction du brief | Dans le code | État |
| --- | --- | --- |
| Dressing photographique | photos brutes, classées par catégorie, couleur dominante | 🟡 partiel |
| **Vêtements détourés** | aucun ; le prompt Gemini dit explicitement « not generated cut-outs » | 🔴 absent |
| Tenue du jour météo + contexte | `outfit-engine` + MET Norway | 🟢 |
| Remplacer une seule pièce | `swapPiece()` | 🟢 |
| Enregistrer / planifier une tenue, historique | `outfits.date`, `wornOn`, `wearCount` | 🟢 |
| Coiffure, grooming | — | ⚪ plus tard (brief) |
| Photo du frigo → recettes | photos via `/assistant` (pantry), recette inventée en texte via `/fridge-recipe` | 🟡 pas de parcours dédié photo → recettes |
| **Photo d'un repas → calories/macros modifiables** | possible via `/assistant` générique (meals estimés, `unknownNutrients`) | 🟡 pas de parcours dédié ni d'écran d'édition |
| Journal alimentaire | oui (+ USDA, OFF, codes-barres) | 🟢 |
| Repas de la semaine | planner + catalogue 242 recettes + IA « picks » | 🟢 |
| Courses selon budget (cocher, remplacer, retirer) | grocery-builder, budget | 🟢 (remplacer : à vérifier) |
| Fitness : objectif/niveau/temps/matériel par vocal → programme | onboarding vocal + `/coach/programs` | 🟢 |
| Séance utilisable (séries, reps, charges, repos) | oui, progression auto, minuteur, log vocal | 🟢 |
| **Remplacer un exercice** | seulement « régénérer » la séance | 🟡 |
| Progression visuelle | `ExerciseProgressList`, BodyMap, poids | 🟢 |
| Photo du corps facultative (non médicale) | absente ; le prompt IA interdit d'en déduire la composition | 🔴 absent |
| **« Ma journée »** (un bouton qui relie les domaines, conseils croisés) | Accueil = résumé repas/séance/tenue + série | 🟡 pas de moteur de liens entre domaines ni de bouton dédié |
| Rappels actionnables | 2 notifications max, 1 par jour, non actionnables | 🟡 |
| **Récap du soir « demain est prêt »** | — | 🔴 absent |

---

## 7. Contradictions à trancher (je ne tranche pas)

| # | Sujet | `PROJET.md` | Brief / prompt | Code |
| --- | --- | --- | --- | --- |
| K1 | **Où vivent les données** | « garde-robe en photos », synchro manuelle (README : « data stays on the device ») | stockage objet privé, URLs signées, export/suppression serveur « photos comprises » | local-first, snapshot JSON |
| K2 | **Design** | « validé, on améliore, on ne refait pas » | refonte du front | — |
| K3 | **Notifications** | 2 max, **1 par jour au plus** | rappels actionnables **+ récap du soir** | 1/jour |
| K4 | **Dressing détouré** | non mentionné | détourage demandé | refus explicite dans le prompt IA |
| K5 | **Photo du corps** | non mentionnée | facultative, jamais médicale | interdit d'analyser le corps |
| K6 | **Base de données en prod** | « lancer `db push` en production » | migrations versionnées, pas de push | push seulement |
| K7 | **Tests sur téléphone** | Expo Go | development builds EAS (RevenueCat, Clerk natif, micro) | dépend d'Expo Go (garde-fous `fix-expo-go-voice`) |
| K8 | **Branches** | `main` intouchable, tout sur `ameliorations`, « c'est le fondateur qui fusionne » | branche ou repo de refonte à proposer | `ameliorations` non fusionnée |
| K9 | **Nom** | Valyyu partout (fiche App Store « Valyyu : repas, sport, style », `com.valyyu.app`) | nom non figé (Vayylo, ayylo, Bien.) | « Valyyu » codé en dur dans app.json, textes, User-Agent, clés AsyncStorage |
| K10 | **Promesse** | « Ta journée prête en 1 touche : repas, sport, style » | « Tu expliques ou tu montres. L'app prépare… » | — |
| K11 | **Offre « Moins de 26 ans »** | proposée à 49,99 €/an | — | les stores ne vérifient pas l'âge : offre non contrôlable proprement |
| K12 | **Gestion des clés** | « mettre les clés Gemini et Pexels dans la page admin » | secrets côté serveur, normes | possible depuis l'app (E5) |
| K13 | **Web** | « iOS, Android, web » | app mobile | web exporté, mais paywall impossible sur web |

---

## 8. Stack finale proposée

Partie de ton §3. ✅ = j'adopte ta proposition, ⚠️ = j'ajuste, ❌ = je conteste.

| Couche | Choix | Pourquoi / désaccord |
| --- | --- | --- |
| Monorepo | ✅ pnpm workspaces, TS `strict`, Node 24 LTS (`.nvmrc`), **une seule version de TypeScript** | Déjà en place. |
| Orchestration | ⚠️ ajouter **Turborepo** (MIT, Vercel, très actif) | Cache des tâches typecheck/test/build en CI ; optionnel, on peut s'en passer au début. |
| App | ✅ Expo SDK 57 (à jour), expo-router, **EAS development builds** | Indispensable pour RevenueCat, Clerk natif, micro. Expo Go abandonné (K7). |
| Données serveur | ✅ TanStack Query (client orval déjà généré) | |
| État local | ✅ Zustand, seulement l'UI (brouillons, onglets) | |
| Formulaires | ✅ react-hook-form + zod (schémas partagés depuis `packages/contracts`) | |
| UI | ⚠️ voir les 2 options ci-dessous | |
| Animations / images / listes | ✅ Reanimated 4 (déjà), expo-image (déjà), **FlashList v2** (Shopify, MIT) | |
| i18n | ⚠️ **i18next + react-i18next + expo-localization** (MIT, très actifs), ICU pour les pluriels, RTL via `I18nManager` | Remplace l'i18n maison ; on garde les textes FR/EN/AR existants. |
| Hors-ligne | ⚠️ **persistance du cache TanStack Query** (`@tanstack/query-async-storage-persister` + mutations en file) | On passe en serveur-first sans perdre l'usage hors-ligne (cuisine, salle de sport). Pas de base locale complexe au départ. |
| Stockage local sensible | ⚠️ expo-secure-store pour les jetons (Clerk le fait), cache chiffré pour les données santé | |
| API | ✅ **Express 5 conservé** | Pas de raison forte de migrer vers Hono/Fastify : le code existant est sain, l'écosystème est connu, les gains de perf sont inutiles ici. |
| Contrat | ✅ OpenAPI → orval (zod + client React Query), déjà en place ; ajouter les routes manquantes | |
| Base | ✅ PostgreSQL + Drizzle, **`drizzle-kit generate` + `migrate`**, plus de `push` | |
| Isolation des données | ⚠️ **repository obligatoire `forUser(userId)`** + tests d'autorisation par route ; RLS Postgres en défense en profondeur (session `SET app.user_id`) | Comme Maison Baalbek : la règle ne dépend pas du handler. |
| Photos | ⚠️ **Cloudflare R2** (S3, pas de frais de sortie, région UE disponible, ~0,015 $/Go/mois), upload direct par **URL présignée PUT** courte (5 min), lecture par URL présignée GET (≤ 15 min), clés `users/{userId}/…`, suppression EXIF côté app avant envoi | Supabase Storage est aussi valable si on prend Supabase Postgres ; R2 reste indépendant de l'hébergeur. |
| Détourage | ⚠️ à décider : **sur l'appareil** (iOS VisionKit « subject lifting » / Android ML Kit Subject Segmentation, via un module Expo natif) = gratuit et privé, ou serveur (modèle open source type BiRefNet/rembg) | Question ouverte, impacte le coût et la vie privée. |
| IA | ✅ Gemini côté serveur uniquement, un **client unique** (timeout, retry, coût, réservation de budget, sortie validée par **zod**), Vertex AI région UE à étudier | Vertex permet de choisir la région de traitement (RGPD). |
| Abonnements | ✅ RevenueCat ; **webhook signé** (en-tête `Authorization` partagé) → table `entitlements` + `rc_events` (idempotence par `event.id`) ; lecture REST en secours | |
| Auth | ✅ Clerk (`@clerk/expo` natif, `@clerk/express`), `authorizedParties`, MFA obligatoire pour les admins | |
| Qualité | ✅ **Vitest** (API + domain + contrats), **supertest** pour les routes, **Testcontainers Postgres** pour les tests SQL, jest-expo + RNTL pour l'app, **Maestro** E2E, ESLint 9 flat config + typescript-eslint + eslint-plugin-react-native-a11y, Prettier | Migration des 448 tests `node:test` vers Vitest : quasi mécanique. |
| CI | ✅ GitHub Actions : install → typecheck → lint → tests → build API → `expo-doctor` ; `pnpm audit` ; EAS Build déclenché à la main au début | |
| Observabilité | ✅ Sentry (app : `@sentry/react-native` ; API : `@sentry/node`), `beforeSend` qui retire PII et corps ; pino avec `requestId`, `userId` haché | |
| Hébergement | voir ci-dessous | |

### UI : deux options sérieuses

| | **A. Unistyles 3** (StyleSheet + thème typé) | **B. NativeWind 4** (Tailwind) |
| --- | --- | --- |
| Principe | `StyleSheet.create((theme) => …)` avec tokens TS, variantes, breakpoints, RTL | classes Tailwind (`className="bg-paper p-4"`) compilées |
| Perf | C++ / Nitro, pas de re-render au changement de thème | bonne, passe par un runtime CSS-interop |
| Tokens | un objet TS = source unique, typé, facile à générer depuis Claude Design | `tailwind.config` = source unique ; proche de ton habitude Tailwind/shadcn |
| Risques | lib d'une petite équipe (Margelo/jpudysz), exige New Architecture (OK avec SDK 57) | v4 stable, v5 en cours de refonte ; certains styles RN (ombres, `Animated`) moins naturels |
| Licence | MIT | MIT |
| Ma reco | ✅ **A** : tokens typés, natif pur, accessibilité et grandes tailles de texte plus simples à maîtriser | B si tu veux maximiser la vitesse d'itération avec l'ami (classes lisibles dans les maquettes). |

### Hébergement : deux options (coût de départ réaliste)

| | **Option 1 : Railway + Neon** | **Option 2 : Fly.io + Supabase Postgres** |
| --- | --- | --- |
| API | Railway, service Docker, région UE (Amsterdam), ~5–10 $/mois au départ | Fly.io, 2 machines `shared-cpu-1x` 512 Mo en `cdg` (Paris), ~6–10 $/mois |
| Base | Neon (Francfort), plan Launch ~19 $/mois (branches de preview, PITR) ; gratuit possible en dev | Supabase Pro 25 $/mois (Francfort), sauvegardes quotidiennes ; Storage inclus (pourrait remplacer R2) |
| Total départ | **~25–30 $/mois** | **~30–35 $/mois** |
| + R2 | quelques centimes au début | idem ou Supabase Storage |
| Pour | le plus simple à opérer, déploiement depuis GitHub | latence Paris, Supabase familier pour toi (RLS) |
| Contre | moins de contrôle réseau | Fly demande un peu plus d'ops |

Ma reco initiale : **Option 1**. **Décision finale : Supabase** (voir l'encadré en tête), l'API restant chez un hébergeur Docker en UE (Railway ou Fly.io, à choisir au lot 2) ; aucune ne bloque une migration plus tard (Postgres standard, Docker). Aucun service payant ne sera créé sans ton accord.

---

## 9. Architecture cible du monorepo

```
valyyu/                              (nom de dossier libre ; nom produit dans packages/config)
├─ apps/
│  ├─ mobile/                        Expo + expo-router — écrans = composition ui + hooks
│  │  ├─ app/                        routes (auth), (onboarding), (tabs)/{today,meals,mic,fitness,style}, settings, paywall
│  │  ├─ features/<domaine>/         hooks de données (TanStack Query), écrans, sans logique métier
│  │  ├─ e2e/                        flows Maestro
│  │  └─ app.config.ts               lit packages/config (nom, slug, bundle id)
│  └─ api/                           Express 5
│     ├─ src/http/                   routes par domaine, middlewares (auth, rate limit, errors)
│     ├─ src/modules/<domaine>/      service + repository (toujours scoped userId)
│     ├─ src/integrations/           gemini, revenuecat (+ webhook), clerk, r2, met, off, pexels
│     └─ test/                       supertest + Testcontainers
├─ packages/
│  ├─ config/                        APP_NAME, slug, bundleId, scheme, URLs légales — LA source du nom
│  ├─ contracts/                     openapi.yaml → zod + client React Query (ex lib/api-*)
│  ├─ domain/                        logique pure partagée app + API (ex artifacts/valyyu/lib/*) : targets, mineurs, planner, outfit, training, voice
│  ├─ db/                            Drizzle schema + migrations SQL versionnées + seeds
│  ├─ ui/                            tokens (couleurs, typo, espaces, rayons, ombres) + composants accessibles
│  ├─ i18n/                          ressources fr/en/ar + config i18next
│  └─ tsconfig/, eslint-config/      configs partagées
├─ docs/                             audit, ADR (décisions d'architecture), RGPD (registre, sous-traitants), brief/
├─ .github/workflows/ci.yml
├─ PROJET.md  README.md
```

---

## 10. Découpage en lots

Chaque lot = une branche, une PR vers la branche d'intégration, `brainstorming` → `writing-plans` → TDD → revue.

| Lot | Contenu | Définition de terminé |
| --- | --- | --- |
| **0. Décisions** | Réponses aux questions §11, stratégie Git, choix UI et hébergement, ADR 0001–0005 | ADR écrits et validés ; `PROJET.md` mis à jour |
| **1. Socle repo** | Nouvelle arborescence, `packages/config` (nom en 1 ligne), TS strict unique, ESLint/Prettier, Vitest, CI GitHub Actions, migration des 448 tests vers Vitest, `packages/domain` extrait | CI verte (typecheck, lint, tests) sur la PR ; changer `APP_NAME` change nom, slug, bundle id |
| **2. API socle + sécurité** | Validation d'env (refus de démarrer en prod), helmet, requestId, Sentry API, middleware `requireUser` (Clerk + `authorizedParties`), rate limiting Postgres partagé, client Gemini unique avec réservation de budget, correction C1–C3, E1, E2 | Tests de route qui prouvent : 401 sans token, 402 sans droit, pas de bypass `onboarding`, 429 au plafond, refus si contrôle en erreur |
| **3. Base + migrations** | Schéma relationnel (profil, consentements, wardrobe_items, outfits, meals, recipes, pantry, groceries, workouts, sessions, weights, entitlements, rc_events, ai_usage, audit), migrations générées, repository `forUser`, RLS en défense | Migrations rejouables de zéro ; tests SQL d'isolation (A ne lit jamais B) ; aucune `push` |
| **4. Abonnements** | Webhook RevenueCat (signature, idempotence), table `entitlements`, page paywall conforme, Restaurer, essai | Tests webhook (doublon, remboursement, expiration) ; droit refusé sans événement valide |
| **5. Compte + RGPD** | Consentement art. 9 séparé, export complet (JSON + photos), suppression complète (Clerk, RC, R2, tables) idempotente, durées de conservation, purge planifiée, âge ≥ 15 et règle des mineurs côté serveur | Test E2E : créer → remplir → exporter → supprimer → plus aucune trace ; test « mineur → jamais de déficit » côté API |
| **6. Design system** | Tokens depuis Claude Design → `packages/ui`, composants (Button, Card, Sheet, Field, MicButton, TabBar, HealthDisclaimer…), a11y (labels, ≥ 44 pt, Dynamic Type), RTL | Storybook-like / écran catalogue ; tests RNTL a11y ; contraste AA vérifié |
| **7. App socle** | Navigation, auth Clerk native (e-mail, Google, Apple, SMS), onboarding, TanStack Query + persistance hors-ligne, i18n fr/en/ar, Sentry app, EAS (dev, preview, prod) | Dev build iOS + Android installable ; flow Maestro « connexion → onboarding → accueil » vert |
| **8. Photos** | R2, URL présignées, EXIF retiré, miniatures, suppression | Tests : URL expirée refusée, accès inter-utilisateur refusé |
| **9. Style** | Dressing (+ détourage selon décision), tenue du jour, remplacer une pièce, planifier, historique | Parcours Maestro + tests domain |
| **10. Cuisine** | Photo frigo → recettes, **photo repas → macros modifiables**, journal, semaine, courses budget | Estimation toujours éditable + mention « estimation » ; tests |
| **11. Fitness** | Programme vocal, séance, **remplacer un exercice**, saisie rapide, progression, photo du corps facultative | Aucune formulation médicale (test de snapshot des textes) |
| **12. Ma journée** | Moteur de liens entre domaines (règles domain + IA), rappels actionnables, récap du soir | Selon décision K3 ; tests du moteur |
| **13. Admin** | Admin séparée (web ou écran protégé MFA), règle des 2 admins conservée, secrets hors app | Tests d'autorisation par rôle ; step-up exigé |
| **14. Sortie** | Fiches stores, captures, textes d'autorisation localisés, politique de confidentialité, AIPD | Checklist App Store / Play validée, TestFlight interne |

---

## 11. Questions à poser à l'ami (Anass)

1. **Brief et maquettes** : peux-tu les ajouter dans `docs/brief/` (ou les partager via Claude Design) ? L'audit de l'écart doit être refait sur le vrai brief.
2. **Nom** : Valyyu, Vayylo, ayylo ou « Bien. » ? Faut-il réserver le bundle id `com.valyyu.app` dès maintenant ?
3. **Promesse** : « Ta journée prête en 1 touche » ou « Tu expliques ou tu montres » ? (K10)
4. **Design** : es-tu d'accord pour reconstruire le front ? Quelles parties de l'identité sont non négociables (crème/encre/lime, « yy », micro central, mode clair) ? (K2)
5. **Données** : OK pour passer de « tout sur le téléphone + synchro manuelle » à « compte en ligne, synchro automatique » ? C'est indispensable pour les photos, l'export et la suppression serveur. (K1)
6. **Notifications** : le récap du soir compte-t-il dans la limite d'une notification par jour ? (K3)
7. **Dressing détouré** et **photo du corps** : dans la V1 ou plus tard ? Détourage sur le téléphone (gratuit, privé) ou serveur ? (K4, K5)
8. **Web** : faut-il encore une version web ? (K13)
9. **Admin** : une admin web séparée te convient-elle, avec MFA obligatoire ? Combien d'admins au lancement (la règle des 2 admins n'a de sens qu'à partir de 2) ?
10. **Prix** : l'offre « moins de 26 ans » est impossible à vérifier via les stores ; on la garde (sur l'honneur) ou on la retire ? (K11)
11. **Pays de lancement** : France seule, ou aussi Maroc / Suisse / Canada dès la V1 (impact RGPD, loi 09-08 au Maroc, LPD suisse, langues) ?
12. **Budget mensuel** acceptable pour l'hébergement au départ (25–35 $) et pour l'IA (2,50 €/utilisateur/mois) ?
13. **Branche `ameliorations`** : la fusionnes-tu dans `main` avant la refonte, ou la refonte part-elle de `ameliorations` ?
14. **Compte Apple Developer / Google Play** : qui les crée, au nom de quelle entité (société créée ?) — nécessaire pour Sign in with Apple, EAS et RevenueCat.

---

## 12. Stratégie Git (à valider avant de créer quoi que ce soit)

| Option | Pour | Contre |
| --- | --- | --- |
| **A. Branche `refonte` dans ce repo** (depuis `ameliorations`), branches de lot `refonte/lot-N-…` → PR vers `refonte` | historique conservé, `git mv` traçable, Anass voit tout au même endroit, issues/PR communes | l'arborescence change totalement : diff énormes, risque de confusion avec `ameliorations` encore active |
| **B. Nouveau repo** (ex. `valyyu`), code réimporté module par module | base vraiment propre, CI et règles de protection dès le premier commit, pas d'héritage Replit | historique perdu (sauf `git subtree`/filter-repo), deux repos à suivre pendant la transition |

**Décision : B, nouveau repo `ValyyuApp`.** Reco initiale : A, avec `refonte` protégée (PR obligatoires, CI requise), et un tag `pre-refonte` sur `ameliorations`. Le repo ne bouge que quand tu l'auras validé. Rien n'a été créé ni poussé pendant cet audit (le fichier que tu lis n'est pas commité).
