import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand, type ParsedIntent } from '../voice/intents';
import { canonical, fold, parseNumber } from '../voice/numbers';

const morning = new Date(2026, 9, 15, 8, 30);
const evening = new Date(2026, 9, 15, 20, 0);
const parse = (text: string, lang = 'fr', now = morning) => parseCommand(text, { lang, now });
const names = (p: ParsedIntent) =>
  'items' in p.slots ? (p.slots.items as { name: string }[]).map((i) => i.name) : [];

test('numbers: digits, decimal commas and words in French and English', () => {
  assert.equal(canonical('deux oeufs'), '2 oeufs');
  assert.equal(canonical('trois cent vingt'), '320');
  assert.equal(canonical('quatre vingt dix'), '90');
  assert.equal(canonical('soixante dix'), '70');
  assert.equal(canonical('vingt et un'), '21');
  assert.equal(canonical('deux et demi'), '2.5');
  assert.equal(canonical('une demi baguette'), 'demi baguette'.replace('demi', '0.5'));
  assert.equal(canonical('a dozen eggs'), 'a 12 eggs');
  assert.equal(canonical('one hundred and twenty'), '120');
  assert.equal(canonical('two and a half'), '2.5');
  assert.equal(canonical('72,5 kilos'), '72.5 kilos');
  assert.equal(canonical('un peu de lait'), 'un peu de lait');
  assert.equal(parseNumber('quinze'), 15);
  assert.equal(parseNumber('rien'), null);
  assert.equal(fold('Œufs À Noël'), 'oeufs a noel');
});

test('groceries.add: several items, both languages', () => {
  let p = parse('ajoute du lait et des œufs à la liste de courses');
  assert.equal(p.intent, 'groceries.add');
  assert.deepEqual(names(p), ['lait', 'œufs']);
  p = parse('add milk to my shopping list', 'en');
  assert.equal(p.intent, 'groceries.add');
  assert.deepEqual(names(p), ['milk']);
  p = parse('add milk, eggs and bread to the list', 'en');
  assert.deepEqual(names(p), ['milk', 'eggs', 'bread']);
  p = parse('ajoute 2 litres de lait, du pain et trois yaourts à ma liste');
  assert.deepEqual(p.slots, {
    items: [
      { name: 'lait', quantity: '2 l' },
      { name: 'pain', quantity: '' },
      { name: 'yaourts', quantity: '3' },
    ],
  });
  p = parse('il faut acheter du beurre');
  assert.equal(p.intent, 'groceries.add');
  p = parse('I need to buy toothpaste and soap', 'en');
  assert.deepEqual(names(p), ['toothpaste', 'soap']);
  p = parse("s'il te plaît ajoute des pâtes à la liste de courses");
  assert.deepEqual(names(p), ['pâtes']);
});

test('groceries.add: a bare "ajoute X" is accepted with lower confidence', () => {
  const p = parse('ajoute du pain');
  assert.equal(p.intent, 'groceries.add');
  assert.ok(p.confidence < 0.8);
});

test('pantry.add: bought items with quantities', () => {
  let p = parse("j'ai acheté 6 œufs");
  assert.equal(p.intent, 'pantry.add');
  assert.deepEqual(p.slots, { items: [{ name: 'œufs', quantity: '6' }] });
  p = parse("j'ai acheté six œufs et du jambon");
  assert.deepEqual(p.slots, {
    items: [
      { name: 'œufs', quantity: '6' },
      { name: 'jambon', quantity: '' },
    ],
  });
  p = parse('I bought 500 g of pasta and two cans of tomatoes', 'en');
  assert.equal(p.intent, 'pantry.add');
  assert.equal((p.slots as { items: { quantity: string }[] }).items[0].quantity, '500 g');
  p = parse("j'ai acheté une douzaine d'œufs");
  assert.deepEqual(p.slots, { items: [{ name: 'œufs', quantity: '12' }] });
  p = parse('ajoute du riz au garde-manger');
  assert.equal(p.intent, 'pantry.add');
  assert.deepEqual(names(p), ['riz']);
});

