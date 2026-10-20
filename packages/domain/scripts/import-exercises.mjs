// Reproducible, data-only import. No upstream application code or user data is copied.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const revision = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const base = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${revision}`;
async function download(path) {
  const response = await fetch(`${base}/${path}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}
const [license, source, readme, treeResponse] = await Promise.all([
  download('LICENSE.md'),
  download('dist/exercises.json'),
  download('README.md'),
  fetch(`https://api.github.com/repos/yuhonas/free-exercise-db/git/trees/${revision}?recursive=1`, {
    signal: AbortSignal.timeout(30000),
  }),
]);
if (
  !license.startsWith('This is free and unencumbered software released into the public domain.') ||
  !license.includes('commercial or non-commercial')
)
  throw new Error('Unexpected license. Review before importing.');
const exercises = JSON.parse(source);
// Metadata only: never download image bytes or clone the upstream repository.
if (!treeResponse.ok) throw new Error(`Image metadata: HTTP ${treeResponse.status}`);
const tree = await treeResponse.json();
if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete image metadata.');
if (!readme.includes('Open Public Domain Exercise Dataset'))
  throw new Error('Review image licensing before importing.');
const sizes = new Map(tree.tree.filter((item) => item.type === 'blob').map((item) => [item.path, item.size]));
const imageSizes = {};
if (!Array.isArray(exercises) || exercises.length < 800) throw new Error('Incomplete exercise catalogue.');
const ids = new Set();
for (const exercise of exercises) {
  if (
    !exercise.id ||
    ids.has(exercise.id) ||
    !exercise.name ||
    !Array.isArray(exercise.primaryMuscles) ||
    !exercise.primaryMuscles.length ||
    !Array.isArray(exercise.secondaryMuscles) ||
    !Array.isArray(exercise.instructions) ||
    !Array.isArray(exercise.images)
  ) {
    throw new Error(`Invalid exercise: ${exercise.id}`);
  }
  ids.add(exercise.id);
  for (const path of exercise.images) {
    if (!/^[\w-]+\/\d+\.jpg$/.test(path) || !Number.isSafeInteger(sizes.get(`exercises/${path}`))) {
      throw new Error(`Invalid image metadata: ${path}`);
    }
    imageSizes[path] = sizes.get(`exercises/${path}`);
  }
}
const folder = new URL('../data/free-exercise-db/', import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(new URL('exercises.json', folder), `${JSON.stringify(exercises)}\n`);
await writeFile(new URL('LICENSE.md', folder), license);
await writeFile(new URL('image-sizes.json', folder), `${JSON.stringify(imageSizes)}\n`);
await writeFile(
  new URL('source.json', folder),
  `${JSON.stringify(
    {
      repository: 'https://github.com/yuhonas/free-exercise-db',
      revision,
      license: 'Unlicense',
      count: exercises.length,
      sourceSha256: createHash('sha256').update(source).digest('hex'),
      imageMetadata: 'image-sizes.json',
      imageLicense:
        'Unlicense — repository public-domain dataset declaration; no separate image license declared',
      imageLicenseEvidence: `${base}/README.md`,
      missingInstructions: exercises
        .filter((exercise) => !exercise.instructions.length)
        .map((exercise) => exercise.id),
      missingImages: exercises.filter((exercise) => !exercise.images.length).map((exercise) => exercise.id),
    },
    null,
    2,
  )}\n`,
);
console.log(`Imported ${exercises.length} exercises from ${revision}; license verified.`);
