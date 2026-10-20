# Design system v1 (Claude Design, 2026-10-20) — valeurs extraites

> Source : export `valyyu___refonte_app.html` reçu de Rayan. Ces valeurs remplacent les valeurs de départ de la spec du lot 1 (§7).

## Règles

1. Un seul bouton principal par écran, toujours encre.
2. Le lime = le micro et le moment « décision ». Rien d'autre.
3. Couleur de domaine = icônes et étiquettes, jamais seule.

## Couleurs

| Token | Valeur | Usage | Contraste |
| --- | --- | --- | --- |
| `color.bg.paper` | `#F2F1EC` | fond de tous les écrans | |
| `color.bg.surface` | `#FEFEFC` | cartes, champs, feuilles | |
| `color.bg.sunken` | `#E8E7E0` | contrôle segmenté, état pressé | |
| `color.ink` | `#161616` | texte, bouton principal | 16,0 sur paper · 17,9 sur surface |
| `color.ink.secondary` | `#5E5D58` | texte secondaire, onglets inactifs | 5,8 paper · 6,5 surface · 5,3 sunken |
| `color.border.field` | `#84837C` | bordure de champ, bouton secondaire (non-texte) | 3,8 surface · 3,4 paper |
| `color.border.hairline` | `#E3E2DB` | séparateurs, contour de carte (décor) | |
| `color.logo.light` | `#C9C8C2` | y clair du logo uniquement — **interdit pour le texte** | 1,7 |
| `color.accent.lime` | `#DDF55C` | micro, bouton décision ; toujours ink dessus | ink/lime 14,9 · lime/paper 1,1 (jamais en texte ni trait seul) |
| `color.accent.lime.pressed` | `#C9E23F` | état pressé micro / décision | |
| `color.danger` / `.bg` | `#B3261E` / `#FBE9E7` | erreurs | 6,5 surface · 5,6 sur son fond |
| `color.success` / `.bg` | `#1D6B3A` / `#E4F1E8` | réussite | 6,5 surface |
| `color.domain.today` / `.bg` | = ink / = sunken | Aujourd'hui (neutre) | 14,6 |
| `color.domain.repas` / `.bg` | `#A5400C` / `#FBEADF` | Repas | 5,4 fond · 6,2 surface |
| `color.domain.sport` / `.bg` | `#1F5FAD` / `#E3EDF9` | Sport | 5,4 fond · 6,3 surface |
| `color.domain.style` / `.bg` | `#6A3FB5` / `#EEE7F8` | Style | 5,8 fond · 7,0 surface |

## Typographie

- `font.display` = Bricolage Grotesque (titres seulement).
- `font.text` = police du système (SF Pro / Roboto). Chiffres en `tabular-nums`. Plus de police mono.
- Tailles = taille « Large » par défaut, tout suit Dynamic Type (UIFontMetrics / sp).
- Minimum 12 pt (sauf libellés natifs de la barre d'onglets). Pas de troncature « … » sur une action.

| Token | iOS (pt, taille/interligne · graisse) | Android (sp) |
| --- | --- | --- |
| `type.largeTitle` | 34 / 41 · 700 | 34 / 40 |
| `type.title1` | 28 / 34 · 700 | 28 / 36 |
| `type.title2` | 22 / 28 · 700 | 22 / 28 |
| `type.headline` | 17 / 22 · 600 | 16 / 24 |
| `type.body` (base) | 17 / 22 · 400 | 16 / 24 |
| `type.callout` | 16 / 21 · 400 | 15 / 22 |
| `type.subhead` | 15 / 20 · 500 | 14 / 20 |
| `type.footnote` | 13 / 18 · 400 | 12 / 16 |
| `type.caption` | 12 / 16 · 600 | 12 / 16 |
| `type.numeric` | style hôte + `tnum` | idem |

## Espacements, tailles

`space.1` 4 · `space.2` 8 · `space.3` 12 · `space.4` 16 · `space.5` 20 · `space.6` 24 · `space.8` 32 · `space.10` 40 · `space.12` 48
`layout.margin` 16 · `layout.gap.cards` 12 · `layout.gap.section` 32
`size.touch.min` 44 × 44 · `size.button.height` 52 (minimum, grandit avec le texte)

## Rayons

`radius.sm` 8 (étiquettes) · `radius.field` 12 (champs, segments) · `radius.button` 14 · `radius.card` 20 · `radius.sheet` système · `radius.pill` 999 (micro, bouton-icône)

## Ombres

`elevation.0` aucune + hairline (cartes par défaut) · `elevation.1` `0 1 2 / 6 %` + `0 4 12 / 5 %` (carte « décision ») · `elevation.2` `0 8 28 / 14 %` (menus, toasts ; les feuilles gardent l'ombre système)

## Icônes

SF Symbols (iOS) / Material Symbols Rounded (Android), poids regular. `icon.sm` 20 · `icon.md` 24 · `icon.lg` 28. Flèches inversées en arabe ; micro, horloge, coches non.

| Rôle | SF Symbol | Material | Nom lu |
| --- | --- | --- | --- |
| Aujourd'hui | `sun.max` | `wb_sunny` | « Aujourd'hui » |
| Repas | `fork.knife` | `restaurant` | « Repas » |
| Micro | `mic.fill` | `mic` | « Micro. Parle ou écris à valyyu » |
| Sport | `dumbbell` | `fitness_center` | « Sport » |
| Style | `tshirt` | `checkroom` | « Style » |
| Profil | `person.crop.circle` | `account_circle` | « Profil et réglages » |
| Communauté | `person.2` | `group` | « Communauté » |
| Ajouter | `plus` | `add` | l'action complète (« Ajouter un repas ») |
| Retour | `chevron.backward` | `arrow_back` | « Retour » |

## Composants

- Boutons : `button.primary` (encre, un par écran), `button.secondary` (contour), `button.tertiary` (texte), `button.decision` (lime, seulement « OK » d'une décision prête et feuille du micro), `button.destructive` (toujours suivi d'une alerte système). Hauteur 52, s'agrandit ; libellé sur 2 lignes si besoin. États normal / pressé / désactivé / focus (double anneau paper + ink).
- Bouton-icône : variante pleine seulement pour « + » de la barre du haut.
- Étiquette de domaine : non touchable, toujours icône + mot.
- Champ : libellé toujours au-dessus ; champs numériques avec unité en texte côté « fin » (âge, taille, poids).
- Contrôle segmenté : natif, 2 à 4 choix, piste 48 pt ; à 200 % les segments passent en liste verticale.
- Ligne de liste : native (insetGrouped / ListItem M3), hauteur min 52 ; à 200 % la valeur passe sous le titre.
- Carte « décision » : `elevation.1`, actions « Changer » + « OK » (OK côté fin).
- Feuille : native, poignée + bouton Fermer visible ; hauteurs moyenne (≈ 50 %) et grande.
- Onglet micro : variante A (centre, pastille lime 56 × 32) ou B (4 onglets + micro séparé en fin de barre, iOS 26 ; FAB sur Android). **À trancher.**

## Écrans de connexion (C1–C7)

C1 Bienvenue (Continuer avec Apple / Google / un e-mail, emplacement SMS plus tard, liens CGU + confidentialité) · C2 Saisie de l'e-mail (« Recevoir le code ») · C3 Code à 6 chiffres (renvoi après 0:42, « Modifier l'adresse ») · C4 Vérification · C5 Code faux · C6 Pas de réseau (« Réessayer ») · C7 Compte déjà lié à Google.
