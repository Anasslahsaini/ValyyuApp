import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exerciseLibrary } from '../exercises';
import {
  translationRequest,
  translationKey,
  translatePublicExercise,
  validateTranslation,
  type TranslationLanguage,
} from '../exercise-translations';
import { createTranslationCache } from '../public-translation-cache';
import source from '../../data/free-exercise-db/source.json';

const exercise = {
  id: 'public-test',
  name: 'Public exercise',
  instructions: ['Do not lock your knees. Hold for 10 seconds.', 'Lower 3/4 of the way down.'],
};
const french = [
  'Ne bloquez pas les genoux. Maintenez la position pendant 10 secondes.',
  'Descendez aux 3/4 du mouvement.',
];
const languages: TranslationLanguage[] = ['fr', 'ar', 'es', 'pt', 'de'];

test('every source exercise fits the existing assistant contract without private context', () => {
  for (const entry of exerciseLibrary) {
    if (!entry.instructions.length) continue;
    for (const language of languages) {
      const request = translationRequest(entry, language);
      assert.deepEqual(Object.keys(request).sort(), ['area', 'language', 'message']);
      assert.ok(request.message.length <= 4000);
      assert.ok(request.message.includes(JSON.stringify(entry.instructions)));
      assert.equal(request.area, 'fitness');
    }
  }
});
test('only one explicit request is made, using public text; empty sources make none', async () => {
  let calls = 0;
  assert.deepEqual(
    await translatePublicExercise(exercise, 'fr', async (body) => {
      calls++;
      assert.deepEqual(Object.keys(body).sort(), ['area', 'language', 'message']);
      return { reply: JSON.stringify(french) };
    }),
    french,
  );
  assert.equal(calls, 1);
  await assert.rejects(() =>
    translatePublicExercise({ ...exercise, instructions: [] }, 'fr', async () => {
      calls++;
      return { reply: '[]' };
    }),
  );
  assert.equal(calls, 1);
});
test('valid translations preserve steps, numbers, units and negation in all five languages', () => {
  const examples: Record<TranslationLanguage, string[]> = {
    fr: french,
    es: [
      'No bloquees las rodillas. Mantén la posición durante 10 segundos.',
      'Baja hasta 3/4 del recorrido.',
    ],
    pt: ['Não bloqueie os joelhos. Mantenha a posição por 10 segundos.', 'Desça até 3/4 do percurso.'],
    de: ['Die Knie nicht durchstrecken. Die Position 10 Sekunden halten.', 'Bis zu 3/4 des Weges absenken.'],
    ar: ['لا تقفل ركبتيك. اثبت لمدة 10 ثوان.', 'اخفض جسمك إلى 3/4 المسافة.'],
  };
  for (const language of languages)
    assert.deepEqual(
      validateTranslation(exercise.instructions, examples[language], language),
      examples[language],
    );
});
test('unsafe, missing, invented, untranslated and malformed output is rejected', () => {
  for (const candidate of [
    [],
    [...french, 'Ajoutez 5 répétitions.'],
    ['Bloquez les genoux pendant 10 secondes.', french[1]],
    [french[0].replace('10', '20'), french[1]],
    [french[0].replace('secondes', 'minutes'), french[1]],
    [...exercise.instructions],
    [''],
    { instructions: french },
    [null, french[1]],
  ])
    assert.throws(() => validateTranslation(exercise.instructions, candidate, 'fr'));
  assert.throws(() => validateTranslation([], [], 'fr'));
  assert.throws(() => validateTranslation(exercise.instructions, french, 'ar'));
});
test('fractions, angles and imperial units are preserved without conversion', () => {
  assert.deepEqual(
    validateTranslation(
      ['Raise 6 inches at a 45 degree angle, then lower ¾.'],
      ['Montez de 6 pouces à un angle de 45 degrés, puis redescendez aux ¾.'],
      'fr',
    ),
    ['Montez de 6 pouces à un angle de 45 degrés, puis redescendez aux ¾.'],
  );
  assert.throws(() => validateTranslation(['Raise 6 inches.'], ['Montez de 6 centimètres.'], 'fr'));
  assert.throws(() => validateTranslation(['No bouncing.'], ['Faites des rebonds.'], 'fr'));
  assert.deepEqual(validateTranslation(['No bouncing.'], ['Ne faites pas de rebonds.'], 'fr'), [
    'Ne faites pas de rebonds.',
  ]);
});
test('provider failure and invalid JSON are explicit errors, never fabricated output', async () => {
  await assert.rejects(() =>
    translatePublicExercise(exercise, 'fr', async () => {
      throw new Error('Unavailable');
    }),
  );
  await assert.rejects(() => translatePublicExercise(exercise, 'fr', async () => ({ reply: 'not JSON' })));
});
test('cache persists independently and separates source revision, exercise and language', async () => {
  let raw: string | null = null;
  const storage = {
    read: async () => raw,
    write: async (value: string) => {
      raw = value;
    },
  };
  const cache = createTranslationCache(storage);
  assert.equal(await cache.get(exercise, 'fr'), null);
  assert.equal(await cache.set(exercise, 'fr', french), true);
  assert.deepEqual(await createTranslationCache(storage).get(exercise, 'fr'), french);
  assert.equal(await cache.get(exercise, 'de'), null);
  assert.equal(await cache.get({ ...exercise, id: 'another' }, 'fr'), null);
  assert.equal(await cache.get({ ...exercise, instructions: ['Changed original.'] }, 'fr'), null);
  assert.ok(translationKey(exercise, 'fr').startsWith(`${source.revision}:fr:`));
  raw = raw!.replace(source.revision, 'older-revision');
  assert.equal(await cache.get(exercise, 'fr'), null);
});
test('cache corruption, unsafe cached content and storage failures do not replace originals', async () => {
  let raw: string | null = '{broken JSON';
  const cache = createTranslationCache({
    read: async () => raw,
    write: async (value) => {
      raw = value;
    },
  });
  assert.equal(await cache.get(exercise, 'fr'), null);
  await cache.set(exercise, 'fr', french);
  raw = raw!.replace('10 secondes', '20 secondes');
  assert.equal(await cache.get(exercise, 'fr'), null);
  const unavailable = createTranslationCache({
    read: async () => {
      throw Error('Unavailable');
    },
    write: async () => {
      throw Error('Full');
    },
  });
  assert.equal(await unavailable.get(exercise, 'fr'), null);
  assert.equal(await unavailable.set(exercise, 'fr', french), false);
  assert.deepEqual(exercise.instructions, [
    'Do not lock your knees. Hold for 10 seconds.',
    'Lower 3/4 of the way down.',
  ]);
});
test('cache is bounded and concurrent writes preserve other translations', async () => {
  let raw: string | null = null;
  const cache = createTranslationCache({
    read: async () => raw,
    write: async (value) => {
      raw = value;
    },
  });
  await Promise.all(
    Array.from({ length: 30 }, (_, index) =>
      cache.set({ ...exercise, id: `exercise-${index}` }, 'fr', french),
    ),
  );
  assert.equal(JSON.parse(raw!).entries.length, 24);
  assert.ok(raw!.length <= 100_000);
  assert.equal(await cache.get({ ...exercise, id: 'exercise-0' }, 'fr'), null);
  assert.deepEqual(await cache.get({ ...exercise, id: 'exercise-29' }, 'fr'), french);
});
