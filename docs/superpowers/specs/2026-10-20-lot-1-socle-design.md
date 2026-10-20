# Lot 1 — Socle du nouveau repo, tokens et squelette de l'app

> Spec issue du brainstorming du 2026-10-19/20 avec Rayan.
> Statut : **validée par Rayan le 2026-10-20**, puis adaptée au poste Windows et au design system v1 de Claude Design (voir §2, §7, §9). Aucun code écrit.
> Ce fichier sera déplacé dans le nouveau repo `ValyyuApp` (`docs/superpowers/specs/`) au premier commit.

## 1. Intention

**Pour qui :** Rayan, qui refait le design de l'app dans Claude Design, et le développement qui suivra.

**Résultat attendu :** un repo propre, aux normes, où :
- chaque export Claude Design se traduit en **tokens** et **composants** à un seul endroit ;
- le résultat se voit **tout de suite sur l'iPhone de Rayan** (et sur le simulateur du Mac) ;
- le cadre des normes est écrit, pour que le design parte sur de bonnes bases.

**Critère de réussite :** Rayan change une valeur de token dans un seul fichier, relance, et voit le changement partout dans l'app, sur son iPhone.

## 2. Décisions déjà prises (rappel)

| Sujet | Décision |
| --- | --- |
| Repo | Nouveau repo `Anasslahsaini/ValyyuApp`, sans historique importé. **Rien n'est poussé** sans accord explicite de Rayan. |
| Branches | `main` (protégée par Anass), `develop` (intégration), une branche par lot → PR vers `develop`. |
| Style de l'app | **Mixte** : structure native (onglets, navigation, feuilles, menus système), contenu sur mesure. |
| Données V1 | Sur le téléphone (SQLite), couche de données unique. **Pas dans ce lot.** |
| Comptes | Clerk. **Pas dans ce lot** (lot 2). Supabase plus tard (synchro ou communauté). |
| Langue | Français au lancement, app prête pour en/ar. Suit la langue du téléphone. Futur menu de langue : noms des langues, pas de drapeaux. |
| UI | Unistyles ou NativeWind : décidé au premier export Claude Design. |
| Communauté | Dernier lot. Ici : emplacement réservé et caché uniquement. |
| Postes | **Rayan et Anass développent sur Windows.** Rayan a aussi un Mac, utilisé seulement quand une vraie version native sera nécessaire (lot 2 et suivants). |
| Test du lot 1 | **iPhone avec Expo Go**, lancé depuis Windows : tout le lot 1 n'utilise que des modules présents dans Expo Go (à vérifier en tâche 0). |
| Design | **Design system v1 de Claude Design** (`docs/design/claude-design-v1-tokens.md`) = valeurs des tokens. |

## 3. Périmètre

### Dans le lot

1. Cadre des normes (`docs/design/normes.md`).
2. Nouveau repo local avec outillage (TypeScript, lint, format, tests, CI prête).
3. `packages/config` : nom de l'app en une ligne.
4. `packages/ui` : tokens + 8 composants de base accessibles.
5. `packages/i18n` : i18next, ressources fr.
6. `apps/mobile` : squelette Expo avec navigation native, écrans vides, écran catalogue.

### Hors du lot (explicitement)

API, base de données, Clerk, RevenueCat, logique métier (planner, tenues, séances, voix), SQLite, Sentry, Maestro, EAS cloud, Turborepo, écrans réels des domaines, choix Unistyles/NativeWind.

## 4. Repo et outillage

**Emplacement :** dossier local `ValyyuApp/` (à côté de `valyyu-app/`), `git init`, branches `main` puis `develop`. Le remote GitHub n'est ajouté qu'au feu vert de Rayan.

```
ValyyuApp/
├─ apps/mobile/
├─ packages/config/
├─ packages/ui/
├─ packages/i18n/
├─ packages/tsconfig/
├─ docs/  (audit-existant.md, design/, superpowers/specs/, adr/)
├─ .github/workflows/ci.yml
├─ .nvmrc  .npmrc  pnpm-workspace.yaml  package.json
├─ eslint.config.js  .prettierrc  .editorconfig  .gitignore
└─ README.md  PROJET.md
```

