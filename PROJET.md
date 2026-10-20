# Valyyu — le projet

> Ta journée prête en 1 touche : repas, sport, style.

Ce document résume le projet : l'idée, ce que fait l'app, les décisions prises, la technique, comment tester et ce qu'il reste avant la sortie.
La documentation technique détaillée est dans [`README.md`](README.md).

> **Refonte en cours (octobre 2026).** On repart d'un nouveau repo, `ValyyuApp`.
> Décisions validées :
>
> - nouveau repo, sans l'historique de l'ancien ; l'ancien `Valyyu-App` sert de référence ;
> - en V1, les données restent sur le téléphone ; la synchro viendra plus tard ;
> - comptes avec Clerk ; Supabase plus tard (synchro ou communauté) ;
> - design « mixte » : structure native (onglets, titres, feuilles), contenu à notre image ;
> - design refait avec Claude Design (design system v1) ;
> - l'app suit la langue du téléphone ; français au lancement, anglais et arabe prêts ;
> - la communauté arrive en dernier.
>
> **Où en est la refonte (20 octobre 2026)**, tout marche hors ligne, sur le téléphone :
>
> - connexion par e-mail (code) ou Google ; Apple attend le compte développeur ;
> - premier lancement en 5 étapes, avec l'écran « données de santé » (case non cochée) et la règle des mineurs ;
> - Aujourd'hui : la semaine en 1 touche, puis les 3 décisions du jour (repas, séance, tenue) ;
> - Repas : semaine jour par jour, frigo et idées de recettes, liste de courses avec budget ;
> - Sport : séance du jour, saisie des séries avec minuteur de repos, records et dernières séances ;
> - Style : dressing en photos, tenue du jour, changer une pièce, « Je la porte » ;
> - Micro : commandes **écrites** avec Annuler (la voix arrive avec le serveur) ;
> - Profil : mes infos, retrait de l'accord santé (efface les données), effacement des données, suppression du compte.
>
> Pas encore repris : météo, scan des codes-barres, IA (nutritionniste, coach, « Parle-moi de toi »), abonnement, notifications, succès, page admin.

---

## 1. L'idée

Chaque jour, on perd du temps à décider : quoi manger, quel sport faire, quoi porter.
**Valyyu décide pour toi** : l'app prépare ta journée, et toi tu choisis en une touche.

**L'ADN de Valyyu**

- **Faire gagner du temps** : moins de choix à faire, plus de temps pour vivre.
- **Simple pour tout le monde** : « un enfant de 10 ans doit comprendre ». C'est une image : l'app s'adresse à tous les âges, pas aux enfants.
- **Trois parties liées** : Repas, Sport et Style travaillent ensemble. Par exemple, une séance de sport change les besoins en repas, et la météo change la tenue.
- **Pour tout le monde** : pas de public « sportif » ou « mode » en particulier.

**L'équipe** : deux fondateurs, dont un fondateur technique. On recrutera plus tard.

---

## 2. Ce que fait l'app

### Accueil

- Le résumé du jour : repas, séance, tenue.
- La série de jours actifs. On la touche pour voir les succès.

### Repas

- 242 recettes vérifiées.
- Menus de la semaine selon ton frigo, ton temps, ton budget et ton but.
- Liste de courses automatique, scan des codes-barres (Open Food Facts) et garde-manger.
- **Nutritionniste IA** : elle choisit d'abord parmi les recettes du catalogue, avec les portions. Elle invente une recette seulement si rien ne correspond à ton frigo.
- **Allergies** : les recettes qui contiennent l'aliment sont retirées, et l'app affiche toujours « Vérifie toujours les étiquettes ».

### Sport

- La séance du jour, les séries, la progression automatique et la carte du corps.
- **Coach IA** :
  - au démarrage, il propose 3 programmes de 4 semaines (Express, Équilibré, Intensif) ;
  - il en refait un chaque mois ou à la demande, au maximum une fois par semaine ;
  - si tu as mal quelque part, il évite les exercices de cette zone et te conseille un professionnel de santé.

### Style

- Une garde-robe en photos.
- La tenue du jour selon la météo (MET Norway).
- 3 ou 4 photos d'exemple par style, venant de Pexels et créditées.

### Le micro (au centre de la barre d'onglets)

