# Cadre des normes — design de l'app

> Document de travail pour Claude Design et pour le code. Il dit ce qui est **imposé** (stores, accessibilité, plateformes) et ce qui est **libre**.
> Valeurs du design system : [`claude-design-v1-tokens.md`](claude-design-v1-tokens.md). Prompt de départ : [`prompt-claude-design.md`](prompt-claude-design.md).

## 1. Références

| Référence | Ce qu'on en retient |
| --- | --- |
| Apple Human Interface Guidelines | barre d'onglets, barre de navigation à grand titre, feuilles, Dynamic Type, SF Symbols, geste retour |
| Material Design 3 (Google) | barre de navigation, bouton flottant (FAB), feuilles, tailles en `sp` |
| WCAG 2.2 niveau AA | contrastes, cibles tactiles, information jamais par la couleur seule, focus visible |
| App Store Review Guidelines 4.8 | si on propose Google, il faut aussi « Se connecter / Continuer avec Apple » |
| App Store Review Guidelines 5.1.1(v) | suppression du compte possible **dans l'app** |
| App Store Review Guidelines 3.1.2 | page d'abonnement : prix, durée, renouvellement, « Restaurer mes achats », liens conditions et confidentialité |
| Google Play (règles Données utilisateur, Santé) | déclaration des données, suppression de compte, pas d'allégation médicale |

## 2. Approche « mixte »

- **Natif (on ne redessine pas)** : barre d'onglets, barre de navigation, feuilles, menus, alertes, sélecteurs, contrôle segmenté, listes de réglages, boutons officiels Apple et Google.
- **Sur mesure (identité valyyu)** : cartes, carte « décision », micro, écrans des domaines, illustrations, couleurs et typo des titres.

## 3. Règles imposées

### Mise en page et navigation
1. Barre d'onglets : **5 entrées au maximum**, icône + libellé toujours visibles, libellés inactifs en `ink.secondary`.
2. **Le contenu ne passe jamais sous la barre d'onglets** ni sous l'encoche, la Dynamic Island ou la barre de geste.
3. Pas de rangées de pastilles qui défilent horizontalement pour naviguer : onglets, liste ou contrôle segmenté (2 à 4 choix).
4. Le geste retour (iOS) et le bouton retour (Android) ne sont jamais bloqués.
5. Grand titre natif en haut des écrans principaux ; actions (« + ») dans la barre du haut.

### Toucher
6. Cible tactile **≥ 44 × 44 pt** (48 dp sur Android), même si le dessin est plus petit.
7. Un seul bouton principal par écran (encre).

### Texte
8. Taille de base 17 pt, minimum 12 pt (seule exception : libellés natifs de la barre d'onglets).
9. **Dynamic Type** : l'écran reste utilisable jusqu'à environ 310 % (tailles d'accessibilité iOS). Pas de hauteur fixe sur du texte, pas de « … » sur une action.
10. Textes 30 % plus longs possibles (traductions futures).

### Couleur et contraste
11. Texte ≥ **4,5:1** sur son fond ; gros texte, icônes et bordures ≥ **3:1**.
12. Gris clair du logo (`logo.light`) et lime sur papier : **jamais pour du texte**.
13. Une information ne passe jamais par la couleur seule (icône ou mot en plus).
14. Lime = micro et moment « décision » uniquement.

### Lecteurs d'écran (VoiceOver, TalkBack)
15. Chaque bouton-icône a un **nom lu à voix haute** qui décrit l'action complète (« Ajouter un repas », pas « plus »).
16. Les feuilles ont un bouton « Fermer » visible (glisser ne suffit pas).
17. L'ordre de lecture suit l'ordre visuel.

### Langues
18. Français au lancement ; l'app suit la langue du téléphone.
19. Miroir pour l'arabe : raisonner en « début / fin », jamais « gauche / droite ». Les flèches s'inversent ; le micro, l'horloge et les coches non.
20. Futur choix de langue : nom de chaque langue dans sa langue (« Français », « English », « العربية »), **pas de drapeaux**.

### Santé et données
21. Toute estimation (calories, macros, charges) : « Estimation, pas un avis médical ». Aucune formulation de diagnostic.
22. Pas de donnée de santé (poids…) affichée en grand sans raison.
23. Consentement aux données de santé : écran à part, case non pré-cochée, retirable.
24. Âge minimum 15 ans, message bienveillant.

### Autorisations
25. Expliquer **avant** la demande système (micro, caméra, position), puis en cas de refus : message court + bouton « Ouvrir les Réglages ».

## 4. Le micro dans une barre d'onglets native

| | Variante A — micro au centre | Variante B — micro séparé (recommandée) |
| --- | --- | --- |
| iOS | 5 onglets, pastille lime au centre | 4 onglets + action à part en fin de barre (comme l'onglet Recherche d'iOS 26) |
| Android | idem | barre à 4 onglets + bouton flottant (FAB) au même endroit |
| Norme | Apple : un onglet doit mener à une section, pas lancer une action → toléré, risque de remarque en revue | conforme |
| Identité | fidèle à `PROJET.md` (« micro au centre ») | le micro quitte le centre : **à valider avec Anass** |

Le code du lot 1 implémente la **variante B** ; la A reste possible sans changer les écrans.

## 5. L'app actuelle : ce qu'on corrige

Captures : [`existant/board-tabs.png`](existant/board-tabs.png), [`existant/board-onboarding.png`](existant/board-onboarding.png), [`existant/micro.png`](existant/micro.png).

1. Un domaine porte trois noms (Sport / Fitness / S'entraîner…) → un seul mot par domaine.
2. Le micro et la barre cachent des boutons et du texte.
3. Ordre des onglets incohérent avec « repas, sport, style ».
4. Même gros en-tête répété partout (un tiers de la hauteur).
5. Aucune hiérarchie de boutons (noir, lime, orange, violet, mauve).
6. États vides pleins de zéros.
7. Premier lancement en 8 étapes avec des boutons − / +.
8. Erreur du micro en énorme titre coloré.
9. Police mono pour les chiffres ; budget affiché en « $US » au lieu de « € ».

## 6. Check-list avant d'exporter un écran depuis Claude Design

- [ ] Tous les éléments touchables font au moins 44 × 44 pt.
- [ ] Un seul bouton principal (encre) ; lime seulement pour le micro ou « OK » d'une décision.
- [ ] Chaque couleur de texte vient d'une paire validée du design system (≥ 4,5:1).
- [ ] Aucune information portée par la couleur seule.
- [ ] Chaque bouton-icône a son nom lu à voix haute annoté.
- [ ] Les états vide, chargement et erreur sont dessinés.
- [ ] Une version avec texte agrandi est prévue (au moins pour les écrans principaux).
- [ ] Rien sous la barre d'onglets, l'encoche ou la barre de geste.
- [ ] Les éléments natifs (onglets, feuilles, menus, boutons Apple/Google) sont annotés comme natifs.
- [ ] Aucun texte « gauche / droite » dans les annotations : « début / fin ».
- [ ] Mentions santé présentes sur toute estimation.
- [ ] Toutes les valeurs utilisées sont des tokens nommés.
