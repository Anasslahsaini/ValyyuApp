/**
 * Deterministic, offline voice-command parser (Siri-style).
 * An utterance is folded (lowercase, no accents, digits for number words) and matched against a per-language
 * lexicon. To add a language, add a `Lexicon` to `lexicons` (patterns work on the folded text).
 * Anything that does not match with enough confidence becomes `fallback`: the app then asks the AI agent (lib/voice/agent.ts),
 * or shows example commands when the agent is unavailable.
 */
import { canonical, fold } from './numbers';
import { app } from '@workspace/config';

const WAKE = app.wakeWords.join('|');

export type MealSlotName = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type NavTarget = 'home' | 'meals' | 'style' | 'fitness' | 'fitness.history' | 'profile';
export type ItemSlot = { name: string; quantity: string };
export type MealItemSlot = { name: string; servings: number; grams?: number };
export type VoiceArea = 'style' | 'meals' | 'fitness' | 'general';
export type GarmentCategory = 'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessory';

export type ParsedIntent =
  | { intent: 'groceries.add'; slots: { items: ItemSlot[] }; confidence: number }
  | { intent: 'pantry.add'; slots: { items: ItemSlot[] }; confidence: number }
  | { intent: 'pantry.remove'; slots: { items: ItemSlot[] }; confidence: number }
  | {
      intent: 'meal.log';
      slots: { items: MealItemSlot[]; slot: MealSlotName; daysAgo: number; slotExplicit: boolean };
      confidence: number;
    }
  | { intent: 'meal.repeat'; slots: { slot: MealSlotName; daysAgo: number }; confidence: number }
  | { intent: 'workout.start'; slots: { planName?: string }; confidence: number }
  | { intent: 'set.log'; slots: { text: string }; confidence: number }
  | { intent: 'timer.start'; slots: { seconds: number }; confidence: number }
  | { intent: 'outfit.today'; slots: Record<string, never>; confidence: number }
  | { intent: 'weight.log'; slots: { value: number; unit?: 'kg' | 'lb' }; confidence: number }
  | { intent: 'plan.week'; slots: Record<string, never>; confidence: number }
  | { intent: 'plan.today'; slots: { slot?: MealSlotName }; confidence: number }
  | { intent: 'nav.open'; slots: { target: NavTarget }; confidence: number }
  | {
      intent: 'targets.set';
      slots: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
        budget?: number;
        currency?: string;
      };
      confidence: number;
    }
  | {
      intent: 'wardrobe.add';
      slots: { name: string; category: GarmentCategory; color: string };
      confidence: number;
    }
  | { intent: 'fallback'; slots: { text: string; area: VoiceArea }; confidence: number };

export type IntentName = ParsedIntent['intent'];
/** Below this, the command is not trusted (unknown). Between this and 0.8 the user confirms first. */
export const CONFIDENCE_MIN = 0.6;

export type ParseOptions = {
  /** App language: its lexicon is tried first. */
  lang?: string;
  /** Local time, used for the default meal slot. */
  now?: Date;
};

/* ------------------------------------------------------------------ lexicons */

type Lexicon = {
  lang: string;
  /** Leading filler ("hey", "please", "can you") removed before matching. */
  fillers: RegExp[];
  trailing: RegExp;
  /** Separators between several items. */
  itemSplit: RegExp;
  /** Leading articles / partitives removed from item names. */
  articles: RegExp;
  /** Group `items` */
  groceriesAdd: { re: RegExp; confidence: number }[];
  pantryAdd: RegExp[];
  pantryRemove: RegExp[];
  mealLog: RegExp[];
  mealRepeat: RegExp[];
  /** Group `plan` optional */
  workoutStart: { re: RegExp; confidence: number }[];
  noPlan: RegExp;
  timerWord: RegExp;
  outfit: RegExp[];
  planWeek: RegExp[];
  planToday: RegExp[];
  weight: RegExp[];
  nav: { lead: RegExp; targets: [RegExp, NavTarget][]; bare: [RegExp, NavTarget][] };
  targetTrigger: RegExp;
  targetKinds: { calories: RegExp; protein: RegExp; carbs: RegExp; fat: RegExp; budget: RegExp };
  when: { days: [RegExp, number][]; slots: [RegExp, MealSlotName][] };
  area: [RegExp, VoiceArea][];
};

const UNITS =
  'kg|kilos?|kilogrammes?|g|gr|grammes?|grams?|l|litres?|liters?|ml|cl|dl|lbs?|oz|tranches?|slices?|paquets?|packs?|boites?|cans?|bouteilles?|bottles?|pots?|sachets?|portions?|bols?|bowls?|verres?|glass(?:es)?|tasses?|cups?|pieces?|morceaux|douzaines?';

