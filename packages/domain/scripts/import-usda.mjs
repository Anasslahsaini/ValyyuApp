// Reproducible, data-only import of an offline USDA FoodData Central subset (public domain / CC0 1.0).
//
//   node scripts/import-usda.mjs            # bulk download (SR Legacy + Foundation), curated fallback if offline
//   node scripts/import-usda.mjs --curated  # rebuild from data/usda-fdc/curated-sr-legacy.txt only
//   node scripts/import-usda.mjs --no-fallback
//
// Output (per 100 g): data/usda-fdc/foods.json = [{id, name, fr?, kcal, p, c, f, portions?:[{label, g}]}]
// plus source.json (urls, date, checksums, mode) and LICENSE.md. The bulk JSON files are large;
// run with NODE_OPTIONS=--max-old-space-size=4096 if parsing runs out of memory.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const args = new Set(process.argv.slice(2));
const folder = new URL('../data/usda-fdc/', import.meta.url);
const MAX_BYTES = 1_450_000;
// Bulk download links are listed on https://fdc.nal.usda.gov/download-datasets
const DATASETS = [
  {
    key: 'SRLegacyFoods',
    url:
      process.env.USDA_SR_URL ??
      'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip',
  },
  {
    key: 'FoundationFoods',
    url:
      process.env.USDA_FOUNDATION_URL ??
      'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2025-04-24.zip',
  },
];
// Categories that are not useful for a personal food journal.
const SKIP_CATEGORIES = new Set(['Baby Foods', 'American Indian/Alaska Native Foods', 'Restaurant Foods']);
const LICENSE = `# USDA FoodData Central — license

The data in this folder comes from USDA FoodData Central (https://fdc.nal.usda.gov/),
U.S. Department of Agriculture, Agricultural Research Service.

FoodData Central data are in the public domain and published under CC0 1.0 Universal
(https://creativecommons.org/publicdomain/zero/1.0/). No permission is needed for their use.
USDA asks that the source be cited:

> U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. fdc.nal.usda.gov.

See source.json for exactly which files were used, when, and their checksums.
`;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

/** Minimal ZIP reader (stored/deflated entries, no ZIP64) — avoids a dependency. */
function unzipFirstJson(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.toLowerCase().endsWith('.json')) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + compressed);
    if (method === 0) return data.toString('utf8');
    if (method === 8) return inflateRawSync(data).toString('utf8');
    throw new Error(`Unsupported zip method ${method}`);
  }
  throw new Error('No JSON file in archive');
}

function nutrient(food, numbers) {
  for (const number of numbers) {
    const hit = food.foodNutrients?.find(
      (x) => String(x.nutrient?.number) === number && Number.isFinite(x.amount),
    );
    if (hit) return hit.amount;
  }
  return undefined;
}

function portionsOf(food) {
  const out = [];
  for (const p of food.foodPortions ?? []) {
    const g = Number(p.gramWeight);
    if (!(g > 0)) continue;
    const unit = p.measureUnit?.name && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '';
    const label = [
      p.amount && p.amount !== 1 ? r1(p.amount) : 1,
      unit,
      p.modifier ?? p.portionDescription ?? '',
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (label && !out.some((x) => x.label === label)) out.push({ label: label.slice(0, 40), g: r1(g) });
    if (out.length === 3) break;
  }
  return out;
}

function toFood(food) {
  const kcal = nutrient(food, ['208', '957', '958']);
  const p = nutrient(food, ['203']);
  const c = nutrient(food, ['205']);
  const f = nutrient(food, ['204']);
  if ([kcal, p, c, f].some((x) => x === undefined)) return null;
  const portions = portionsOf(food);
  return {
    id: String(food.fdcId),
    name: food.description.trim(),
    kcal: Math.round(kcal),
    p: r1(p),
    c: r1(c),
    f: r1(f),
    ...(portions.length ? { portions } : {}),
  };
}

async function readCurated() {
  const text = await readFile(new URL('curated-sr-legacy.txt', folder), 'utf8');
  const foods = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [id, name, fr, kcal, p, c, f, portions, approx] = line.split('|');
    const food = {
      id,
      name,
      ...(fr ? { fr } : {}),
      kcal: Math.round(Number(kcal)),
      p: r1(p),
      c: r1(c),
      f: r1(f),
    };
    if (portions)
      food.portions = portions.split(';').map((x) => {
        const [label, g] = x.split('=');
        return { label, g: Number(g) };
      });
    if ([food.kcal, food.p, food.c, food.f].some((x) => !Number.isFinite(x)))
      throw new Error(`Bad curated row: ${line}`);
    foods.push({ food, approx: approx === '~' });
  }
  return { text, foods };
}

