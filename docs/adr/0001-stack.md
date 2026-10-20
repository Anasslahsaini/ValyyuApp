# ADR 0001 — Stack du socle (lot 1)

- Date : 2026-10-20
- Statut : accepté
- Contexte : spec `docs/superpowers/specs/2026-10-20-lot-1-socle-design.md`, plan `docs/superpowers/plans/2026-10-20-lot-1-socle.md`.

## Versions retenues (relevées sur npm le 2026-10-20)

Règle : version stable, publiée depuis plus de 24 h (`minimumReleaseAge: 1440`), compatible avec le reste.

| Paquet | Version | Licence | Raison / écart |
| --- | --- | --- | --- |
| Node | 24 LTS (24.22.0) | MIT | LTS active |
| pnpm | 10.34.7 | MIT | spec : pnpm 10. pnpm 12 existe ; migration à étudier plus tard |
| TypeScript | ~6.0.3 | Apache-2.0 | **TypeScript 7 n'est pas retenu** : `typescript-eslint` exige `<6.1.0` |
| ESLint | ^10 | MIT | **ESLint 9 est déclaré « plus maintenu »** ; le plan disait 9 |
| typescript-eslint | ^8.70 (8.71.2 installé) | MIT | 8.72.0 publié il y a moins de 24 h, refusé par `minimumReleaseAge` |
| @eslint-react/eslint-plugin | ^5.28 | MIT | **remplace `eslint-plugin-react`**, qui ne supporte pas ESLint 10 |
| eslint-plugin-react-hooks | ^7 | MIT | supporte ESLint 10 |
| eslint-plugin-i18next | ^6.1.5 | ISC | règle `no-literal-string` |
| eslint-plugin-react-native-a11y | — | MIT | **écarté** : ne supporte qu'ESLint ≤ 8, plus maintenu pour la config « flat ». L'accessibilité est garantie par les types des composants et les tests |
| Prettier | ^3.9 | MIT | |
| Vitest | ^5.0 (+ vite ^8) | MIT | `vite` est une dépendance pair de Vitest 5 |
| Expo SDK | **57** (57.0.30) | MIT | **SDK 58 abandonné pour l'instant** : l'Expo Go de l'App Store (iPhone de Rayan, 2026-10-20) ne supporte que le SDK 57. React 19.2.3, React Native 0.86.3. Remonter au 58 quand Expo Go le supportera |
| expo-router | 57.0.28 | MIT | onglets natifs via `expo-router/unstable-native-tabs` (devient `expo-router/native-tabs` au SDK 58) |
| jest-expo / @testing-library/react-native | 57.0.6 / 14.x | MIT | tests des composants |
| i18next / react-i18next / expo-localization | 26.x / 17.x / 57.0.2 | MIT | |
| @react-native-segmented-control/segmented-control | — | MIT | non installé : contrôle segmenté en JS pour l'instant (voir les décisions du lot 1) |
| @expo-google-fonts/bricolage-grotesque | 0.4.x | MIT + OFL-1.1 | police des titres |

## Expo Go

Toutes les versions natives correspondent exactement à `bundledNativeModules.json` du SDK 57 (vérifié à la main, `expo install --check` n'étant pas joignable depuis l'environnement de travail). Le bundle iOS se construit. Ouverture dans Expo Go à confirmer par Rayan sur iPhone.