test('pantry.remove: out of an item', () => {
  assert.equal(parse('plus de lait').intent, 'pantry.remove');
  assert.deepEqual(names(parse('plus de lait')), ['lait']);
  assert.deepEqual(names(parse("il n'y a plus de beurre")), ['beurre']);
  assert.deepEqual(names(parse("je n'ai plus d'œufs")), ['œufs']);
  assert.deepEqual(names(parse("I'm out of rice", 'en')), ['rice']);
  assert.deepEqual(names(parse('we ran out of coffee and sugar', 'en')), ['coffee', 'sugar']);
});

test('meal.log: items, quantity words, slots from words and time of day', () => {
  let p = parse("j'ai mangé deux œufs et une banane au petit déjeuner");
  assert.equal(p.intent, 'meal.log');
  assert.deepEqual(p.slots, {
    items: [
      { name: 'œufs', servings: 2 },
      { name: 'banane', servings: 1 },
    ],
    slot: 'breakfast',
    daysAgo: 0,
    slotExplicit: true,
  });
  p = parse('I had a chicken salad for lunch', 'en');
  assert.equal(p.intent, 'meal.log');
  assert.equal((p.slots as { slot: string }).slot, 'lunch');
  assert.deepEqual(names(p), ['chicken salad']);
  p = parse("hier soir j'ai mangé une pizza");
  assert.equal((p.slots as { slot: string; daysAgo: number }).slot, 'dinner');
  assert.equal((p.slots as { daysAgo: number }).daysAgo, 1);
  p = parse('I ate a burger yesterday', 'en', evening);
  assert.equal((p.slots as { daysAgo: number }).daysAgo, 1);
  p = parse('I had a pizza last night', 'en');
  assert.equal((p.slots as { daysAgo: number; slot: string }).daysAgo, 1);
  assert.equal((p.slots as { slot: string }).slot, 'dinner');
});

test('meal.log: default slot follows the time of day', () => {
  assert.equal((parse("j'ai mangé une pomme", 'fr', morning).slots as { slot: string }).slot, 'breakfast');
  assert.equal((parse("j'ai mangé une pomme", 'fr', evening).slots as { slot: string }).slot, 'dinner');
  assert.equal(
    (parse("j'ai mangé une pomme", 'fr', new Date(2026, 9, 15, 12, 30)).slots as { slot: string }).slot,
    'lunch',
  );
  assert.equal(
    (parse("j'ai mangé une pomme", 'fr', morning).slots as { slotExplicit: boolean }).slotExplicit,
    false,
  );
  const p = parse('ce midi j’ai mangé des pâtes', 'fr', evening);
  assert.equal((p.slots as { slot: string }).slot, 'lunch');
});

test('meal.log: grams and via an "add to my breakfast" phrasing', () => {
  let p = parse("j'ai mangé 200 g de riz");
  assert.deepEqual((p.slots as { items: unknown[] }).items, [{ name: 'riz', servings: 1, grams: 200 }]);
  p = parse('ajoute un yaourt à mon petit déjeuner');
  assert.equal(p.intent, 'meal.log');
  p = parse('log a protein shake for snack', 'en');
  assert.equal(p.intent, 'meal.log');
  assert.equal((p.slots as { slot: string }).slot, 'snack');
});

test('meal.repeat: yesterday and the slot', () => {
  let p = parse("pareil qu'hier au déjeuner");
  assert.deepEqual(p.slots, { slot: 'lunch', daysAgo: 1 });
  assert.equal(p.intent, 'meal.repeat');
  p = parse('same breakfast as yesterday', 'en');
  assert.equal(p.intent, 'meal.repeat');
  assert.deepEqual(p.slots, { slot: 'breakfast', daysAgo: 1 });
  p = parse('comme hier soir');
  assert.equal(p.intent, 'meal.repeat');
  assert.equal((p.slots as { slot: string }).slot, 'dinner');
});

