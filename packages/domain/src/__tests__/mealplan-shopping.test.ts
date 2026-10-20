/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GroceryItemSchema, type GroceryItem } from '../life';
import { buildShoppingList, planWeek, quantityText, displayQuantity, shoppingToGroceries } from '../mealplan';
import type { CookEvent, PlanRecipe, ShoppingOptions } from '../mealplan';
import { baseInput, PRICES, recipe } from './mealplan-fixtures';

const opts = (over: Partial<ShoppingOptions> = {}): ShoppingOptions => ({
  pantry: [],
  prices: PRICES,
  currency: 'EUR',
  ...over,
});
const ev = (r: PlanRecipe, servings: number, date = '2026-10-19'): CookEvent => ({
  recipe: r,
  servings,
  date,
});
const line = (res: ReturnType<typeof buildShoppingList>, id: string) =>
  res.lines.find((l) => l.ingredientId === id)!;
const cr = recipe('cr', 'Chicken rice', {
  mins: [5, 10],
  ings: [
    ['chicken', 300],
    ['rice', 200],
    ['pepper', 150],
    ['onion', 110],
    ['olive-oil', 15],
  ],
  kcal: 600,
  servings: 2,
});
const mini = (id: string, ings: [string, number][], servings = 1) =>
  recipe(id, id, { mins: [1, 1], ings, kcal: 100, servings });

