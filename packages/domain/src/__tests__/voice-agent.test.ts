import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLifeState, type LifeState } from '../life';
import {
  actionToIntent,
  actionsToIntents,
  buildSummary,
  failureFromError,
  failureFromStatus,
  needsYes,
  runIntents,
} from '../voice/agent';
import { applyPatch, dateKey } from '../voice/execute';

const now = new Date(2026, 9, 15, 13, 0);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const undoAll = (state: LifeState, patches: { upserts: never[] }[] | ReturnType<typeof runIntents>['undo']) =>
  (patches as ReturnType<typeof runIntents>['undo']).reduce(applyPatch, state);

test('each tool call maps to the same intent the local parser produces', () => {
  assert.deepEqual(
    actionToIntent(
      { name: 'add_groceries', args: { items: [{ name: 'lait', quantity: '1 l' }, 'pain'] } },
      now,
    ),
    {
      intent: 'groceries.add',
      slots: {
        items: [
          { name: 'lait', quantity: '1 l' },
          { name: 'pain', quantity: '' },
        ],
      },
      confidence: 1,
    },
  );
  assert.equal(
    actionToIntent({ name: 'add_to_fridge', args: { items: [{ name: 'oeufs' }] } }, now)?.intent,
    'pantry.add',
  );
  assert.equal(
    actionToIntent({ name: 'remove_from_fridge', args: { items: [{ name: 'oeufs', quantity: '3' }] } }, now)
      ?.intent,
    'pantry.remove',
  );
  assert.deepEqual(
    actionToIntent({ name: 'log_meal', args: { items: [{ name: 'Pâtes', servings: 2 }] } }, now),
    {
      intent: 'meal.log',
      slots: { items: [{ name: 'Pâtes', servings: 2 }], slot: 'lunch', daysAgo: 0, slotExplicit: false },
      confidence: 1,
    },
  );
  assert.deepEqual(
    actionToIntent({ name: 'log_meal', args: { items: ['soupe'], slot: 'dinner', daysAgo: 1 } }, now)?.slots,
    { items: [{ name: 'soupe', servings: 1 }], slot: 'dinner', daysAgo: 1, slotExplicit: true },
  );
  assert.deepEqual(actionToIntent({ name: 'repeat_meal', args: { slot: 'lunch' } }, now)?.slots, {
    slot: 'lunch',
    daysAgo: 1,
  });
  assert.equal(actionToIntent({ name: 'plan_week', args: {} }, now)?.intent, 'plan.week');
  assert.equal(actionToIntent({ name: 'show_today_meal', args: {} }, now)?.intent, 'plan.today');
  assert.deepEqual(actionToIntent({ name: 'start_workout', args: { planName: 'Push' } }, now)?.slots, {
    planName: 'Push',
  });
  assert.equal(actionToIntent({ name: 'log_set', args: { text: '3x10 60 kg' } }, now)?.intent, 'set.log');
  assert.deepEqual(actionToIntent({ name: 'start_timer', args: { seconds: 90 } }, now)?.slots, {
    seconds: 90,
  });
  assert.deepEqual(actionToIntent({ name: 'log_weight', args: { value: 72.5, unit: 'kg' } }, now)?.slots, {
    value: 72.5,
    unit: 'kg',
  });
  assert.deepEqual(
    actionToIntent({ name: 'set_targets', args: { calories: 2100.4, budget: 80, currency: 'eur' } }, now)
      ?.slots,
    { calories: 2100, budget: 80, currency: 'EUR' },
  );
  assert.equal(actionToIntent({ name: 'outfit_today', args: {} }, now)?.intent, 'outfit.today');
  assert.deepEqual(
    actionToIntent(
      { name: 'add_wardrobe_item', args: { name: 'Chino marine', category: 'bottom', color: 'navy' } },
      now,
    )?.slots,
    { name: 'Chino marine', category: 'bottom', color: 'navy' },
  );
  assert.deepEqual(actionToIntent({ name: 'navigate', args: { target: 'fitness.history' } }, now)?.slots, {
    target: 'fitness.history',
  });
});

test('invalid tool calls are dropped, never guessed', () => {
  const bad = [
    { name: 'delete_all', args: {} },
    { name: 'add_groceries', args: { items: [] } },
    { name: 'log_meal', args: { items: [{ name: ' ' }] } },
    { name: 'start_timer', args: { seconds: -5 } },
    { name: 'set_targets', args: { calories: 99999 } },
    { name: 'navigate', args: { target: '/admin' } },
    { name: 'add_wardrobe_item', args: { name: 'Hat', category: 'hat' } },
    { name: 'repeat_meal', args: {} },
    null,
    'x',
  ];
  const { intents, dropped } = actionsToIntents(bad, now);
  assert.equal(intents.length, 0);
  assert.equal(dropped, bad.length);
  assert.equal(
    actionsToIntents(
      Array.from({ length: 9 }, () => ({ name: 'outfit_today', args: {} })),
      now,
    ).intents.length,
    6,
  );
  assert.deepEqual(actionsToIntents(undefined, now), { intents: [], dropped: 0 });
});

