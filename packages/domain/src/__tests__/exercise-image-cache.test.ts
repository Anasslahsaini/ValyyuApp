import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExerciseImageCache,
  ImageCacheError,
  MAX_CACHE_BYTES,
  MAX_BATCH_IMAGES,
  MAX_IMAGE_BYTES,
  type ImageStore,
  type CachedImage,
} from '../exercise-image-cache-core';
import { catalogueForWorkout, exerciseImages, exerciseLibrary, type ExerciseImage } from '../exercises';
import sizes from '../../data/free-exercise-db/image-sizes.json';
import provenance from '../../data/free-exercise-db/source.json';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const image = (n = 0, bytes = jpeg.length): ExerciseImage => ({
  key: `${provenance.revision}/Test/${n}.jpg`,
  path: `Test/${n}.jpg`,
  url: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${provenance.revision}/exercises/Test/${n}.jpg`,
  bytes,
});
function setup(download: (image: ExerciseImage) => Promise<Uint8Array> = async () => jpeg) {
  const files = new Map<string, CachedImage>();
  const removed: string[] = [];
  const store: ImageStore = {
    async list() {
      return [...files.values()];
    },
    async put(image, bytes) {
      files.set(image.key, { key: image.key, bytes: bytes.length, uri: `file://public/${image.key}` });
    },
    async remove(key) {
      removed.push(key);
      files.delete(key);
    },
  };
  return { files, store, removed, cache: new ExerciseImageCache(store, download) };
}
const rejectsCode = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: unknown) => error instanceof ImageCacheError && error.code === code);

test('catalogue image sizes cover every referenced image, with revision/path keys', () => {
  const resources = exerciseImages(exerciseLibrary);
  assert.equal(resources.length, Object.keys(sizes).length);
  assert.ok(resources.every((entry) => entry.bytes > 0 && entry.bytes <= MAX_IMAGE_BYTES));
  assert.ok(resources.every((entry) => entry.key === `${provenance.revision}/${entry.path}`));
  assert.deepEqual(
    exerciseImages(exerciseLibrary.filter((exercise) => provenance.missingImages.includes(exercise.id))),
    [],
  );
});
test('program downloads match exact catalogue names and ignore custom/renamed exercises', () => {
  const first = exerciseLibrary[0];
  assert.deepEqual(
    catalogueForWorkout([{ name: first.name }, { name: first.name }, { name: 'Personal move' }]),
    [first],
  );
  assert.equal(exerciseImages([first, first]).length, first.images.length);
  assert.throws(() => exerciseImages([{ images: ['https://other-host/image.jpg'] }]));
});
test('reading the cache never downloads images; an empty selection is safe', async () => {
  let calls = 0;
  const { cache } = setup(async () => {
    calls++;
    return jpeg;
  });
  assert.deepEqual(await cache.list(), []);
  await cache.save([]);
  assert.equal(calls, 0);
});
test('explicit downloads deduplicate, report progress, and survive a new cache instance', async () => {
  let calls = 0;
  const { cache, store } = setup(async () => {
    calls++;
    return jpeg;
  });
  const progress: number[] = [];
  await cache.save([image(), image(), image(1)], (done) => progress.push(done));
  assert.deepEqual(progress, [0, 1, 2]);
  const restarted = new ExerciseImageCache(store, async () => {
    throw Error('offline');
  });
  assert.equal((await restarted.list()).length, 2);
  await restarted.save([image(), image(1)]);
  assert.equal(calls, 2);
});
test('failed batches retain completed images and retry only missing ones', async () => {
  let fail = true;
  const calls: number[] = [];
  const { cache } = setup(async (entry) => {
    const n = Number(entry.path.split('/')[1].split('.')[0]);
    calls.push(n);
    if (n === 1 && fail) throw new ImageCacheError('network');
    return jpeg;
  });
  await rejectsCode(cache.save([image(), image(1)]), 'network');
  assert.equal((await cache.list()).length, 1);
  fail = false;
  await cache.save([image(), image(1)]);
  assert.deepEqual(calls, [0, 1, 1]);
});
test('selection and size limits are checked before any network request', async () => {
  let calls = 0;
  const { cache, files } = setup(async () => {
    calls++;
    return jpeg;
  });
  await rejectsCode(cache.save(Array.from({ length: MAX_BATCH_IMAGES + 1 }, (_, n) => image(n))), 'limit');
  await rejectsCode(cache.save([image(0, MAX_IMAGE_BYTES + 1)]), 'limit');
  files.set('old-revision/path', {
    key: 'old-revision/path',
    bytes: MAX_CACHE_BYTES,
    uri: 'file://public/old',
  });
  await rejectsCode(cache.save([image()]), 'limit');
  assert.equal(calls, 0);
});
test('invalid or incomplete images never become offline files', async () => {
  for (const bytes of [new Uint8Array([0xff, 0xd8]), new Uint8Array([1, 2, 3, 4])]) {
    const { cache } = setup(async () => bytes);
    await rejectsCode(cache.save([image()]), 'invalid');
    assert.deepEqual(await cache.list(), []);
  }
});
test('a cached file with the wrong byte size is replaced on explicit retry', async () => {
  const { cache, files } = setup();
  files.set(image().key, { key: image().key, bytes: 2, uri: 'file://public/truncated' });
  await cache.save([image()]);
  assert.equal((await cache.list())[0].bytes, jpeg.length);
});
test('storage failure is explicit and does not poison the operation queue', async () => {
  const { cache, store } = setup();
  const put = store.put;
  store.put = async () => {
    throw new Error('Disk full');
  };
  await rejectsCode(cache.save([image()]), 'storage');
  store.put = put;
  await cache.save([image()]);
  assert.equal((await cache.list()).length, 1);
});
test('simultaneous requests are serialized and never download the same image twice', async () => {
  let calls = 0;
  const { cache } = setup(async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return jpeg;
  });
  await Promise.all([cache.save([image()]), cache.save([image()])]);
  assert.equal(calls, 1);
});
test('selective and complete cleanup affect only the dedicated public store including old revisions', async () => {
  const { cache, files, removed } = setup();
  const personal = { photos: ['file://wardrobe/personal.jpg'], backup: 'unchanged', sync: false };
  const before = structuredClone(personal);
  await cache.save([image(), image(1)]);
  await cache.remove([image().key]);
  assert.deepEqual(
    (await cache.list()).map((entry) => entry.key),
    [image(1).key],
  );
  files.set('old-revision/path', { key: 'old-revision/path', bytes: 4, uri: 'file://public/old' });
  await cache.remove();
  assert.equal(files.size, 0);
  assert.ok(removed.includes('old-revision/path'));
  assert.deepEqual(personal, before);
});