test('workout.start: today, named plan, both languages', () => {
  assert.deepEqual(parse('lance ma séance').slots, {});
  assert.equal(parse('lance ma séance').intent, 'workout.start');
  assert.equal(parse('start my workout', 'en').intent, 'workout.start');
  assert.deepEqual(parse('start push day', 'en').slots, { planName: 'push' });
  assert.deepEqual(parse('commence le plan Jambes').slots, { planName: 'Jambes' });
  assert.deepEqual(parse('lance ma séance de pectoraux').slots, { planName: 'pectoraux' });
  assert.deepEqual(parse("lance la séance d'aujourd'hui").slots, {});
});

test('set.log keeps the utterance for the fitness runner', () => {
  const p = parse('3 séries de 10 à 60 kilos');
  assert.equal(p.intent, 'set.log');
  assert.equal((p.slots as { text: string }).text, '3 séries de 10 à 60 kilos');
  assert.equal(parse('10 reps 60 kg', 'en').intent, 'set.log');
  assert.equal(parse('trois séries de dix à quatre vingts kilos').intent, 'set.log');
});

test('timer.start: seconds, minutes, mixed and spoken numbers', () => {
  assert.deepEqual(parse('minuteur 90 secondes').slots, { seconds: 90 });
  assert.deepEqual(parse('timer 2 minutes', 'en').slots, { seconds: 120 });
  assert.deepEqual(parse('minuteur de 1 minute 30').slots, { seconds: 90 });
  assert.deepEqual(parse('timer for two and a half minutes', 'en').slots, { seconds: 150 });
  assert.deepEqual(parse('minuteur trois minutes').slots, { seconds: 180 });
  assert.deepEqual(parse('set a timer for 1 hour', 'en').slots, { seconds: 3600 });
  assert.deepEqual(parse('minuteur une demi heure').slots, { seconds: 1800 });
});

test('outfit.today', () => {
  assert.equal(parse("quelle tenue aujourd'hui").intent, 'outfit.today');
  assert.equal(parse('what should I wear', 'en').intent, 'outfit.today');
  assert.equal(parse('que dois-je mettre ce matin').intent, 'outfit.today');
  assert.equal(parse('habille-moi').intent, 'outfit.today');
});

test('weight.log: decimals, words, units and pounds', () => {
  assert.deepEqual(parse('je pèse 72,5 kilos').slots, { value: 72.5, unit: 'kg' });
  assert.deepEqual(parse('log my weight 160 pounds', 'en').slots, { value: 160, unit: 'lb' });
  assert.deepEqual(parse('I weigh 81.2 kg', 'en').slots, { value: 81.2, unit: 'kg' });
  assert.deepEqual(parse('enregistre mon poids 70 kilos').slots, { value: 70, unit: 'kg' });
  assert.equal(parse('I am 30', 'en').intent, 'fallback');
});

test('nav.open: tabs, wardrobe and history', () => {
  assert.deepEqual(parse('ouvre les repas').slots, { target: 'meals' });
  assert.deepEqual(parse('show my wardrobe', 'en').slots, { target: 'style' });
  assert.deepEqual(parse('historique').slots, { target: 'fitness.history' });
  assert.deepEqual(parse('open my workout history', 'en').slots, { target: 'fitness.history' });
  assert.deepEqual(parse('va au sport').slots, { target: 'fitness' });
  assert.deepEqual(parse('go to my profile', 'en').slots, { target: 'profile' });
  assert.equal(parse('ouvre le frigo de mon voisin').intent, 'fallback');
});

test('targets.set: calories, protein and budget with currency', () => {
  assert.deepEqual(parse('objectif 2000 calories').slots, { calories: 2000 });
  assert.deepEqual(parse('budget 80 euros par semaine').slots, { budget: 80, currency: 'EUR' });
  assert.deepEqual(parse('set my protein goal to 150', 'en').slots, { protein: 150 });
  assert.deepEqual(parse('objectif deux mille cinq cents calories').slots, { calories: 2500 });
  assert.deepEqual(parse('weekly budget 60 dollars', 'en').slots, { budget: 60, currency: 'USD' });
});