const fr: Lexicon = {
  lang: 'fr',
  fillers: [
    new RegExp(`^(?:hey |ok |dis |salut )?(?:${WAKE}|siri),? `),
    /^(?:s il te plait|s il vous plait|stp|svp|alors|bon|et puis|euh|ben|donc) /,
    /^(?:est ce que )?(?:tu peux|peux tu|pourrais tu|tu pourrais|pouvez vous|vous pouvez|je voudrais|je veux|j aimerais|j aimerai|il faut que tu|fais moi) /,
  ],
  trailing: /\s+(?:s il te plait|s il vous plait|stp|svp|merci|aussi|encore|maintenant)$/,
  itemSplit: /\s*,\s*|\s+(?:et|puis|plus|ainsi que|avec)\s+|\s+&\s+/,
  articles:
    /^(?:(?:le|la|les|l|un|une|du|de|des|d|mon|ma|mes|ces|cette|ce|quelques|encore|environ|vers|a|au|aux|mes) )+/,
  groceriesAdd: [
    {
      re: /^(?:ajoute|ajouter|rajoute|rajouter|mets|met|mettre|inscris|note|noter|rajoute moi|ajoute moi) (?<items>.+?) (?:a|au|aux|sur|dans|en|pour) (?:ma |la |mes |mon |les |le )?(?:liste|courses)(?: de courses| des courses| d achats)?$/,
      confidence: 0.96,
    },
    {
      re: /^(?:ajoute|ajouter|rajoute|mets|met|note|inscris) (?:sur|dans|a) (?:ma |la )?(?:liste|courses)(?: de courses)? (?<items>.+)$/,
      confidence: 0.94,
    },
    {
      re: /^(?:il (?:me |nous )?faut|je dois acheter|je vais acheter|faut acheter|acheter|achete|n oublie pas d acheter|rappelle moi d acheter|pense a acheter|il manque) (?<items>.+)$/,
      confidence: 0.88,
    },
    { re: /^(?:ajoute|ajouter|rajoute|rajouter) (?<items>.+)$/, confidence: 0.66 },
  ],
  pantryAdd: [
    /^(?:ajoute|ajouter|rajoute|mets|met|range|ranger) (?<items>.+?) (?:a|au|aux|sur|dans|en) (?:mon |ma |le |la |les |mes )?(?:garde manger|frigo|frigidaire|placard|stock|stocks|reserve|cellier|congelateur|cuisine|inventaire)$/,
    /^(?:j ai|on a|nous avons|je viens d|je viens de) ?(?:achete|acheter|rapporte|rapporter|recu|recuperer|pris des courses|fait les courses)(?: pour)? (?<items>.+)$/,
    /^(?:j ai|on a) (?:fait des courses|fait les courses|rapporte) (?<items>.+)$/,
  ],
  pantryRemove: [
    /^(?:il n y a plus de|il ne reste plus de|il reste plus de|il n y a plus|y a plus de|j ai plus de|je n ai plus de|on n a plus de|on a plus de|nous n avons plus de|plus de|plus d|j ai fini|j ai termine|on a fini|on a termine|je n ai plus) ?(?<items>.+)$/,
    /^(?:retire|enleve|supprime|sors|vire) (?<items>.+?) (?:du|de la|des|de l|de mon|de ma) (?:garde manger|frigo|frigidaire|placard|stock|reserve|inventaire)$/,
  ],
  mealLog: [
    /^(?:j ai|on a|nous avons|je viens de|je viens d|moi j ai|j ai juste) ?(?:mange|manger|pris|prendre|bu|boire|goute|grignote|avale)(?: aussi)? (?<items>.+)$/,
    /^(?:j ai|on a) (?:pris|eu) (?:comme )?(?:petit dejeuner|dejeuner|diner|gouter|collation) (?<items>.+)$/,
    /^(?:ajoute|ajouter|rajoute|mets|met|enregistre|enregistrer|note|noter|inscris|loggue|compte) (?<items>.+?) (?:a|au|aux|dans|pour|en|sur|comme) (?:mon |ma |le |la |les |mes |mon journal )?(?:repas|journal|journal alimentaire|petit dejeuner|dejeuner|diner|gouter|souper|collation|snack|encas)$/,
    /^(?:ajoute|ajouter|enregistre|note|noter) (?:un |mon )?repas (?<items>.+)$/,
  ],
  mealRepeat: [
    /^(?:pareil|idem|comme|meme|la meme|le meme|refais|repete|remets|recommence|reprends|duplique|copie)\b.*\b(?:hier|avant hier)\b/,
    /^(?:pareil|idem|la meme chose|meme chose) (?:que |qu )?(?:d habitude|toujours)$/,
  ],
  workoutStart: [
    {
      re: /^(?:lance|lancer|demarre|demarrer|commence|commencer|debute|attaque|go|on y va pour)(?: moi)? (?:ma |mon |la |le |une |un |notre |l |cette |ce )?(?:seance|entrainement|workout|training|sport|musculation|muscu|plan|programme|routine|jour)(?: d entrainement| de sport| de muscu)?(?: (?:de |du |des |d |pour )?(?<plan>.+))?$/,
      confidence: 0.94,
    },
    {
      re: /^(?:c est parti pour|on commence) (?:la |le |ma |mon )?(?:seance|entrainement|sport|muscu)(?: (?:de |du |des |d )?(?<plan>.+))?$/,
      confidence: 0.9,
    },
  ],
  noPlan:
    /^(?:du jour|d aujourd hui|aujourd hui|maintenant|de maintenant|tout de suite|de la journee|d entrainement|de sport)$/,
  timerWord:
    /\b(?:minuteur|minuterie|chrono|chronometre|timer|compte a rebours|rappelle moi dans|reveille moi dans|alarme dans|sonne dans|previens moi dans|repos de)\b/,
  outfit: [
    /\bquelle tenue\b/,
    /\b(?:que|quoi|qu est ce que)\b.*\b(?:mettre|porter)\b/,
    /\bcomment (?:je )?(?:m )?habill/,
    /\btenue (?:du jour|pour aujourd hui|d aujourd hui|de demain)\b/,
    /\b(?:donne|propose|suggere|choisis) moi (?:une |ma )?tenue\b/,
    /\bhabille moi\b/,
    /\bje m habille comment\b/,
    /\bquoi mettre\b/,
  ],
  planWeek: [
    /^(?:planifie|planifier|organise|organiser|genere|generer|cree|creer|prepare|preparer|fais|faire|construis|construire|propose|proposer)(?: moi)? (?:ma |mon |la |le |les |mes |notre |nos |une |un |cette )?(?:semaine|menu|menus|repas|planning)(?: (?:de |du |pour )?(?:la |cette |toute la )?(?:semaine|repas|menu))?$/,
  ],
  planToday: [
    /^qu est ce (?:qu |que )(?:on |je |nous )?(?:mange|cuisine|prepare|fait|va manger|vais cuisiner|vais manger)(?: a manger)?(?: aujourd hui| ce soir| ce midi| ce matin)?$/,
    /^(?:on|je) (?:mange|cuisine) quoi(?: aujourd hui| ce soir| ce midi| ce matin)?$/,
    /^(?:c est quoi|quel est|quoi) (?:le |au )?menu(?: du jour| d aujourd hui| de ce soir| ce soir| aujourd hui)?$/,
  ],
  weight: [
    /^(?:je pese|pese moi a|mon poids (?:est|est de|c est|actuel est)|je fais|je suis a|je suis|poids|mon poids) ?(?:de )?(?<v>\d+(?:\.\d+)?) ?(?<u>kg|kilos?|kilogrammes?|livres?|lbs?|pounds?)?$/,
    /^(?:enregistre|enregistrer|note|noter|ajoute|ajouter|mets|met|inscris|loggue) (?:mon |le )?poids(?: a| de| est| du jour)?(?: de)? (?<v>\d+(?:\.\d+)?) ?(?<u>kg|kilos?|kilogrammes?|livres?|lbs?|pounds?)?$/,
  ],
  nav: {
    lead: /^(?:ouvre|ouvrir|va|vas|aller|affiche|afficher|montre|montrer|emmene|emmene moi|retour|retourne|passe|bascule|navigue|voir|vois|consulte|consulter)(?: moi)?(?: (?:a|au|aux|sur|vers|dans|en|l|la|le|les|mes|mon|ma|mon onglet|l onglet|l ecran|ecran|onglet|page|la page|de|des|du))* (?<target>.+)$/,
    targets: [
      [
        /\b(?:historique des seances|historique d entrainement|historique sport|historique fitness|mes seances passees|seances passees)\b/,
        'fitness.history',
      ],
      [/^historique(?: de)?$|^(?:mon )?historique$/, 'fitness.history'],
      [/\b(?:garde robe|dressing|vetements?|armoire|placard|tenues?|style|habits)\b/, 'style'],
      [
        /\b(?:repas|nutrition|alimentation|journal alimentaire|manger|recettes?|courses|liste de courses|garde manger|calories|cuisine|meals?)\b/,
        'meals',
      ],
      [
        /\b(?:sport|fitness|entrainements?|seances?|muscu|musculation|training|exercices?|workout|programmes?|plans?)\b/,
        'fitness',
      ],
      [/\b(?:accueil|home|aujourd hui|menu|principal|debut)\b/, 'home'],
      [/\b(?:profil|parametres|reglages|compte|preferences|settings|sauvegarde)\b/, 'profile'],
    ],
    bare: [[/^(?:l |mon |mes |l ecran )?historique(?: des seances| d entrainement)?$/, 'fitness.history']],
  },
  targetTrigger:
    /\b(?:objectif|objectifs|cible|but|budget|fixe|fixer|regle|regler|definis|definir|change|changer|mets mon|met mon|modifie|modifier|mettre)\b/,
  targetKinds: {
    calories: /\b(?:calories?|kcal|calorique|cal)\b/,
    protein: /\bproteines?\b/,
    carbs: /\b(?:glucides?|carbs|hydrates)\b/,
    fat: /\b(?:lipides?|graisses?|matieres? grasses?)\b/,
    budget: /\b(?:budget|courses par semaine|euros?|dollars?|livres sterling)\b/,
  },
  when: {
    days: [
      [/\bavant hier\b/, 2],
      [/\bhier\b/, 1],
      [/\b(?:aujourd hui|ce jour)\b/, 0],
    ],
    slots: [
      [/\b(?:(?:au|pour|le|ce|comme|de|du|a|en) )?petit dejeuner\b|\bpetit dej\b/, 'breakfast'],
      [/\b(?:(?:au|pour|le|ce|comme|de|du|a|en) )?(?:dejeuner|midi|dejeune)\b/, 'lunch'],
      [/\b(?:(?:au|pour|le|ce|comme|de|du|a|en|cette) )?(?:diner|souper|soir|soiree)\b/, 'dinner'],
      [/\b(?:(?:au|pour|le|ce|comme|de|du|a|en) )?(?:gouter|collation|encas|snack|quatre heures)\b/, 'snack'],
      [/\b(?:(?:au|pour|le|ce|cette|de|du|a|en) )?matin(?:ee)?\b/, 'breakfast'],
    ],
  },
  area: [
    [
      /\b(?:repas|manger|recette|recettes|cuisine|calories|courses|nutrition|aliment|diner|dejeuner|petit dejeuner|frigo)\b/,
      'meals',
    ],
    [
      /\b(?:tenue|vetement|vetements|habit|habille|dressing|garde robe|style|chaussures|pull|pantalon)\b/,
      'style',
    ],
    [
      /\b(?:sport|seance|entrainement|muscu|exercice|exercices|musculation|course a pied|pompes|squat)\b/,
      'fitness',
    ],
  ],
};