> Refonte : variante B proposée, le micro à part en fin de barre (règle d'Apple). **À valider par Anass.**

- Des commandes à la voix ou au texte, avec un bouton Annuler. Ce n'est pas un chat.
- L'audio n'est **jamais gardé**.

### Premier lancement

- **« Parle-moi de toi »** : tu parles, l'IA range ce que tu dis, pose les questions qui manquent, puis tu vérifies.
- Ou **« Je préfère répondre aux questions »**, en touchant les réponses.
- Âge minimum : **15 ans**. Pour les mineurs, l'app ne propose jamais de déficit calorique.

### Autres

- Les succès, visibles depuis le Profil et depuis la série de l'Accueil.
- Deux notifications au maximum (rappel de séance, tenue du jour prête), **une seule par jour** au plus. On peut les couper dans le Profil.
- Le compte est obligatoire (e-mail, Google, Apple, SMS), et on peut le supprimer depuis l'app.
- L'abonnement passe par l'App Store et Google Play (RevenueCat).
- Une page admin secrète pour les fondateurs : comptes, revenus, offres, clés, accès gratuits, règle des 2 admins.

**Hors projet** : les fonctions communautaires (on ne les code pas).

> À revoir : la communauté (posts, discussions) est prévue en **dernier lot**. En attendant, seule sa place est prévue dans le design. **En attente de l'accord d'Anass.**

---

## 3. Le design (à garder)

Le style de l'app est validé. **On améliore, on ne refait pas.**

> Refonte : le design est refait avec Claude Design (design system v1, dans `docs/design/`). On garde l'identité : crème, encre, lime, le symbole « yy », le mode clair.
> Changements à valider par Anass :
>
> - le texte passe à la police du système (plus lisible, suit la taille de texte du téléphone) ; Bricolage Grotesque reste pour les titres ;
> - les couleurs des domaines sont un peu plus foncées, pour être lisibles par tous ;
> - le micro passe en variante B (voir plus haut).

- Fond **papier crème**, texte **encre** (#161616), couleur forte **lime** (#DDF55C).
- Des cartes, et une barre d'onglets avec le **micro au centre**.
- **Logo dans l'app** : un petit carré lime bordé d'encre, puis « valyyu ».
- **Icône de l'app** : « yy, un choix fait » sur fond lime.
  - Le premier y, pâle, représente les options.
  - Le second y, plein, représente la décision.
  - On la voit sur l'écran d'accueil du téléphone, dans la liste Expo Go et sur l'écran de lancement.
- Mode clair seulement : l'app reste claire même si le téléphone est en mode sombre.

---

## 4. L'IA et son coût

- **Modèle** : Gemini, en niveau payant obligatoire. Une version « Lite » sert de mode économe.
- **Budget par utilisateur** : **2,50 € par mois**.
  - À partir de 2 €, l'app passe en mode économe.
  - Le démarrage a son propre budget de 0,50 €.
  - Pendant l'essai gratuit, l'IA est limitée à 30 demandes.
- À la limite, l'app affiche un message et passe en mode sans IA. Elle ne bloque jamais.
- Les plafonds se règlent dans la page admin.
- Le serveur compte le coût de chaque appel et le cumul du mois (table `valyyu_ai_usage`).

---

## 5. Prix (proposition, à décider avec l'associé)

| Offre                                                          | Prix                                |
| -------------------------------------------------------------- | ----------------------------------- |
| Annuel (mis en avant, essai de 7 jours)                        | 79,99 € / an                        |
| Mensuel                                                        | 12,99 € / mois                      |
| Moins de 26 ans                                                | 49,99 € / an                        |
| Membre fondateur (1re année, les 3 premiers mois de la sortie) | 49,99 €                             |
| Maroc / Suisse / Canada                                        | 249 MAD · 89 CHF · 99,99 CAD par an |

**Le chiffre à suivre** : la part des personnes qui téléchargent puis paient.

- 4 % ou plus : on est dans le scénario « Réaliste ».
- Moins de 2 % : il faut changer d'approche.

---

## 6. La technique

| Dossier                | Rôle                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `artifacts/valyyu`     | L'app Expo (SDK 57, expo-router) : iOS, Android, web                                  |
| `artifacts/api-server` | L'API Express 5 : IA, météo, codes-barres, synchro cloud, admin, budget IA            |
| `lib/life-data`        | Le format des données partagé (zod)                                                   |
| `lib/db`               | La base Postgres (Drizzle)                                                            |
| `lib/api-spec`         | La description de l'API (OpenAPI), qui génère `lib/api-zod` et `lib/api-client-react` |

**Nouveau repo `ValyyuApp` (refonte)**

| Dossier           | Rôle                                                   |
| ----------------- | ------------------------------------------------------ |
| `apps/mobile`     | L'app Expo (SDK 57, expo-router, onglets natifs)       |
| `packages/config` | Le nom de l'app et ses identifiants, à un seul endroit |
| `packages/tokens` | Les valeurs du design (couleurs, tailles, espaces)     |
| `packages/ui`     | Les composants de base (boutons, champs, cartes…)      |
| `packages/i18n`   | Les textes de l'app (français)                         |

Branches du nouveau repo : `main` (protégée), `develop`, une branche par lot.

**Services utilisés** : Clerk (comptes), RevenueCat (abonnements), Gemini (IA), Pexels (photos), MET Norway (météo), Open Food Facts (codes-barres).

**Ordre des écrans au démarrage** : connexion → premier lancement → abonnement → app.

**Branches**

- `main` : la version de départ. On n'y touche pas.
- `ameliorations` : tout le nouveau travail. C'est le fondateur qui fusionne.

**Vérifier** : `pnpm run typecheck` et `pnpm test` (dernier résultat : app 371/371, API 77/77).

---

## 7. Tester sur ton téléphone (Windows)

**Nouveau repo `ValyyuApp`** (voir le README pour le détail) :

```bat
git clone https://github.com/Anasslahsaini/ValyyuApp.git
cd ValyyuApp
git checkout develop
corepack enable
pnpm install
pnpm --filter @workspace/mobile start
```

Scanne le QR code avec Expo Go. Ancien repo :

```bat
git checkout ameliorations
git pull origin ameliorations
pnpm i
set NODE_PATH=C:\Users\romay\Valyyu-App\artifacts\valyyu\node_modules
pnpm dev:app
```

Ensuite, scanne le QR code avec Expo Go. Si l'ancienne version s'affiche encore, relance avec `npx expo start -c`.

**Limite d'Expo Go** : la vraie icône sur l'écran d'accueil et les messages d'autorisation en français ne se voient que dans une vraie version de l'app (TestFlight).

---

## 8. Sortie sur l'App Store

**Déjà fait**

- La connexion avec Apple et la suppression du compte dans l'app.
- La page d'abonnement complète : prix, renouvellement automatique, essai, « Restaurer mes achats », liens vers les conditions.
- Les messages d'autorisation clairs en français, en arabe et en anglais.
- La position demandée seulement quand l'app est ouverte, et le mode clair forcé.
- Les mentions santé : « une estimation, pas un avis médical », « demande à un professionnel de santé ».
- La fiche App Store prête :
  - nom : « Valyyu : repas, sport, style » ;
  - sous-titre : « Ta journée prête en 1 touche » ;
  - mots-clés, descriptions en français et en anglais, étiquettes de confidentialité.

**À faire par les fondateurs**

- [ ] Créer le compte Apple Developer.
- [ ] Créer les clés Gemini (niveau payant) et Pexels, puis les mettre dans la page admin.
- [ ] Lancer `pnpm --filter @workspace/db push` une fois en production.
- [ ] Acheter le domaine, puis créer les pages confidentialité, conditions et support. Mettre les liens dans la page admin.
- [ ] Décider des prix avec l'associé et les créer dans App Store Connect, Google Play et RevenueCat.
- [ ] Donner un accès gratuit au relecteur Apple et mettre ses identifiants dans les notes de la fiche.

**Prochaines étapes proposées**

- [ ] La configuration EAS (`eas.json`, identifiant `com.valyyu.app`) pour TestFlight.
- [ ] 6 captures pour l'App Store, en 1320×2868.
- [ ] VoiceOver : des noms lus à voix haute sur les boutons qui n'ont qu'une icône, en commençant par le micro central.
- [ ] Un test avec le texte très grand (Réglages › Accessibilité).