test('Needs scale with servings cooked (people x meals) and use pack sizes', () => {
  const r = buildShoppingList([ev(cr, 4)], opts());
  const chicken = line(r, 'chicken');
  assert.equal(chicken.neededGrams, 600);
  assert.equal(chicken.packs, 2);
  assert.equal(chicken.qty, 1000);
  assert.equal(chicken.unit, 'g');
  assert.equal(chicken.costEstimate, 9);
  assert.equal(line(r, 'rice').qty, 1000);
  assert.equal(line(r, 'rice').costEstimate, 2.2);
  assert.equal(line(r, 'pepper').qty, 300);
  assert.equal(line(r, 'pepper').costEstimate, 1.05);
  const onion = line(r, 'onion');
  assert.equal(onion.unit, 'piece');
  assert.equal(onion.qty, 2);
  assert.equal(onion.costEstimate, 0.6);
  assert.equal(r.total, 9 + 2.2 + 1.05 + 0.6);
});
test('Staples and optional ingredients are not shopped (unless includeStaples)', () => {
  const r = buildShoppingList([ev(cr, 2)], opts());
  assert.ok(!r.lines.some((l) => l.ingredientId === 'olive-oil'));
  assert.ok(
    buildShoppingList([ev(cr, 2)], opts({ includeStaples: true })).lines.some(
      (l) => l.ingredientId === 'olive-oil',
    ),
  );
  const opt = mini('o', [['rice', 100]]);
  opt.ingredients.push({ ...mini('p', [['cheese', 50]]).ingredients[0], optional: true });
  assert.ok(!buildShoppingList([ev(opt, 1)], opts()).lines.some((l) => l.ingredientId === 'cheese'));
});
test('Duplicates across recipes merge into one line with all recipe ids', () => {
  const a = mini('a', [
      ['carrot', 200],
      ['rice', 100],
    ]),
    b = mini('b', [['carrot', 150]]);
  const r = buildShoppingList([ev(a, 1), ev(b, 1, '2026-10-20')], opts());
  const carrots = r.lines.filter((l) => l.ingredientId === 'carrot');
  assert.equal(carrots.length, 1);
  assert.equal(carrots[0].neededGrams, 350);
  assert.equal(carrots[0].qty, 350);
  assert.deepEqual(carrots[0].forRecipeIds, ['a', 'b']);
});
test('Free-text ingredients without ids merge by tokens (Tomatoes + tomato)', () => {
  const mk = (name: string, grams: number): PlanRecipe => ({
    ...mini('x', [['rice', 1]]),
    id: name + grams,
    ingredients: [{ name, grams }],
  });
  const r = buildShoppingList([ev(mk('Tomatoes', 200), 1), ev(mk('tomato', 100), 1, '2026-10-20')], opts());
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].neededGrams, 300);
});
test('Pantry stock is subtracted (grams, partial cover, fully covered lines vanish)', () => {
  const r = buildShoppingList(
    [ev(cr, 2)],
    opts({
      pantry: [
        { name: 'bell pepper', quantity: '100 g' },
        { name: 'Rice', quantity: '1 kg' },
      ],
    }),
  );
  assert.equal(line(r, 'pepper').qty, 50);
  assert.equal(line(r, 'pepper').pantryGrams, 100);
  assert.equal(line(r, 'pepper').neededGrams, 150);
  assert.equal(line(r, 'rice'), undefined);
});
test('Pantry quantities are converted: l, kg, counts via piece weight', () => {
  const pancakes = mini('pc', [
    ['milk', 500],
    ['onion', 220],
  ]);
  const r = buildShoppingList(
    [ev(pancakes, 1)],
    opts({
      pantry: [
        { name: 'milk', quantity: '0.25 l' },
        { name: 'onion', quantity: '1' },
      ],
    }),
  );
  assert.equal(line(r, 'milk').pantryGrams, 250);
  assert.equal(line(r, 'milk').qty, 1000); // 250 ml left, bought as a 1 l pack
  assert.equal(line(r, 'onion').qty, 1); // 1 onion at home (110 g) of 2 needed
  const r2 = buildShoppingList(
    [ev(pancakes, 1)],
    opts({
      pantry: [
        { name: 'milk', quantity: '1,5 l' },
        { name: 'onion', quantity: '3' },
      ],
    }),
  );
  assert.equal(r2.lines.length, 0);
});
test('Unknown pantry quantity = available once; zero = nothing; expired = nothing', () => {
  const first = ev(mini('m1', [['rice', 200]]), 1, '2026-10-19'),
    later = ev(mini('m2', [['rice', 200]]), 1, '2026-10-23');
  const r = buildShoppingList([later, first], opts({ pantry: [{ name: 'rice', quantity: 'some' }] }));
  assert.equal(line(r, 'rice').neededGrams, 400);
  assert.equal(line(r, 'rice').pantryGrams, 200);
  assert.deepEqual(line(r, 'rice').forRecipeIds, ['m2']);
  const none = buildShoppingList([first], opts({ pantry: [{ name: 'rice', quantity: '0' }] }));
  assert.equal(line(none, 'rice').qty, 1000);
  const expired = buildShoppingList(
    [first],
    opts({ pantry: [{ name: 'rice', quantity: '2 kg', expiresOn: '2026-10-01' }] }),
  );
  assert.equal(line(expired, 'rice').pantryGrams, 0);
  const empty = buildShoppingList([first], opts({ pantry: [{ name: 'rice', quantity: '' }] }));
  assert.equal(line(empty, 'rice'), undefined);
});
test('One pantry item is shared between ingredients and recipes, not counted twice', () => {
  const a = mini('a', [['rice', 300]]),
    b = mini('b', [['rice', 300]]);
  const r = buildShoppingList(
    [ev(a, 1), ev(b, 1, '2026-10-20')],
    opts({ pantry: [{ name: 'rice', quantity: '400 g' }] }),
  );
  assert.equal(line(r, 'rice').pantryGrams, 400);
  assert.equal(line(r, 'rice').qty, 1000);
  assert.deepEqual(line(r, 'rice').forRecipeIds, ['b']);
});
test('Pack rounding: whole packs, 2% tolerance, and never less than one pack', () => {
  const q = (grams: number) =>
    line(buildShoppingList([ev(mini('p', [['chicken', grams]]), 1)], opts()), 'chicken');
  assert.equal(q(505).packs, 1);
  assert.equal(q(520).packs, 2);
  assert.equal(q(1).packs, 1);
  assert.equal(q(1200).qty, 1500);
  assert.equal(q(1200).costEstimate, 13.5);
});
test('Without a pack size the quantity rounds up to a sensible step', () => {
  const q = (grams: number) =>
    line(buildShoppingList([ev(mini('s', [['carrot', grams]]), 1)], opts()), 'carrot').qty;
  assert.deepEqual([q(60), q(100), q(130), q(500), q(700), q(2100)], [75, 100, 150, 500, 700, 2250]);
});
test('Counted ingredients round up to whole pieces', () => {
  const t = line(buildShoppingList([ev(mini('t', [['tomato', 250]]), 1)], opts()), 'tomato');
  assert.equal(t.unit, 'piece');
  assert.equal(t.qty, 3);
  assert.equal(t.costEstimate, 1.2);
});
test('Liquids are bought in ml and priced per litre', () => {
  const m = line(buildShoppingList([ev(mini('m', [['milk', 300]]), 1)], opts()), 'milk');
  assert.equal(m.unit, 'ml');
  assert.equal(m.qty, 1000);
  assert.equal(m.costEstimate, 1.1);
  const coconut = line(
    buildShoppingList([ev(mini('c', [['coconut-milk', 500]]), 1)], opts()),
    'coconut-milk',
  );
  assert.equal(coconut.qty, 800);
  assert.equal(coconut.costEstimate, 2.8);
});
test('Price level (low/mid/high) and currency index change the cost', () => {
  const cost = (o: Partial<ShoppingOptions>) =>
    buildShoppingList([ev(mini('c', [['carrot', 300]]), 1)], opts(o)).total;
  assert.equal(cost({}), 0.42);
  assert.equal(cost({ priceLevel: 'low' }), 0.29);
  assert.equal(cost({ priceLevel: 'high' }), 0.59);
  assert.equal(cost({ currency: 'USD' }), 0.46);
  assert.equal(cost({ currency: 'MAD' }), 0.32);
  assert.equal(cost({ currency: 'XYZ' }), 0.42);
});
test('Custom prices override the table by id, by name or by token key, in the user currency', () => {
  const cost = (customPrices: Record<string, number>, currency = 'EUR') =>
    buildShoppingList([ev(mini('c', [['carrot', 300]]), 1)], opts({ customPrices, currency })).total;
  assert.equal(cost({ carrot: 3 }), 0.9);
  assert.equal(cost({ carrots: 4 }), 1.2);
  assert.equal(cost({ carrot: 3 }, 'USD'), 0.9); // user prices are already in their currency
  assert.equal(cost({ potato: 3 }), 0.42);
  const free = buildShoppingList(
    [ev(mini('c', [['carrot', 300]]), 1)],
    opts({ customPrices: { carrot: 0 } }),
  );
  assert.equal(free.total, 0);
});
test('Custom piece prices apply per piece', () => {
  assert.equal(
    line(
      buildShoppingList([ev(mini('t', [['tomato', 250]]), 1)], opts({ customPrices: { tomato: 0.5 } })),
      'tomato',
    ).costEstimate,
    1.5,
  );
});
test('Missing prices: line flagged priceKnown=false, excluded from totals, counted in a warning', () => {
  const noPrice: PlanRecipe = {
    ...mini('np', [['rice', 1]]),
    ingredients: [
      { name: 'Dragon fruit', grams: 200 },
      ...mini('np2', [['carrot', 300]]).ingredients.map((i) => ({ ...i, cost: undefined })),
    ],
  };
  const r = buildShoppingList([ev(noPrice, 1)], opts());
  const d = r.lines.find((l) => l.name === 'Dragon fruit')!;
  assert.equal(d.priceKnown, false);
  assert.equal(d.costEstimate, 0);
  assert.equal(r.total, 0.42);
  assert.equal(r.unpricedCount, 1);
  assert.deepEqual(r.warnings, [{ code: 'price_missing', params: { count: 1 } }]);
  assert.equal(buildShoppingList([ev(mini('x', [['carrot', 100]]), 1)], opts()).warnings.length, 0);
});
test('Without a price table the recipe ingredient cost is the fallback (level and currency still apply)', () => {
  const r = mini('f', [['chicken', 300]]);
  const base = buildShoppingList([ev(r, 1)], { pantry: [], currency: 'EUR' });
  assert.equal(line(base, 'chicken').priceKnown, true);
  assert.equal(base.total, 2.7);
  assert.equal(buildShoppingList([ev(r, 1)], { pantry: [], currency: 'EUR', priceLevel: 'low' }).total, 2.16);
});
test('A custom price still works for free-text (user recipe) ingredients', () => {
  const user: PlanRecipe = {
    ...mini('u', [['rice', 1]]),
    ingredients: [
      { name: 'Olive oil', grams: 100, unit: 'ml' },
      { name: 'Merguez', grams: 400 },
    ],
  };
  const r = buildShoppingList([ev(user, 1)], opts({ customPrices: { 'olive oil': 8, merguez: 12 } }));
  const merguez = r.lines.find((l) => l.name === 'Merguez')!;
  assert.equal(merguez.costEstimate, 4.8);
  assert.equal(r.lines.find((l) => l.name === 'Olive oil')!.costEstimate, 0.8);
  assert.equal(r.unpricedCount, 0);
});
test('Output order is stable: category aisle then name, whatever the event order', () => {
  const a = mini('a', [
    ['rice', 100],
    ['chicken', 100],
    ['carrot', 100],
    ['cheese', 100],
    ['salmon', 100],
  ]);
  const r1 = buildShoppingList([ev(a, 1)], opts()),
    r2 = buildShoppingList(
      [
        ev(
          mini('z', [
            ['salmon', 100],
            ['cheese', 100],
            ['carrot', 100],
            ['chicken', 100],
            ['rice', 100],
          ]),
          1,
        ),
      ],
      opts(),
    );
  assert.deepEqual(
    r1.lines.map((l) => l.ingredientId),
    ['carrot', 'chicken', 'salmon', 'cheese', 'rice'],
  );
  assert.deepEqual(
    r2.lines.map((l) => l.ingredientId),
    r1.lines.map((l) => l.ingredientId),
  );
});
test('Free-text lines without a quantity are bought once unless the pantry has the item', () => {
  const user: PlanRecipe = { ...mini('u', [['rice', 1]]), ingredients: [{ name: 'Curry paste', grams: 0 }] };
  const r = buildShoppingList([ev(user, 1)], opts());
  assert.equal(r.lines[0].qty, 250);
  assert.equal(r.lines[0].priceKnown, false);
  assert.equal(
    buildShoppingList([ev(user, 1)], opts({ pantry: [{ name: 'curry paste', quantity: '1 jar' }] })).lines
      .length,
    0,
  );
});
test('quantityText / displayQuantity use kg and l from 1000', () => {
  assert.equal(quantityText({ qty: 1500, unit: 'g' }), '1.5 kg');
  assert.equal(quantityText({ qty: 750, unit: 'g' }), '750 g');
  assert.equal(quantityText({ qty: 1000, unit: 'ml' }), '1 l');
  assert.equal(quantityText({ qty: 250, unit: 'ml' }), '250 ml');
  assert.equal(quantityText({ qty: 6, unit: 'piece' }), '6');
  assert.deepEqual(displayQuantity({ qty: 2250, unit: 'g' }), { value: 2.25, unit: 'kg' });
});