const en: Lexicon = {
  lang: 'en',
  fillers: [
    new RegExp(`^(?:hey |ok |okay |hi )?(?:${WAKE}|siri),? `),
    /^(?:please|well|so|um|uh|then|okay|ok|hey) /,
    /^(?:can you|could you|would you|will you|i want you to|i want to|i would like to|i d like to|i wanna|let s|go ahead and|just) /,
  ],
  trailing: /\s+(?:please|thanks|thank you|too|also|now|for me)$/,
  itemSplit: /\s*,\s*|\s+(?:and|plus|then|along with|as well as|with)\s+|\s+&\s+/,
  articles: /^(?:(?:the|a|an|some|any|more|my|our|of|more of|few|couple|about|around|one more|another) )+/,
  groceriesAdd: [
    {
      re: /^(?:add|put|get|include|write|note) (?<items>.+?) (?:to|on|onto|in|into|at) (?:my |the |our )?(?:(?:shopping |grocery |groceries |supermarket |store )?(?:list|cart|basket)|groceries|shopping)$/,
      confidence: 0.96,
    },
    {
      re: /^(?:add|put) (?:to|on|onto) (?:my |the |our )?(?:shopping |grocery |groceries )?list (?<items>.+)$/,
      confidence: 0.94,
    },
    {
      re: /^(?:i need to buy|i have to buy|i need to get|i need|we need|we re out of and need|need to buy|remind me to buy|buy|don t forget to buy|pick up|we need to buy|gotta buy) (?<items>.+)$/,
      confidence: 0.86,
    },
    { re: /^(?:add|get) (?<items>.+)$/, confidence: 0.66 },
  ],
  pantryAdd: [
    /^(?:add|put|store|stock) (?<items>.+?) (?:to|in|into|on) (?:my |the |our )?(?:pantry|fridge|freezer|cupboard|kitchen|stock|inventory|larder)$/,
    /^(?:i|we) (?:just )?(?:bought|purchased|picked up|got|brought home|got back with|have bought) (?<items>.+)$/,
    /^(?:i ve|we ve|i have|we have) (?:just )?(?:bought|purchased|picked up) (?<items>.+)$/,
  ],
  pantryRemove: [
    /^(?:(?:i m|i am|we re|we are|i ve|we ve|i have|we have|i|we) )?(?:just )?(?:out of|ran out of|run out of|used up|finished|used the last of|got no more|have no more|no more) (?<items>.+)$/,
    /^(?:there s no more|there is no more|no more|no) (?<items>.+?)(?: left)?$/,
    /^(?:remove|take|delete|drop) (?<items>.+?) (?:from|out of) (?:my |the |our )?(?:pantry|fridge|freezer|cupboard|stock|inventory)$/,
  ],
  mealLog: [
    /^(?:i|we) (?:just |also )?(?:had|ate|eaten|drank|drunk|have had|have eaten|snacked on|grabbed|took|am having|m having|m eating|am eating)(?: some| a bit of)? (?<items>.+)$/,
    /^(?:i ve|we ve) (?:just |also )?(?:had|eaten|drunk) (?<items>.+)$/,
    /^(?:add|log|put|record|save|track|enter|count) (?<items>.+?) (?:to|for|as|in|into|at|on) (?:my |the |our )?(?:meal|meals|food log|food diary|journal|diary|breakfast|lunch|dinner|supper|snack|snacks)$/,
    /^(?:log|record|track|add) (?:a |my )?(?:meal|food)(?: of)? (?<items>.+)$/,
  ],
  mealRepeat: [
    /^(?:same|repeat|copy|duplicate|redo|again|ditto)\b.*\b(?:yesterday|day before yesterday|the day before)\b/,
    /^(?:i had|log|add|have) the same\b.*\b(?:yesterday)\b/,
  ],
  workoutStart: [
    {
      re: /^(?:start|begin|launch|kick off|run|go for|lets do|do)(?: me)? (?:my |the |a |an |today s |todays |our |this )?(?:workout|training|session|gym|exercise|lifting|routine|plan|program|programme)(?: session)?(?: (?:for |of |on )?(?<plan>.+))?$/,
      confidence: 0.94,
    },
    {
      re: /^(?:start|begin|launch|kick off|do|run) (?:my |the |a |our )?(?<plan>.+?) (?:day|workout|session|routine|plan)$/,
      confidence: 0.88,
    },
    { re: /^(?:start|begin)$/, confidence: 0.3 },
  ],
  noPlan: /^(?:today|now|right now|for today|of the day)$/,
  timerWord: /\b(?:timer|stopwatch|countdown|count down|alarm|remind me in|wake me in|rest for|rest timer)\b/,
  outfit: [
    /\bwhat (?:should|do|can|shall|am) (?:i|we|i going to) (?:wear|put on)\b/,
    /\bwhat to wear\b/,
    /\bwhat (?:s|is) (?:my )?(?:outfit|look|fit)\b/,
    /\boutfit (?:for )?(?:today|tonight|tomorrow)\b/,
    /\b(?:pick|choose|give|suggest|find|show) (?:me )?(?:an |my |a )?outfit\b/,
    /\bdress me\b/,
    /\bwhat should i wear\b/,
    /\bwhat do i wear\b/,
  ],
  planWeek: [
    /^(?:plan|organi[sz]e|generate|create|make|build|prepare|set up)(?: me| us)? (?:my |the |a |our |this |next )?(?:whole |entire )?(?:week|weekly (?:meal )?plan|weekly menu|meal plan|menu|menus|meals(?: for the week| this week)?)(?: ahead)?$/,
  ],
  planToday: [
    /^what s (?:for )?(?:dinner|lunch|breakfast|supper)(?: tonight| today)?$/,
    /^what (?:should|do|shall|are|will) (?:i|we) (?:cook|eat|make|have)(?: for (?:dinner|lunch|breakfast|supper))?(?: today| tonight)?$/,
    /^what (?:do )?(?:i|we) (?:cook|eat)(?: today| tonight)?$/,
    /^what s (?:on )?(?:the )?(?:menu|plan)(?: today| tonight)?$/,
  ],
  weight: [
    /^(?:i weigh|my weight is|weight is|weight|my weight|i m|i am|i weighed|current weight is|today i weigh) ?(?:about |around )?(?<v>\d+(?:\.\d+)?) ?(?<u>kg|kgs|kilos?|kilograms?|lbs?|pounds?)?$/,
    /^(?:log|record|save|enter|add|track|set|note|update) (?:my )?weight(?: (?:as|at|is|to|of|today|today as))* ?(?<v>\d+(?:\.\d+)?) ?(?<u>kg|kgs|kilos?|kilograms?|lbs?|pounds?)?$/,
  ],
  nav: {
    lead: /^(?:open|show|show me|go to|go|take me to|take me|display|view|see|bring up|navigate to|switch to|pull up|jump to|check)(?: (?:me|to|my|the|a|up|on|tab|screen|page|section))* (?<target>.+)$/,
    targets: [
      [
        /\b(?:workout history|training history|exercise history|session history|past workouts|past sessions)\b/,
        'fitness.history',
      ],
      [/\b(?:wardrobe|closet|clothes|clothing|outfits?|style|dressing|garments)\b/, 'style'],
      [
        /\b(?:meals?|food|nutrition|diet|recipes?|groceries|grocery|shopping list|pantry|calories|journal|kitchen)\b/,
        'meals',
      ],
      [
        /\b(?:fitness|workouts?|training|gym|exercises?|sessions?|lifting|program|programs|plans?)\b/,
        'fitness',
      ],
      [/^(?:history|my history|the history)$/, 'fitness.history'],
      [/\b(?:home|today|main|dashboard|start)\b/, 'home'],
      [/\b(?:profile|settings|account|preferences|backup)\b/, 'profile'],
    ],
    bare: [[/^(?:my |the |workout )?history$/, 'fitness.history']],
  },
  targetTrigger: /\b(?:target|goal|goals|budget|set|change|update|make|set my|adjust)\b/,
  targetKinds: {
    calories: /\b(?:calories?|kcal|calorie)\b/,
    protein: /\bprotein\b/,
    carbs: /\b(?:carbs|carbohydrates?)\b/,
    fat: /\b(?:fat|fats)\b/,
    budget: /\b(?:budget|dollars?|euros?|pounds? sterling|bucks)\b/,
  },
  when: {
    days: [
      [/\b(?:the )?day before yesterday\b/, 2],
      [/\b(?:yesterday|last night)\b/, 1],
      [/\b(?:today)\b/, 0],
    ],
    slots: [
      [/\b(?:(?:for|at|as|my|the|this|during) )*breakfast\b/, 'breakfast'],
      [/\b(?:(?:for|at|as|my|the|this|during) )*(?:lunch|lunchtime|noon|midday)\b/, 'lunch'],
      [
        /\b(?:(?:for|at|as|my|the|this|during|last|yesterday) )*(?:dinner|supper|tonight|evening|night)\b/,
        'dinner',
      ],
      [/\b(?:(?:for|at|as|my|the|this|during|a) )*(?:snack|snacks|afternoon snack|tea time)\b/, 'snack'],
      [/\b(?:(?:for|at|as|my|the|this|during|yesterday) )*morning\b/, 'breakfast'],
    ],
  },
  area: [
    [
      /\b(?:meal|meals|food|recipe|recipes|cook|calories|grocery|groceries|nutrition|eat|lunch|dinner|breakfast|fridge)\b/,
      'meals',
    ],
    [/\b(?:outfit|clothes|clothing|wear|wardrobe|style|shoes|shirt|jacket|pants)\b/, 'style'],
    [/\b(?:workout|exercise|training|gym|fitness|squat|lifting|reps|sets)\b/, 'fitness'],
  ],
};

