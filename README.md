# valyyu

Monorepo de l'app mobile (Expo) et des paquets partagés. Le document du projet, pour tout le monde, est [`PROJET.md`](PROJET.md). Ce README est la doc technique.

## Prérequis

- **Node.js 24 LTS** (`.nvmrc`)
- **pnpm 10** : `npm install -g pnpm@10.34.7` (sans droits administrateur). `corepack enable` marche aussi, mais sous Windows il échoue avec `EPERM` s'il n'est pas lancé dans un terminal administrateur.
- **Git**
- Un iPhone ou un Android avec **Expo Go** (App Store / Play Store), sur le même Wi-Fi que l'ordinateur

Éditeur conseillé : VS Code avec les extensions ESLint, Prettier et Expo Tools.

## Lancer l'app (Windows, macOS ou Linux)

```sh
git clone https://github.com/Anasslahsaini/ValyyuApp.git
cd ValyyuApp
git checkout develop
npm install -g pnpm@10.34.7
pnpm install
pnpm --filter @workspace/mobile start
```

Avant le premier lancement, connecte-toi à un compte Expo gratuit (expo.dev), **le même** sur l'ordinateur et dans Expo Go (onglet Profil) :

```sh
pnpm --filter @workspace/mobile exec expo login
```

Si VS Code souligne encore les imports en rouge après `pnpm install` : `Ctrl+Shift+P` → « TypeScript: Restart TS Server ».

Un QR code s'affiche dans le terminal :

- **iPhone** : ouvre l'appareil photo et scanne le QR code, il propose d'ouvrir Expo Go.
- **Android** : ouvre Expo Go et scanne le QR code depuis l'app.

Si le téléphone ne se connecte pas (Wi-Fi d'entreprise ou d'école, pare-feu Windows) :

```sh
pnpm --filter @workspace/mobile start -- --tunnel
```

Le catalogue du design (tous les tokens et composants) est dans **Profil → Catalogue du design**, en développement uniquement.

## Vérifications

```sh
pnpm typecheck     # TypeScript, tous les paquets
pnpm lint          # ESLint
pnpm format:check  # Prettier (pnpm format pour corriger)
pnpm test          # Vitest (paquets purs) + jest-expo (composants, app)
```

La CI GitHub Actions lance les quatre sur Ubuntu et Windows à chaque PR.

## Structure

| Dossier             | Rôle                                                                                                   | Tests     |
| ------------------- | ------------------------------------------------------------------------------------------------------ | --------- |
| `apps/mobile`       | App Expo SDK 57, expo-router, onglets natifs                                                           | jest-expo |
| `packages/config`   | Nom de l'app, identifiants des stores, interrupteurs (`features`)                                      | Vitest    |
| `packages/tokens`   | Valeurs du design system v1 + calcul des contrastes WCAG                                               | Vitest    |
| `packages/ui`       | 8 composants accessibles (Text, Button, IconButton, Card, TextField, ListRow, SegmentedControl, Sheet) | jest-expo |
| `packages/i18n`     | i18next, textes dans `locales/fr.json`                                                                 | Vitest    |
| `packages/tsconfig` | Config TypeScript partagée (strict)                                                                    | —         |
| `docs/`             | Audit, normes, design, specs, plans, ADR                                                               | —         |

## Règles du code

- **Le nom de l'app** n'est écrit que dans `packages/config/src/app.ts`. Un test échoue s'il apparaît ailleurs dans `apps/` ou `packages/`.
- **Aucune valeur de design en dur** : couleurs, tailles, espaces et rayons viennent de `@workspace/tokens`. Un changement de token se voit partout.
- **Aucun texte en dur dans l'interface** : tout passe par `t('…')` et `locales/fr.json` (règle ESLint). Une clé stockée dans des données s'écrit `tKey('…')`. Un test vérifie que chaque clé utilisée existe et que chaque clé existante est utilisée. Le nom de l'app s'insère avec `{{appName}}`.
- **Début / fin, jamais gauche / droite** dans les styles (`marginStart`, `paddingEnd`…), pour que l'arabe puisse s'afficher en miroir. Un test l'impose.
- **Accessibilité** : un `IconButton` sans `accessibilityLabel` ne compile pas ; cibles tactiles ≥ 44 pt ; le texte suit la taille choisie dans le téléphone.
- **Dépendances** : une version doit avoir plus de 24 h pour être installée (`minimumReleaseAge`, à ne pas désactiver). Choix et versions : [`docs/adr/0001-stack.md`](docs/adr/0001-stack.md).
- **Git** : Conventional Commits en anglais ; une branche par lot, PR vers `develop` ; `main` est protégée.

## Normes de design

Voir [`docs/design/normes.md`](docs/design/normes.md) et les valeurs [`docs/design/claude-design-v1-tokens.md`](docs/design/claude-design-v1-tokens.md).