| Élément | Choix |
| --- | --- |
| Node | 24 LTS (`.nvmrc`), `engines` dans `package.json` |
| pnpm | 10, `packageManager` épinglé, `minimumReleaseAge: 1440` repris de l'ancien repo |
| TypeScript | une seule version pour tout le repo ; `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| ESLint | 9 flat config, `typescript-eslint`, `eslint-plugin-react`, `react-hooks`, `eslint-plugin-react-native-a11y`, règle « pas de texte en dur dans le JSX » (`i18next/no-literal-string`) |
| Prettier | config partagée, appliquée en CI (`--check`) |
| Tests | Vitest pour `packages/*`, jest-expo + `@testing-library/react-native` pour `apps/mobile` |
| CI | GitHub Actions : install (frozen lockfile) → typecheck → lint → format check → tests. Fichier écrit mais inactif tant que rien n'est poussé. |
| Versions | chaque dépendance épinglée à la version stable courante, vérifiée au moment de l'installation (maintenance, licence) ; liste consignée dans `docs/adr/0001-stack.md` |

**PROJET.md** : repris de `Valyyu-App` (branche `ameliorations`), sans supprimer aucune section, avec les décisions validées ajoutées en phrases courtes. La contradiction « Hors projet : fonctions communautaires » est signalée dans le texte, en attente de l'accord d'Anass.

## 5. Cadre des normes (`docs/design/normes.md`)

Première tâche du lot. Contenu :
- les règles de `docs/design/prompt-claude-design.md` (section « Normes »), développées avec les références (HIG Apple, Material 3, WCAG 2.2 AA, règles App Store et Google Play) ;
- les options du micro dans une barre d'onglets native ;
- l'état des lieux de l'app actuelle (les 9 défauts) avec les captures `docs/design/existant/` ;
- une check-list « avant d'exporter un écran depuis Claude Design ».

## 6. `packages/config`

Un seul fichier exporte `APP_NAME` (« Valyyu »), `APP_SLUG`, `APP_SCHEME`, `IOS_BUNDLE_ID`, `ANDROID_PACKAGE` (provisoirement `com.valyyu.app`) et les URLs légales (vides pour l'instant). `apps/mobile/app.config.ts` lit ces valeurs. Aucun nom de l'app écrit ailleurs : une règle de lint ou un test le vérifie.

## 7. `packages/ui`

### Tokens

Fichier TypeScript neutre (`tokens.ts`), **indépendant du moteur de style** :

| Groupe | Contenu initial |
| --- | --- |
| `color` | `paper #F2F1EC`, `surface #FEFEFC`, `ink #161616`, `ink2`, `muted`, `rule`, `lime #DDF55C`, `danger`, `success`, une couleur + une teinte douce par domaine (repas, sport, style) reprises de `theme.ts` ; noms sémantiques (`text.primary`, `text.secondary`, `bg.canvas`, `action.primary`…) qui pointent vers ces couleurs |
| `type` | échelle calquée sur les styles iOS (largeTitle, title1-3, headline, body 17, callout, subheadline, footnote, caption) ; familles Bricolage Grotesque (titres) et Instrument Sans (texte), reprises de l'app actuelle ; **chiffres tabulaires** dans la police du texte, plus de mono |
| `space` | multiples de 4 (0 à 64) |
| `radius` | `sm`, `md`, `card` (22, valeur actuelle), `pill` |
| `shadow` | 2 niveaux |
| `size` | `touchMin: 44` |

**Valeurs : celles du design system v1** (`docs/design/claude-design-v1-tokens.md`), qui remplace le tableau ci-dessus. Changements notables : police du **système** pour le texte (Bricolage Grotesque pour les titres seulement), `radius.card` 20, couleurs de domaine assombries pour le contraste, bouton `decision` lime, `ink.secondary` pour les onglets inactifs.

### Composants (8)

`Text`, `Button` (principal / secondaire / tertiaire / décision / destructif, états pressé, désactivé, focus, chargement), `IconButton` (le prop `accessibilityLabel` est **obligatoire dans le type**), `Card`, `TextField` (label visible, erreur, aide), `ListRow`, `SegmentedControl` (2 à 4 choix, contrôle natif sur iOS), `Sheet`.

Règles communes :
- cible tactile ≥ 44 pt (hitSlop si le visuel est plus petit) ;
- texte agrandi supporté : pas de hauteur fixe sur du texte, `maxFontSizeMultiplier` seulement si justifié ;
- styles en `start` / `end`, jamais `left` / `right` ;
- l'interface de chaque composant ne dépend pas du moteur de style, pour pouvoir passer à Unistyles ou NativeWind sans changer les écrans.

Le moteur de style provisoire est `StyleSheet` de React Native + tokens.

## 8. `packages/i18n`

i18next + react-i18next + expo-localization. `fr.json` contient tous les textes ; `en.json` et `ar.json` existent, vides, avec repli sur le français. Langue = langue du téléphone ; si elle n'est pas disponible, français. Pluriels gérés par i18next. Le sens droite-à-gauche n'est pas activé (arabe absent), mais rien dans le code ne l'empêche.

## 9. `apps/mobile`

- Expo SDK stable courant, expo-router, React Compiler, nouvelle architecture.
- **Onglets natifs** (`NativeTabs` d'expo-router) : Aujourd'hui · Repas · Micro · Sport · Style.
  - Micro : onglet central mis en avant qui ouvre une feuille vide (« Le micro arrive bientôt »). Version provisoire, remplacée par le design de Rayan.
  - Profil : bouton-avatar dans la barre du haut d'Aujourd'hui.
  - Communauté : bouton dans la barre du haut d'Aujourd'hui, **masqué** par un flag `features.community = false` dans `packages/config`, et route `(community)` vide.
- Chaque écran : grand titre natif + état vide « À venir », textes via i18n.
- **Écran catalogue** (`/dev/catalog`), accessible seulement en développement (`__DEV__`) depuis le Profil : affiche toutes les couleurs (avec leur ratio de contraste), l'échelle typographique, les espacements et les 8 composants dans tous leurs états.
- Mode clair forcé (`userInterfaceStyle: light`).
- Lancement : `pnpm dev` sous **Windows**, puis **Expo Go sur l'iPhone** (QR code, même Wi-Fi ; mode tunnel si le réseau bloque). Procédure Windows écrite dans le README. Le simulateur iOS / development build via le Mac ne sont pas requis dans ce lot.
- Outillage compatible Windows : scripts en Node (pas de bash), `.gitattributes` avec fins de ligne LF, CI qui exécute aussi typecheck et tests sur `windows-latest`.
- Onglet micro : la variante (A centre / B séparé) suit la décision de Rayan et Anass ; en attendant, variante B.

## 10. Tests

| Cible | Tests |
| --- | --- |
| `packages/ui` tokens | chaque paire texte/fond déclarée dans `tokens.ts` atteint 4,5:1 (3:1 pour les paires marquées « grand texte » ou « icône ») ; le test échoue sinon |
| `packages/ui` composants | rôle et label présents ; `IconButton` sans label refusé par TypeScript (test de type) ; cible ≥ 44 pt ; états désactivé/chargement annoncés à l'accessibilité |
| `packages/config` | le nom n'apparaît nulle part ailleurs dans `apps/` et `packages/` |
| `packages/i18n` | toutes les clés utilisées existent dans `fr.json` ; pas de clé orpheline |
| `apps/mobile` | rendu de chaque onglet ; la communauté est absente quand le flag est faux ; le catalogue est absent hors développement |

Approche TDD : test rouge d'abord, puis le code.

## 11. Définition de terminé

- [ ] `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` verts en local, **résultats montrés**.
- [ ] Sous Windows, `pnpm dev` démarre et l'app s'ouvre dans **Expo Go sur l'iPhone de Rayan**, avec la barre d'onglets native.
- [ ] Modifier `color.ink` (ou un autre token) change tout l'écran catalogue et les écrans vides.
- [ ] Modifier `APP_NAME` change le nom affiché par l'app.
- [ ] `docs/design/normes.md` est écrit.
- [ ] `PROJET.md` mis à jour (décisions validées, aucune section supprimée).
- [ ] Revue de code faite (`requesting-code-review`).
- [ ] Rien n'est poussé sans le feu vert de Rayan.

## 12. Risques

| Risque | Parade |
| --- | --- |
| `NativeTabs` ne permet pas assez de personnaliser l'onglet micro | variante prévue : onglets JS d'expo-router avec un rendu natif-like, documentée dans le cadre des normes ; décision au design |
| L'export Claude Design arrive dans un format inattendu | tokens neutres en TS ; un script de conversion sera écrit au besoin (lot 6) |
| Un module du lot 1 absent d'Expo Go (onglets natifs, contrôle segmenté natif) | tâche 0 : vérification ; repli sur l'équivalent JS d'expo-router / un segmenté en JS, sans changer l'interface du composant |
| Versions des dépendances trop récentes ou bêta | `minimumReleaseAge`, versions stables uniquement, consignées dans l'ADR |
