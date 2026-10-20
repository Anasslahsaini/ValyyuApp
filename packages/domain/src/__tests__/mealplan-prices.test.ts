/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LifeSchema, newLifeState } from '../life';
import { buildShoppingList, learnCustomPrices } from '../mealplan';
import { MAX_CUSTOM_PRICES } from '../mealplan/prices';
import { recipe } from './mealplan-fixtures';

const g = (name: string, quantity: string, estimatedCost: number, checked = true) => ({
  name,
  quantity,
  estimatedCost,
  checked,
});

test('Learns per kg, per litre and per piece from checked items with quantity and cost', () => {
  const p = learnCustomPrices([
    g('Carrots', '500 g', 1),
    g('Olive oil', '750 ml', 6),
    g('Eggs', '12', 3.6),
    g('Rice', '2 kg', 5),
  ]);
  assert.deepEqual(p, { carrot: 2, 'olive oil': 8, egg: 0.3, rice: 2.5 });
});
test('Ignores unchecked, zero-cost, quantity-less, tiny, unit-less-weird and out-of-range items', () => {
  const p = learnCustomPrices([
    g('Carrots', '500 g', 1, false),
    g('Rice', '1 kg', 0),
    g('Pasta', '', 2),
    g('Salt', '5 g', 0.5),
    g('Gold', '1 kg', 900),
    g('Air', '1 kg', 0.01),
    g('Tomato', '3 cans', 3),
    g('Eggs', '500', 2),
    g('Milk', 'a lot', 2),
  ]);
  assert.deepEqual(p, {});
});
test('Several purchases of the same item use the median (robust to one outlier)', () => {
  const p = learnCustomPrices([
    g('Carrots', '1 kg', 1.5),
    g('Carrots', '1 kg', 1.7),
    g('Carrots', '1 kg', 20),
  ]);
  assert.equal(p.carrot, 1.7);
  assert.equal(learnCustomPrices([g('Carrots', '1 kg', 1), g('Carrots', '1 kg', 2)]).carrot, 1.5);
});
test('Existing prices move conservatively (max 40% per update) and unrelated ones are kept', () => {
  const existing = { carrot: 1, rice: 2 };
  const up = learnCustomPrices([g('Carrots', '1 kg', 10)], existing);
  assert.equal(up.carrot, 1.4);
  assert.equal(up.rice, 2);
  const mild = learnCustomPrices([g('Carrots', '1 kg', 1.2)], existing);
  assert.equal(mild.carrot, 1.1);
  const down = learnCustomPrices([g('Carrots', '1 kg', 0.3)], { carrot: 1 });
  assert.equal(down.carrot, 0.65);
  assert.deepEqual(existing, { carrot: 1, rice: 2 }); // input untouched
});
test('Bounded: never more than the schema allows, keys short, deterministic', () => {
  const many = Array.from({ length: 700 }, (_, i) =>
    g(
      `Thing${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}x`,
      '1 kg',
      3,
    ),
  );
  const p = learnCustomPrices(many);
  assert.ok(Object.keys(p).length <= MAX_CUSTOM_PRICES);
  assert.deepEqual(learnCustomPrices(many), p);
  const s = newLifeState();
  s.settings.customPrices = p;
  LifeSchema.parse(s);
  const long = learnCustomPrices([g('A'.repeat(200), '1 kg', 3)]);
  assert.ok(Object.keys(long).every((k) => k.length <= 80));
});
test('Learned prices feed the shopping list (round trip)', () => {
  const custom = learnCustomPrices([g('Carrots', '500 g', 2.5)]);
  const r = recipe('x', 'x', { mins: [1, 1], ings: [['carrot', 1000]], kcal: 100, servings: 1 });
  const res = buildShoppingList([{ recipe: r, servings: 1, date: '2026-10-19' }], {
    pantry: [],
    currency: 'EUR',
    customPrices: custom,
  });
  assert.equal(res.total, 5);
});
test('French names and accents are normalised to the same key', () => {
  assert.deepEqual(learnCustomPrices([g('Pommes de terre', '2 kg', 3)]), { pommedeterre: 1.5 });
  assert.deepEqual(learnCustomPrices([g('Crème fraîche', '200 g', 1.2)]), { creme: 6 });
});