test('destructive or big actions need an explicit Yes', () => {
  const i = (name: string, args: Record<string, unknown> = {}) => actionToIntent({ name, args }, now)!;
  assert.equal(needsYes([i('add_groceries', { items: ['lait'] })]), false);
  assert.equal(needsYes([i('add_groceries', { items: ['lait'] }), i('plan_week')]), true);
  assert.equal(needsYes([i('remove_from_fridge', { items: ['lait'] })]), true);
  assert.equal(needsYes([i('set_targets', { calories: 1800 })]), true);
});

test('several actions run in order through the local executor with one exact Undo', () => {
  const state = newLifeState();
  state.groceries = [{ id: 'g1', name: 'Lait', quantity: '', estimatedCost: 0, checked: false }];
  const before = clone(state);
  const { intents } = actionsToIntents(
    [
      { name: 'add_groceries', args: { items: [{ name: 'pain' }] } },
      { name: 'add_to_fridge', args: { items: [{ name: 'lait', quantity: '1' }] } },
      { name: 'log_meal', args: { items: [{ name: 'Salade' }], slot: 'lunch' } },
      { name: 'add_wardrobe_item', args: { name: 'chemise blanche', category: 'top', color: 'white' } },
      { name: 'log_weight', args: { value: 70 } },
      { name: 'navigate', args: { target: 'meals' } },
    ],
    now,
  );
  const run = runIntents(intents, state, now, { lang: 'fr', idPrefix: 't' });
  const after = run.changes.reduce(applyPatch, state);
  assert.deepEqual(after.groceries.map((g) => [g.name, g.checked]).sort(), [
    ['Lait', true],
    ['Pain', false],
  ]);
  assert.deepEqual(
    after.pantry.map((p) => p.name),
    ['Lait'],
  );
  assert.equal(after.meals[0]?.date, dateKey(now));
  assert.deepEqual(
    after.wardrobe.map((w) => [w.name, w.category, w.status]),
    [['Chemise blanche', 'top', 'clean']],
  );
  assert.equal(after.weightEntries[0]?.weight, 70);
  assert.equal(
    new Set(
      [...after.groceries, ...after.pantry, ...after.meals, ...after.wardrobe, ...after.weightEntries].map(
        (r) => r.id,
      ),
    ).size,
    6,
  );
  assert.deepEqual(run.navigate, { pathname: '/meals' });
  assert.match(run.message, /pain/);
  assert.match(run.message, /garde-robe/);
  assert.deepEqual(undoAll(after, run.undo), before);
});

test('a wardrobe piece already owned is not added twice', () => {
  const state = newLifeState();
  state.wardrobe = [{ id: 'w1', name: 'Jean bleu', category: 'bottom', color: 'blue' }];
  const run = runIntents(
    [actionToIntent({ name: 'add_wardrobe_item', args: { name: 'jean bleu', category: 'bottom' } }, now)!],
    state,
    now,
    { lang: 'fr' },
  );
  assert.equal(run.changes.length, 0);
  assert.equal(run.undo.length, 0);
  assert.match(run.message, /Déjà/);
});

test('data summary is compact JSON with the user own data and stays under the limit', () => {
  const state = newLifeState();
  state.settings = { ...state.settings, calorieTarget: 2000, firstName: 'Sam' };
  state.meals = [
    {
      id: 'm1',
      name: 'Omelette',
      date: dateKey(now),
      slot: 'breakfast',
      calories: 300,
      protein: 20,
      carbs: 2,
      fat: 22,
      estimated: false,
      servings: 2,
    },
  ];
  state.pantry = Array.from({ length: 2000 }, (_, i) => ({
    id: `p${i}`,
    name: `Produit numéro ${i} avec un nom long`,
    quantity: '1',
  }));
  const summary = buildSummary(state, now);
  assert.ok(summary.length <= 7500);
  const data = JSON.parse(summary);
  assert.equal(data.targets.calories, 2000);
  assert.equal(data.eatenToday.calories, 600);
  assert.equal(data.profile.firstName, 'Sam');
  assert.ok(data.fridge.length > 0 && data.fridge.length <= 60);
  assert.ok(!summary.includes('"p1"'));
});

test('server status → short fallback reason', () => {
  assert.equal(failureFromStatus(503), 'off');
  assert.equal(failureFromStatus(429), 'limit');
  assert.equal(failureFromStatus(402), 'limit');
  assert.equal(failureFromStatus(502), 'down');
  assert.equal(failureFromStatus(undefined), 'down');
});

test('monthly AI budget used → its own reason, so the app says it and stays in simple mode', () => {
  assert.equal(failureFromError({ status: 429, data: { error: 'x', code: 'ai_budget' } }), 'budget');
  assert.equal(failureFromError({ status: 429, data: { error: 'slow down' } }), 'limit');
  assert.equal(failureFromError({ status: 503, data: null }), 'off');
  assert.equal(failureFromError(new Error('offline')), 'down');
  assert.equal(failureFromError(undefined), 'down');
});