test('open requests and noise fall back to the assistant', () => {
  const cases = [
    'invente-moi une recette avec du poulet',
    'analyze this photo',
    'bonjour',
    'ajoute',
    'start the car',
    'what is the capital of France',
    '',
    '   ',
    'merci beaucoup',
    'tell me a joke',
  ];
  for (const text of cases) assert.equal(parse(text, 'en').intent, 'fallback', text);
  const f = parse('invente-moi une recette avec du poulet');
  assert.equal(f.intent, 'fallback');
  assert.equal((f.slots as { area: string }).area, 'meals');
  assert.equal((f.slots as { text: string }).text, 'invente-moi une recette avec du poulet');
});

test('the language preference does not block the other language', () => {
  assert.equal(parse('add milk to my shopping list', 'fr').intent, 'groceries.add');
  assert.equal(parse('ajoute du lait à la liste de courses', 'en').intent, 'groceries.add');
  assert.equal(parse('ajoute du lait à la liste de courses', 'ar').intent, 'groceries.add');
});

test('politeness and filler words are ignored', () => {
  assert.equal(parse('hey Siri, add eggs to my list please', 'en').intent, 'groceries.add');
  assert.equal(parse('peux-tu lancer ma séance stp').intent, 'workout.start');
  assert.equal(parse('can you start a timer for 5 minutes', 'en').intent, 'timer.start');
});

test('the app name works as a wake word (new and old name)', () => {
  assert.equal(parse('hey Valyyu, add eggs to my list', 'en').intent, 'groceries.add');
  assert.equal(parse('dis valyu, ajoute du lait à la liste de courses').intent, 'groceries.add');
  assert.equal(parse('ok vayylo ajoute du lait à la liste de courses').intent, 'groceries.add');
});

test('parser never throws on odd input', () => {
  for (const text of ['💥', '(((', 'plus de', 'j’ai mangé', 'i had', 'timer', 'objectif', '0 0 0']) {
    assert.doesNotThrow(() => parse(text));
  }
});

test('plan.week: English and French phrasings', () => {
  for (const [text, lang] of [
    ['plan my week', 'en'],
    ['Please plan my week', 'en'],
    ['generate my menu', 'en'],
    ['can you plan my meals for the week', 'en'],
    ['planifie ma semaine', 'fr'],
    ['génère mon menu', 'fr'],
    ['génère le menu de la semaine', 'fr'],
    ['organise mes repas', 'fr'],
  ] as const) {
    const r = parseCommand(text, { lang, now: new Date(2026, 9, 15, 9) });
    assert.equal(r.intent, 'plan.week', text);
    assert.ok(r.confidence >= 0.8, text);
  }
});

test('plan.today: what is for dinner / what do I cook today', () => {
  const now = new Date(2026, 9, 15, 9);
  for (const [text, lang] of [
    ["what's for dinner", 'en'],
    ['what do I cook today', 'en'],
    ["what's for dinner tonight", 'en'],
    ['what should we eat today', 'en'],
    ["qu'est-ce qu'on mange ce soir", 'fr'],
    ['on mange quoi ce soir', 'fr'],
    ['qu’est-ce que je cuisine aujourd’hui', 'fr'],
  ] as const) {
    const r = parseCommand(text, { lang, now });
    assert.equal(r.intent, 'plan.today', text);
  }
  const dinner = parseCommand("what's for dinner", { lang: 'en', now });
  assert.deepEqual(dinner.slots, { slot: 'dinner' });
  assert.deepEqual(parseCommand('what do I cook today', { lang: 'en', now }).slots, {});
});

test('plan phrases do not steal other commands', () => {
  const now = new Date(2026, 9, 15, 9);
  assert.equal(parseCommand('add milk to my list', { lang: 'en', now }).intent, 'groceries.add');
  assert.notEqual(parseCommand('I had dinner', { lang: 'en', now }).intent, 'plan.today');
  assert.equal(parseCommand('open meals', { lang: 'en', now }).intent, 'nav.open');
});