const item = (over: Partial<GroceryItem>): GroceryItem => ({
  id: 'g1',
  name: 'Carrots',
  quantity: '300 g',
  estimatedCost: 0.5,
  checked: false,
  ...over,
});
let n = 0;
const ids = () => `new-${++n}`;
test('shoppingToGroceries: new records carry quantity, cost, recipe ids, checked=false and validate', () => {
  const r = buildShoppingList([ev(cr, 2)], opts());
  const out = shoppingToGroceries(r.lines, [], ids);
  assert.equal(out.add.length, r.lines.length);
  assert.deepEqual(out.update, []);
  for (const g of out.add) GroceryItemSchema.parse(g);
  const chicken = out.add.find((g) => g.name === 'Chicken breast')!;
  assert.equal(chicken.checked, false);
  assert.equal(chicken.estimatedCost, 4.5);
  assert.equal(chicken.quantity, '500 g');
  assert.deepEqual(chicken.recipeIds, ['cr']);
});
test('shoppingToGroceries dedupes against the open list and is idempotent', () => {
  const lines = buildShoppingList([ev(mini('r1', [['carrot', 300]]), 1)], opts()).lines;
  const existing = [item({ recipeIds: ['r1'] })];
  const same = shoppingToGroceries(lines, existing, ids);
  assert.deepEqual([same.add.length, same.update.length, same.skipped], [0, 0, ['Carrots']]);
  const first = shoppingToGroceries(lines, [], ids);
  assert.equal(shoppingToGroceries(lines, first.add, ids).add.length, 0);
});
test('shoppingToGroceries tops up an open item for a new recipe and ignores checked items', () => {
  const lines = buildShoppingList([ev(mini('r2', [['carrot', 200]]), 1)], opts()).lines;
  const up = shoppingToGroceries(
    lines,
    [item({ recipeIds: ['r1'], quantity: '300 g', estimatedCost: 0.5 })],
    ids,
  );
  assert.equal(up.update.length, 1);
  assert.equal(up.update[0].id, 'g1');
  assert.equal(up.update[0].quantity, '500 g');
  assert.deepEqual(up.update[0].recipeIds, ['r1', 'r2']);
  assert.equal(up.update[0].estimatedCost, 0.78);
  const checked = shoppingToGroceries(lines, [item({ checked: true, recipeIds: ['r2'] })], ids);
  assert.equal(checked.add.length, 1);
  const manual = shoppingToGroceries(lines, [item({ quantity: 'a bunch' })], ids);
  assert.equal(manual.update[0].quantity, 'a bunch + 200 g');
});
test('A planned week turns into valid groceries end to end', () => {
  const r = planWeek(baseInput({ seed: 2, pantry: [{ name: 'rice', quantity: '1 kg' }] }));
  const out = shoppingToGroceries(r.shopping, [], ids);
  assert.equal(out.add.length, r.shopping.length);
  for (const g of out.add) GroceryItemSchema.parse(g);
  assert.ok(!out.add.some((g) => g.name === 'Rice'));
  assert.ok(
    Math.abs(out.add.reduce((s, g) => s + g.estimatedCost, 0) - r.totals.cost) < 0.011 * out.add.length,
  );
  assert.equal(
    r.shopping.every((l) => l.priceKnown),
    true,
  );
});