async function bulk() {
  const files = [];
  const foods = [];
  const seen = new Set();
  for (const ds of DATASETS) {
    const response = await fetch(ds.url, {
      signal: AbortSignal.timeout(300000),
      headers: { 'user-agent': 'offline food subset import (open source app)' },
    });
    if (!response.ok) throw new Error(`${ds.url}: HTTP ${response.status}`);
    const buf = Buffer.from(await response.arrayBuffer());
    files.push({ url: ds.url, bytes: buf.length, sha256: sha256(buf) });
    const json = JSON.parse(unzipFirstJson(buf));
    const list = json[ds.key];
    if (!Array.isArray(list) || list.length < 100) throw new Error(`${ds.url}: unexpected content`);
    for (const raw of list) {
      if (SKIP_CATEGORIES.has(raw.foodCategory?.description)) continue;
      const food = toFood(raw);
      if (!food) continue;
      const key = food.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      foods.push(food);
    }
  }
  return { files, foods };
}

function fit(foods) {
  let json = JSON.stringify(foods);
  if (json.length > MAX_BYTES) {
    for (const f of foods) if (f.portions?.length > 1) f.portions = f.portions.slice(0, 1);
    json = JSON.stringify(foods);
  }
  if (json.length > MAX_BYTES) throw new Error(`Subset is ${json.length} bytes; tighten SKIP_CATEGORIES.`);
  return json;
}

let output;
let source;
const curated = await readCurated();
if (!args.has('--curated')) {
  try {
    const { files, foods } = await bulk();
    // Keep the French names from the curated list when the English description matches exactly.
    const fr = new Map(
      curated.foods.filter((x) => x.food.fr).map((x) => [x.food.name.toLowerCase(), x.food.fr]),
    );
    for (const f of foods) {
      const n = fr.get(f.name.toLowerCase());
      if (n) f.fr = n;
    }
    output = fit(foods);
    source = {
      name: 'USDA FoodData Central — SR Legacy + Foundation Foods (subset)',
      mode: 'bulk',
      license: 'Public domain (CC0 1.0), U.S. Department of Agriculture, Agricultural Research Service',
      downloadPage: 'https://fdc.nal.usda.gov/download-datasets',
      importedAt: new Date().toISOString().slice(0, 10),
      files,
      count: foods.length,
      per: '100 g',
      nutrients: { kcal: '208 (or 957/958)', p: '203', c: '205', f: '204' },
    };
  } catch (error) {
    if (args.has('--no-fallback')) throw error;
    console.warn(`Bulk download failed (${error.message}). Using the curated fallback.`);
    source = { reason: `Bulk download unavailable: ${error.message}` };
  }
}
if (!output) {
  const foods = curated.foods.map((x) => x.food);
  output = fit(foods);
  source = {
    name: 'USDA FoodData Central — curated fallback of common generic foods',
    mode: 'curated-fallback',
    license: 'Public domain (CC0 1.0), U.S. Department of Agriculture, Agricultural Research Service',
    downloadPage: 'https://fdc.nal.usda.gov/download-datasets',
    importedAt: new Date().toISOString().slice(0, 10),
    ...source,
    note:
      'fdc.nal.usda.gov was not reachable from the build environment. Values per 100 g were transcribed by hand ' +
      'from USDA SR Legacy (April 2018) descriptions and are approximate; ids are slugs, not FDC ids. Rows listed in ' +
      '"approximate" are generic estimates for common dishes with no direct SR Legacy row. Re-run this script with ' +
      'network access to replace this file with the verified bulk subset.',
    curatedFile: 'curated-sr-legacy.txt',
    curatedSha256: sha256(curated.text),
    count: foods.length,
    per: '100 g',
    approximate: curated.foods.filter((x) => x.approx).map((x) => x.food.id),
  };
}
await mkdir(folder, { recursive: true });
await writeFile(new URL('foods.json', folder), `${output}\n`);
await writeFile(
  new URL('source.json', folder),
  `${JSON.stringify({ ...source, foodsSha256: sha256(output) }, null, 2)}\n`,
);
await writeFile(new URL('LICENSE.md', folder), LICENSE);
console.log(`Wrote ${source.count} foods (${output.length} bytes, mode ${source.mode}).`);
