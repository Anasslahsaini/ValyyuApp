import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLifeState, type LifeState } from '../life';
import { parseCommand } from '../voice/intents';
import {
  applyPatch,
  executeIntent,
  dateKey,
  hasChanges,
  EXECUTE_MIN,
  type ExecResult,
} from '../voice/execute';
import { EXAMPLE_GROUPS, voiceExamples } from '../../constants/voice-strings';

const now = new Date(2026, 9, 15, 8, 30);
const run = (
  text: string,
  state: LifeState = newLifeState(),
  lang = 'fr',
): { result: ExecResult; after: LifeState } => {
  const result = executeIntent(parseCommand(text, { lang, now }), state, now, { lang, idPrefix: 'id' });
  return { result, after: applyPatch(state, result.changes) };
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

test('groceries.add writes records, confirms, and undo restores the exact previous state', () => {
  const state = newLifeState();
  const { result, after } = run('ajoute du lait et des œufs à la liste de courses', state);
  assert.equal(result.kind, 'done');
  assert.deepEqual(
    after.groceries.map((g) => g.name),
    ['Lait', 'Œufs'],
  );
  assert.ok(after.groceries.every((g) => !g.checked && g.estimatedCost === 0));
  assert.match(result.message, /lait et œufs/);
  assert.deepEqual(applyPatch(after, result.undo!), state);
});

test('groceries.add skips items already on the list and revives ticked ones', () => {
  const state = newLifeState();
  state.groceries = [
    { id: 'g1', name: 'Lait', quantity: '', estimatedCost: 0, checked: false },
    { id: 'g2', name: 'Pain', quantity: '', estimatedCost: 0, checked: true },
  ];
  const { result, after } = run('ajoute du lait et du pain à ma liste', state);
  assert.equal(after.groceries.length, 2);
  assert.equal(after.groceries.find((g) => g.id === 'g2')!.checked, false);
  assert.deepEqual(applyPatch(after, result.undo!), state);
  const dup = run('ajoute du lait à ma liste', state);
  assert.equal(dup.result.changes.upserts.length, 0);
  assert.equal(dup.result.undo, null);
  assert.match(dup.result.message, /Déjà sur la liste/);
});

test('pantry.add sums quantities, creates new items and ticks them off the shopping list', () => {
  const state = newLifeState();
  state.pantry = [{ id: 'p1', name: 'Œufs', quantity: '4' }];
  state.groceries = [{ id: 'g1', name: 'Riz', quantity: '', estimatedCost: 0, checked: false }];
  const { result, after } = run("j'ai acheté 6 œufs et du riz", state);
  assert.equal(after.pantry.find((p) => p.id === 'p1')!.quantity, '10');
  assert.equal(after.pantry.find((p) => p.name === 'Riz')!.quantity, '1');
  assert.equal(after.groceries[0].checked, true);
  assert.deepEqual(applyPatch(after, result.undo!), state);
});

test('pantry.remove deletes the item and puts it on the shopping list; undo restores both', () => {
  const state = newLifeState();
  state.pantry = [{ id: 'p1', name: 'Lait', quantity: '1 l' }];
  const { result, after } = run('plus de lait', state);
  assert.equal(after.pantry.length, 0);
  assert.deepEqual(
    after.groceries.map((g) => g.name),
    ['Lait'],
  );
  assert.deepEqual(applyPatch(after, result.undo!), state);
  const missing = run("I'm out of rice", newLifeState(), 'en');
  assert.deepEqual(
    missing.after.groceries.map((g) => g.name),
    ['Rice'],
  );
});

test('meal.log with no match saves unknown nutrients and never invents numbers', () => {
  const { result, after } = run("j'ai mangé deux œufs et une banane au petit déjeuner");
  assert.equal(after.meals.length, 2);
  for (const meal of after.meals) {
    assert.equal(meal.estimated, true);
    assert.deepEqual(meal.unknownNutrients, ['calories', 'protein', 'carbs', 'fat']);
    assert.equal(meal.calories, 0);
    assert.equal(meal.slot, 'breakfast');
    assert.equal(meal.date, '2026-10-15');
  }
  assert.equal(after.meals[0].servings, 2);
  assert.match(result.message, /nutrition à compléter/);
  assert.equal(applyPatch(after, result.undo!).meals.length, 0);
});

test('meal.log reuses macros from a past meal with the same name', () => {
  const state = newLifeState();
  state.meals = [
    {
      id: 'm1',
      name: 'Banane',
      date: '2026-10-10',
      slot: 'snack',
      calories: 105,
      protein: 1.3,
      carbs: 27,
      fat: 0.4,
      estimated: false,
      servings: 1,
    },
  ];
  const { after } = run("j'ai mangé deux bananes au petit déjeuner", state);
  const added = after.meals.find((m) => m.id !== 'm1')!;
  assert.equal(added.calories, 105);
  assert.equal(added.servings, 2);
  assert.equal(added.estimated, false);
  assert.equal(added.unknownNutrients, undefined);
});

test('meal.log reuses a matching recipe and honours "yesterday"', () => {
  const state = newLifeState();
  state.recipes = [
    {
      id: 'r1',
      name: 'Chicken salad',
      ingredients: ['chicken'],
      steps: ['mix'],
      calories: 420,
      protein: 35,
      carbs: 12,
      fat: 22,
    },
  ];
  const { after } = run('I had a chicken salad for lunch yesterday', state, 'en');
  const added = after.meals[0];
  assert.equal(added.calories, 420);
  assert.equal(added.slot, 'lunch');
  assert.equal(added.date, '2026-10-14');
});

test('meal.repeat copies yesterday’s slot to today and undo removes the copies', () => {
  const state = newLifeState();
  state.meals = [
    {
      id: 'a',
      name: 'Omelette',
      date: '2026-10-14',
      slot: 'lunch',
      calories: 300,
      protein: 20,
      carbs: 2,
      fat: 22,
      estimated: false,
      servings: 1,
    },
    {
      id: 'b',
      name: 'Soupe',
      date: '2026-10-14',
      slot: 'dinner',
      calories: 150,
      protein: 5,
      carbs: 20,
      fat: 4,
      estimated: false,
      servings: 1,
    },
  ];
  const { result, after } = run("pareil qu'hier au déjeuner", state);
  assert.equal(after.meals.length, 3);
  const copy = after.meals.find((m) => m.date === '2026-10-15')!;
  assert.equal(copy.name, 'Omelette');
  assert.notEqual(copy.id, 'a');
  assert.deepEqual(applyPatch(after, result.undo!), state);
  const none = run('same breakfast as yesterday', state, 'en');
  assert.equal(none.result.kind, 'error');
  assert.equal(none.result.changes.upserts.length, 0);
});

test('workout.start navigates to today’s session or to a matching plan', () => {
  const state = newLifeState();
  state.workouts = [
    {
      id: 'w1',
      name: 'Jambes',
      exercises: [
        {
          id: 'e1',
          name: 'Squat',
          muscle: 'legs',
          equipment: 'barbell',
          sets: 3,
          reps: 8,
          weight: 80,
          restSeconds: 90,
        },
      ],
    },
  ];
  assert.deepEqual(run('lance ma séance', state).result.navigate, {
    pathname: '/fitness',
    params: { action: 'startToday' },
  });
  assert.deepEqual(run('commence le plan Jambes', state).result.navigate, {
    pathname: '/fitness',
    params: { action: 'startPlan', workoutId: 'w1' },
  });
  assert.deepEqual(run('start push day', state, 'en').result.navigate, {
    pathname: '/fitness',
    params: { action: 'startToday' },
  });
});

test('set.log, outfit.today and nav.open use the navigation contract', () => {
  assert.deepEqual(run('3 séries de 10 à 60 kilos').result.navigate, {
    pathname: '/fitness',
    params: { action: 'logSet', text: '3 séries de 10 à 60 kilos' },
  });
  assert.deepEqual(run('what should I wear', newLifeState(), 'en').result.navigate, {
    pathname: '/style',
    params: { action: 'today' },
  });
  assert.deepEqual(run('ouvre les repas').result.navigate, { pathname: '/meals' });
  assert.deepEqual(run('historique').result.navigate, {
    pathname: '/fitness',
    params: { action: 'history' },
  });
});

test('timer.start returns the duration and a message', () => {
  const { result } = run('minuteur 90 secondes');
  assert.equal(result.kind, 'timer');
  assert.equal(result.timerSeconds, 90);
  assert.match(result.message, /1:30/);
  assert.equal(result.undo, null);
});

test('weight.log converts pounds, replaces today’s entry and undoes', () => {
  const lb = run('log my weight 160 pounds', newLifeState(), 'en');
  assert.equal(lb.after.weightEntries[0].weight, 72.6);
  assert.equal(lb.after.weightEntries[0].date, '2026-10-15');
  const state = newLifeState();
  state.weightEntries = [{ id: 'w', date: '2026-10-15', weight: 80 }];
  const { result, after } = run('je pèse 72,5 kilos', state);
  assert.deepEqual(after.weightEntries, [{ id: 'w', date: '2026-10-15', weight: 72.5 }]);
  assert.match(result.message, /72,5/);
  assert.deepEqual(applyPatch(after, result.undo!), state);
});

test('weight.log uses the preferred unit when none is spoken and rejects absurd values', () => {
  const state = newLifeState();
  state.settings.unit = 'lb';
  assert.equal(run('je pèse 150', state).after.weightEntries[0].weight, 68); // 150 in the preferred unit (lb)
  assert.equal(run('log my weight 10 kg', state, 'en').result.kind, 'error');
});

test('targets.set patches settings and undo restores them', () => {
  const state = newLifeState();
  state.settings.calorieTarget = 1800;
  const cal = run('objectif 2000 calories', state);
  assert.equal(cal.after.settings.calorieTarget, 2000);
  assert.deepEqual(applyPatch(cal.after, cal.result.undo!), state);
  const budget = run('budget 80 euros par semaine', state);
  assert.equal(budget.after.settings.weeklyBudget, 80);
  assert.equal(budget.after.settings.currency, 'EUR');
  assert.deepEqual(applyPatch(budget.after, budget.result.undo!), state);
});

test('an unknown phrase never navigates and offers three tailored examples', () => {
  const { result, after } = run('invente-moi une recette avec du poulet');
  assert.equal(result.kind, 'unknown');
  assert.equal(result.navigate, undefined);
  assert.equal(result.undo, null);
  assert.equal(result.examples?.length, 3);
  assert.deepEqual(result.examples, voiceExamples('fr', 'meals').slice(0, 3));
  assert.deepEqual(after, newLifeState());
  assert.equal(run('blah blah', newLifeState(), 'en').result.examples?.length, 3);
});

test('a medium-confidence guess asks for confirmation and runs only when confirmed', () => {
  const state = newLifeState();
  const parsed = parseCommand('add milk', { lang: 'en', now });
  assert.ok(parsed.confidence >= 0.6 && parsed.confidence < EXECUTE_MIN, String(parsed.confidence));
  const first = executeIntent(parsed, state, now, { lang: 'en', idPrefix: 'id' });
  assert.equal(first.kind, 'confirm');
  assert.equal(first.message, 'Add milk to your list');
  assert.equal(hasChanges(first.changes), false);
  assert.ok(first.pending);
  const yes = executeIntent(first.pending!, state, now, { lang: 'en', idPrefix: 'id', confirmed: true });
  assert.equal(yes.kind, 'done');
  assert.deepEqual(
    applyPatch(state, yes.changes).groceries.map((g) => g.name),
    ['Milk'],
  );
});

test('the first-run hint phrases run as written', () => {
  assert.deepEqual(
    run('add milk to groceries', newLifeState(), 'en').after.groceries.map((g) => g.name),
    ['Milk'],
  );
  assert.deepEqual(
    run('ajoute du lait aux courses').after.groceries.map((g) => g.name),
    ['Lait'],
  );
});

test('high-confidence commands execute without confirmation', () => {
  const { result } = run('add milk to my list', newLifeState(), 'en');
  assert.equal(result.kind, 'done');
});

test('every example in the "What can I say?" list runs as a real command', () => {
  for (const lang of ['en', 'fr']) {
    for (const group of EXAMPLE_GROUPS) {
      for (const example of voiceExamples(lang, group)) {
        const parsed = parseCommand(example, { lang, now });
        assert.notEqual(parsed.intent, 'fallback', `${lang}: ${example}`);
        assert.ok(parsed.confidence >= EXECUTE_MIN, `${lang}: ${example} (${parsed.confidence})`);
      }
    }
  }
});

test('produced records always satisfy the workspace schema', async () => {
  const { LifeSchema } = await import('../life');
  const state = newLifeState();
  state.pantry = [{ id: 'p1', name: 'Lait', quantity: '1' }];
  let current = state;
  for (const text of [
    'ajoute du lait à la liste',
    "j'ai acheté 6 œufs",
    'plus de lait',
    "j'ai mangé une pizza hier soir",
    'je pèse 72,5 kilos',
    'objectif 2100 calories',
  ]) {
    current = run(text, current).after;
    assert.doesNotThrow(() => LifeSchema.parse(clone(current)), text);
  }
});

test('dateKey is local and handles month boundaries', () => {
  assert.equal(dateKey(new Date(2026, 10, 1, 9), 1), '2026-10-31');
  assert.equal(dateKey(new Date(2026, 0, 1, 9), 1), '2025-12-31');
});

test('plan.week navigates to the Plan segment with the auto-run action', () => {
  for (const [text, lang] of [
    ['plan my week', 'en'],
    ['planifie ma semaine', 'fr'],
  ] as const) {
    const { result, after } = run(text, newLifeState(), lang);
    assert.equal(result.kind, 'navigate');
    assert.deepEqual(result.navigate, { pathname: '/meals', params: { action: 'planWeek' } });
    assert.deepEqual(after, newLifeState());
  }
});

test('plan.today reads the planned meal with minutes, or opens the plan when none exists', () => {
  const state = newLifeState();
  state.plannedMeals = [
    {
      id: 'pm-1',
      date: dateKey(now),
      slot: 'lunch',
      recipeId: 'a',
      recipeSource: 'catalogue',
      name: 'Shakshuka',
      servings: 1,
      minutes: 25,
    },
    {
      id: 'pm-2',
      date: dateKey(now),
      slot: 'dinner',
      recipeId: 'b',
      recipeSource: 'catalogue',
      name: 'Lentil soup',
      servings: 1,
      minutes: 30,
    },
  ];
  const en = run("what's for dinner", state, 'en').result;
  assert.equal(en.kind, 'done');
  assert.equal(en.message, 'Dinner: Lentil soup · 30 min');
  const fr = run("qu'est-ce qu'on mange ce soir", state, 'fr').result;
  assert.equal(fr.message, 'Dîner : Lentil soup · 30 min');
  const any = run('what do I cook today', state, 'en').result;
  assert.equal(any.message, 'Lunch: Shakshuka · 25 min');
  const none = run("what's for dinner", newLifeState(), 'en').result;
  assert.equal(none.kind, 'navigate');
  assert.deepEqual(none.navigate, { pathname: '/meals', params: { action: 'plan' } });
});