/** Register new languages here. */
const lexicons: Record<string, Lexicon> = { fr, en };
export const supportedVoiceLanguages = Object.keys(lexicons);

/* ------------------------------------------------------------------ helpers */

export function slotForTime(now: Date): MealSlotName {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

/** Words of a text keyed by their folded form, so accents can be restored on extracted names. */
function restorer(original: string) {
  const map = new Map<string, string>();
  for (const raw of original.split(/[\s,]+/)) {
    const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const key = fold(word);
    if (key && !map.has(key)) map.set(key, word);
    for (const part of word.split(/['’]/)) {
      const k = fold(part);
      if (k && !map.has(k)) map.set(k, part);
    }
  }
  return (name: string) =>
    name
      .split(' ')
      .map((w) => map.get(w) ?? w)
      .join(' ');
}

const unitKg = /^(?:kg|kilos?|kilogrammes?)$/;
const unitG = /^(?:g|gr|grammes?|grams?)$/;
function parseQuantity(chunk: string): {
  quantity: string;
  qty: number | null;
  grams?: number;
  rest: string;
} {
  const m = chunk.match(new RegExp(`^(\\d+(?:\\.\\d+)?)(?: ?(${UNITS})\\b)?(?: (?:de|d|of))?(?: |$)`));
  if (!m) return { quantity: '', qty: null, rest: chunk };
  const n = Number(m[1]);
  const unit = m[2];
  let grams: number | undefined;
  if (unit && unitG.test(unit)) grams = n;
  else if (unit && unitKg.test(unit)) grams = n * 1000;
  const mass = unit && (unitG.test(unit) || unitKg.test(unit));
  const unitLabel = unit
    ? unitKg.test(unit)
      ? 'kg'
      : unitG.test(unit)
        ? 'g'
        : /^(?:litres?|liters?)$/.test(unit)
          ? 'l'
          : unit
    : '';
  const label = unitLabel ? `${m[1]} ${unitLabel}` : m[1];
  return { quantity: label, qty: mass ? null : n, grams, rest: chunk.slice(m[0].length).trim() };
}

function cleanName(raw: string, lex: Lexicon): string {
  let s = raw.trim().replace(lex.trailing, '').trim();
  s = s.replace(lex.articles, '').trim();
  // "un peu de lait", "a bit of milk"
  s = s
    .replace(
      /^(?:un peu|peu|bit|little|lot|lots|beaucoup|plein|assez|bunch|packet|box|bag|jar|loaf|carton|piece) (?:de |d |of )?/,
      '',
    )
    .replace(lex.articles, '')
    .trim();
  return s;
}

function splitChunks(text: string, lex: Lexicon): string[] {
  return text
    .split(lex.itemSplit)
    .map((c) => c.trim())
    .filter(Boolean);
}

function parseItems(text: string, original: string, lex: Lexicon): ItemSlot[] {
  const restore = restorer(original);
  const items: ItemSlot[] = [];
  for (const chunk of splitChunks(text, lex)) {
    const stripped = chunk.replace(lex.articles, '').trim();
    const { quantity, rest } = parseQuantity(stripped);
    const name = cleanName(rest, lex);
    if (!name || /^\d+$/.test(name) || name.length > 60) continue;
    items.push({ name: restore(name), quantity });
  }
  return items;
}

function parseMealItems(text: string, original: string, lex: Lexicon): MealItemSlot[] {
  const restore = restorer(original);
  const items: MealItemSlot[] = [];
  for (const chunk of splitChunks(text, lex)) {
    const stripped = chunk.replace(lex.articles, '').trim();
    const { qty, grams, rest } = parseQuantity(stripped);
    const name = cleanName(rest, lex);
    if (!name || /^\d+$/.test(name) || name.length > 60) continue;
    const servings = Math.min(100, Math.max(0.1, qty ?? 1));
    items.push({ name: restore(name), servings, ...(grams ? { grams } : {}) });
  }
  return items;
}

function extractWhen(text: string, lex: Lexicon, now: Date) {
  let s = text;
  let daysAgo: number | undefined;
  let slot: MealSlotName | undefined;
  // Slots first: "last night" / "hier soir" combine a day and a slot.
  for (const [re, name] of lex.when.slots) {
    if (re.test(s)) {
      slot ??= name;
      s = s.replace(re, ' ');
    }
  }
  for (const [re, n] of lex.when.days) {
    if (re.test(s)) {
      daysAgo ??= n;
      s = s.replace(re, ' ');
    }
  }
  // "last night" is both yesterday and dinner when no explicit day was spoken.
  if (daysAgo === undefined && /\blast night\b/.test(text)) daysAgo = 1;
  s = s.replace(/\s+/g, ' ').trim();
  return {
    text: s,
    daysAgo: daysAgo ?? 0,
    dayExplicit: daysAgo !== undefined,
    slot: slot ?? slotForTime(now),
    slotExplicit: slot !== undefined,
  };
}

function stripFillers(text: string, lex: Lexicon): string {
  let s = text;
  for (let i = 0; i < 4; i++) {
    let changed = false;
    for (const re of lex.fillers) {
      const n = s.replace(re, '');
      if (n !== s) {
        s = n;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return s.replace(lex.trailing, '').trim();
}

const toSeconds = (n: number, unit: string) =>
  /^(?:h|hrs?|heures?|hours?)$/.test(unit) ? n * 3600 : /^(?:m|min|mins|minutes?)$/.test(unit) ? n * 60 : n;
function parseDuration(text: string): number | null {
  let total = 0,
    found = false,
    lastUnit = '';
  const re = /(\d+(?:\.\d+)?) ?(h|hrs?|heures?|hours?|min|mins|minutes?|m|s|sec|secs|secondes?|seconds?)\b/g;
  let m: RegExpExecArray | null;
  let end = 0;
  while ((m = re.exec(text))) {
    total += toSeconds(Number(m[1]), m[2]);
    found = true;
    lastUnit = m[2];
    end = re.lastIndex;
  }
  // "1 minute 30": a bare number after minutes counts as seconds.
  const tail = text.slice(end).match(/^ ?(?:et |and )?(\d+)\b/);
  if (found && tail && /^(?:min|mins|minutes?|m)$/.test(lastUnit)) total += Number(tail[1]);
  return found && total > 0 ? Math.round(total) : null;
}

const kgFrom = (v: number, unit?: string): { value: number; unit?: 'kg' | 'lb' } =>
  !unit
    ? { value: v }
    : /^(?:lbs?|livres?|pounds?)$/.test(unit)
      ? { value: v, unit: 'lb' }
      : { value: v, unit: 'kg' };

/* ------------------------------------------------------------------ parsing */

function guessArea(text: string, lexes: Lexicon[]): VoiceArea {
  for (const lex of lexes) for (const [re, area] of lex.area) if (re.test(text)) return area;
  return 'general';
}

function parseWith(lex: Lexicon, original: string, now: Date): ParsedIntent | null {
  const canon = canonical(original);
  const text = stripFillers(canon, lex);
  if (!text) return null;
  const when = extractWhen(text, lex, now);

  // Timer
  if (lex.timerWord.test(text)) {
    const seconds = parseDuration(text);
    if (seconds)
      return { intent: 'timer.start', slots: { seconds: Math.min(seconds, 24 * 3600) }, confidence: 0.95 };
  }

  // Set logging: "3 series de 10 a 60 kilos", "10 reps 60 kg"
  if (
    /\b\d+ ?(?:series?|sets?|reps?|repetitions?)\b/.test(text) &&
    !/\b(?:lance|start|commence|begin|launch)\b/.test(text)
  ) {
    return { intent: 'set.log', slots: { text: original.trim() }, confidence: 0.88 };
  }
  if (/\b\d+ ?(?:x|fois) ?\d+/.test(text) && /\b(?:kg|kilos?|lbs?|pounds?|livres?)\b/.test(text)) {
    return { intent: 'set.log', slots: { text: original.trim() }, confidence: 0.8 };
  }

  // Weight
  for (const re of lex.weight) {
    const m = text.match(re);
    if (m?.groups) {
      const v = Number(m.groups.v);
      const unit = m.groups.u;
      // Bare "i'm 80" / "je suis 80" is not a weight without a unit.
      if (!unit && /^(?:i m|i am|je suis|je suis a|je fais)\b/.test(text)) continue;
      if (Number.isFinite(v))
        return { intent: 'weight.log', slots: kgFrom(v, unit), confidence: unit ? 0.93 : 0.85 };
    }
  }

  // Nutrition / budget targets
  if (lex.targetTrigger.test(text) && /\d/.test(text)) {
    const num = Number((text.match(/(\d+(?:\.\d+)?)/) ?? [])[1]);
    const k = lex.targetKinds;
    const slots: Extract<ParsedIntent, { intent: 'targets.set' }>['slots'] = {};
    if (Number.isFinite(num) && num > 0) {
      if (k.budget.test(text)) {
        slots.budget = num;
        if (/\b(?:euros?|eur)\b|€/.test(text)) slots.currency = 'EUR';
        else if (/\b(?:dollars?|usd|bucks)\b|\$/.test(text)) slots.currency = 'USD';
        else if (/\b(?:pounds? sterling|livres sterling|gbp)\b|£/.test(text)) slots.currency = 'GBP';
      } else if (k.protein.test(text)) slots.protein = num;
      else if (k.carbs.test(text)) slots.carbs = num;
      else if (k.fat.test(text)) slots.fat = num;
      else if (k.calories.test(text)) slots.calories = num;
      if (Object.keys(slots).length && !/\b(?:timer|minuteur|workout|seance|session)\b/.test(text))
        return { intent: 'targets.set', slots, confidence: 0.9 };
    }
  }

  // Meal plan
  if (lex.planWeek.some((re) => re.test(text))) return { intent: 'plan.week', slots: {}, confidence: 0.93 };
  if (lex.planToday.some((re) => re.test(text)))
    return { intent: 'plan.today', slots: when.slotExplicit ? { slot: when.slot } : {}, confidence: 0.93 };

  // Outfit
  if (lex.outfit.some((re) => re.test(text))) return { intent: 'outfit.today', slots: {}, confidence: 0.92 };

  // Workout
  for (const { re, confidence } of lex.workoutStart) {
    const m = text.match(re);
    if (m) {
      let plan = m.groups?.plan?.trim();
      if (plan) plan = plan.replace(lex.articles, '').replace(lex.trailing, '').trim();
      if (plan && lex.noPlan.test(plan)) plan = undefined;
      return {
        intent: 'workout.start',
        slots: plan ? { planName: restorer(original)(plan) } : {},
        confidence,
      };
    }
  }

  // Repeat a previous meal
  if (lex.mealRepeat.some((re) => re.test(canon) || re.test(text))) {
    return {
      intent: 'meal.repeat',
      slots: { slot: when.slot, daysAgo: when.dayExplicit && when.daysAgo > 0 ? when.daysAgo : 1 },
      confidence: 0.9,
    };
  }

  // Pantry removal ("plus de lait"), before meals and groceries.
  for (const re of lex.pantryRemove) {
    const m = text.match(re);
    if (m?.groups?.items) {
      const items = parseItems(m.groups.items, original, lex);
      if (items.length) return { intent: 'pantry.remove', slots: { items }, confidence: 0.92 };
    }
  }
  for (const re of lex.pantryAdd) {
    const m = text.match(re);
    if (m?.groups?.items) {
      const items = parseItems(
        m.groups.items.replace(
          /\s+(?:au|at|from|chez) (?:supermarche|magasin|store|market|carrefour|lidl)\b.*$/,
          '',
        ),
        original,
        lex,
      );
      if (items.length) return { intent: 'pantry.add', slots: { items }, confidence: 0.92 };
    }
  }

  // Meals: the day and the slot were spoken anywhere ("hier soir j'ai mange ...").
  for (const re of lex.mealLog) {
    const m = when.text.match(re) ?? text.match(re);
    if (m?.groups?.items) {
      const items = parseMealItems(m.groups.items, original, lex);
      if (items.length)
        return {
          intent: 'meal.log',
          slots: { items, slot: when.slot, daysAgo: when.daysAgo, slotExplicit: when.slotExplicit },
          confidence: 0.93,
        };
    }
  }

  // Grocery list
  for (const { re, confidence } of lex.groceriesAdd) {
    const m = text.match(re);
    if (m?.groups?.items) {
      const items = parseItems(m.groups.items, original, lex);
      if (items.length) return { intent: 'groceries.add', slots: { items }, confidence };
    }
  }

  // Navigation
  for (const [re, target] of lex.nav.bare)
    if (re.test(text)) return { intent: 'nav.open', slots: { target }, confidence: 0.85 };
  const nav = text.match(lex.nav.lead);
  if (nav?.groups?.target) {
    const t = nav.groups.target;
    for (const [re, target] of lex.nav.targets)
      if (re.test(t)) return { intent: 'nav.open', slots: { target }, confidence: 0.9 };
  }
  return null;
}

/** Parse an utterance. Never throws; unknown or low-confidence input becomes `fallback`. */
export function parseCommand(utterance: string, options: ParseOptions = {}): ParsedIntent {
  const original = (utterance ?? '').trim();
  const now = options.now ?? new Date();
  const preferred = options.lang && lexicons[options.lang] ? [lexicons[options.lang]] : [];
  const order = [...preferred, ...Object.values(lexicons).filter((l) => !preferred.includes(l))];
  let best: ParsedIntent | null = null;
  if (original) {
    for (const lex of order) {
      let found: ParsedIntent | null = null;
      try {
        found = parseWith(lex, original, now);
      } catch {
        found = null;
      }
      if (found && (!best || found.confidence > best.confidence)) best = found;
      if (best && best.confidence >= 0.9) break;
    }
  }
  if (best && best.confidence >= CONFIDENCE_MIN) return best;
  return {
    intent: 'fallback',
    slots: { text: original, area: guessArea(canonical(original), order) },
    confidence: best ? best.confidence : 0,
  };
}
