import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  achievementCount,
  achievements,
  allAchievements,
  mealAchievements,
  styleAchievements,
} from '../achievements';
import { expoWeekday, planReminders, reminderKey, trainingDays } from '../daily-reminders';

const meal = (id: string, date: string, ref?: string) => ({
  id,
  name: 'Soup',
  date,
  slot: 'lunch' as const,
  calories: 300,
  protein: 10,
  carbs: 30,
  fat: 10,
  estimated: true,
  servings: 1,
  ...(ref ? { foodRef: { source: 'manual' as const, id: ref } } : {}),
});
const byId = <T extends { id: string }>(l: T[]) => Object.fromEntries(l.map((a) => [a.id, a]));

test('fitness list keeps its ids (Fitness tab unchanged)', () => {
  const ids = achievements({ sessions: [], meals: [], outfits: [], weightEntries: [] }).map((a) => a.id);
  assert.equal(ids.length, 16);
  assert.ok(ids.includes('firstSession') && ids.includes('sessions100'));
  assert.ok(!ids.includes('firstMeal' as never));
});

test('meal achievements: logged days, cooked, fridge, plan', () => {
  const meals = [
    ...Array.from({ length: 7 }, (_, i) => meal(`m${i}`, `2026-10-0${i + 1}`)),
    meal('c1', '2026-10-08', 'plan-2026-10-08-lunch'),
    meal('c2', '2026-10-08', 'cat-chickpea-salad'),
  ];
  const a = byId(mealAchievements({ meals, plannedMeals: [] }));
  assert.equal(a.firstMeal.unlocked, true);
  assert.equal(a.mealDays7.unlocked, true);
  assert.equal(a.firstCooked.unlocked, true);
  assert.equal(a.fridgeCooked.unlocked, true);
  assert.equal(a.firstPlan.unlocked, false);
  assert.equal(a.cooked10.progress, 2);
  const none = byId(mealAchievements({ meals: [meal('x', '2026-10-01')] }));
  assert.equal(none.firstCooked.unlocked, false);
  assert.equal(none.mealDays7.progress, 1);
});

test('style achievements: worn outfits, wardrobe, scans', () => {
  const wardrobe = Array.from({ length: 10 }, (_, i) => ({
    id: `w${i}`,
    name: 'Tee',
    category: 'top' as const,
    color: 'white',
  }));
  const outfits = [{ id: 'o', name: 'Look', itemIds: ['w0'], wornOn: ['2026-10-01', '2026-10-02'] }];
  const a = byId(styleAchievements({ wardrobe, outfits }, 1));
  assert.equal(a.firstWorn.unlocked, true);
  assert.equal(a.worn10.progress, 2);
  assert.equal(a.wardrobe10.unlocked, true);
  assert.equal(a.firstScan.unlocked, true);
  assert.equal(byId(styleAchievements({ wardrobe: [], outfits: [] })).firstScan.unlocked, false);
});

test('all achievements: unique ids and a count', () => {
  const g = allAchievements({ sessions: [], meals: [], outfits: [], weightEntries: [], wardrobe: [] }, 3, {
    scans: 1,
  });
  const ids = [...g.fitness, ...g.meals, ...g.style].map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(achievementCount(g), { unlocked: 1, total: ids.length });
});

test('training days are spread and match the count', () => {
  assert.deepEqual(trainingDays(0), []);
  assert.deepEqual(trainingDays(undefined), []);
  assert.deepEqual(trainingDays(3), [1, 3, 5]);
  for (let n = 1; n <= 7; n++) assert.equal(new Set(trainingDays(n)).size, n);
  assert.equal(trainingDays(12).length, 7);
});

test('at most one reminder per day; both on a training day merge into one morning message', () => {
  const plan = planReminders({ sessions: true, outfit: true, sessionsPerWeek: 3, trainingPlace: 'gym' });
  assert.equal(plan.length, 7);
  assert.equal(new Set(plan.map((r) => r.weekday)).size, 7);
  assert.deepEqual(
    plan.filter((r) => r.kind === 'both').map((r) => r.weekday),
    [1, 3, 5],
  );
  assert.ok(plan.every((r) => r.hour === 7 && r.minute === 30));
});

test('session reminders only on training days at 18:00; none without sport', () => {
  const s = planReminders({ sessions: true, outfit: false, sessionsPerWeek: 2 });
  assert.deepEqual(
    s.map((r) => [r.weekday, r.kind, r.hour]),
    [
      [2, 'session', 18],
      [5, 'session', 18],
    ],
  );
  assert.deepEqual(
    planReminders({ sessions: true, outfit: false, sessionsPerWeek: 4, trainingPlace: 'none' }),
    [],
  );
  assert.deepEqual(planReminders({ sessions: false, outfit: false, sessionsPerWeek: 4 }), []);
  assert.equal(planReminders({ sessions: false, outfit: true }).filter((r) => r.kind === 'outfit').length, 7);
  assert.equal(planReminders({ sessions: true, outfit: false }).length, 3, 'defaults to 3 sessions a week');
});

test('expo weekday mapping and key', () => {
  assert.equal(expoWeekday(1), 2); // Monday
  assert.equal(expoWeekday(7), 1); // Sunday
  const p = planReminders({ sessions: true, outfit: false, sessionsPerWeek: 1 });
  assert.notEqual(reminderKey(p, 'fr'), reminderKey(p, 'en'));
  assert.equal(
    reminderKey(p, 'fr'),
    reminderKey(planReminders({ sessions: true, outfit: false, sessionsPerWeek: 1 }), 'fr'),
  );
});

import { mixStylePhotos, parseStylePhotos, stylePhotos } from '../style-photos';

test('style photos: parse, mix and fetch', async () => {
  const p = (id: string) => ({
    url: `https://img/${id}.jpg`,
    thumb: `https://img/${id}-s.jpg`,
    alt: '',
    credit: id,
    link: 'https://www.pexels.com/x',
  });
  assert.deepEqual(parseStylePhotos(null), []);
  assert.deepEqual(
    parseStylePhotos({ photos: [{ url: 'http://bad' }, p('a')] }).map((x) => x.credit),
    ['a'],
  );
  assert.deepEqual(
    mixStylePhotos([[p('a1'), p('a2'), p('a3')], [p('b1')]]).map((x) => x.credit),
    ['a1', 'b1', 'a2', 'a3'],
  );
  assert.deepEqual(mixStylePhotos([]), []);
  let url = '';
  const fetcher = (async (u: string) => {
    url = u;
    return { ok: true, json: async () => ({ photos: [p('c')] }) };
  }) as unknown as typeof fetch;
  const got = await stylePhotos('chic', (path) => `https://api${path}`, fetcher);
  assert.equal(url, 'https://api/api/style/photos?style=chic');
  assert.equal(got.length, 1);
  const off = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  assert.deepEqual(await stylePhotos('street', (path) => path, off), []);
});
