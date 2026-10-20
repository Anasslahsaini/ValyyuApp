import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractKeys, flattenKeys } from './keys';

describe('extractKeys', () => {
  it('finds t() calls and i18nKey props', () => {
    const source = `t('tabs.today'); t("a11y.micro", { x: 1 }); <Trans i18nKey="common.close" />`;
    expect(extractKeys(source).sort()).toEqual(['a11y.micro', 'common.close', 'tabs.today']);
  });

  it('ignores dynamic keys', () => {
    expect(extractKeys('t(key); t(`tabs.${x}`)')).toEqual([]);
  });
});

describe('flattenKeys', () => {
  it('flattens nested objects and merges plural forms', () => {
    expect(flattenKeys({ a: { b: 'x', c_one: 'y', c_other: 'z' }, d: 'w' }).sort()).toEqual([
      'a.b',
      'a.c',
      'd',
    ]);
  });
});

const root = fileURLToPath(new URL('../../..', import.meta.url));
function tsxFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.expo') return [];
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('French resources', () => {
  const fr = JSON.parse(readFileSync(join(root, 'packages/i18n/locales/fr.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const defined = new Set(flattenKeys(fr));
  const used = new Set(
    [join(root, 'apps'), join(root, 'packages/ui/src')]
      .flatMap(tsxFiles)
      .flatMap((f) => extractKeys(readFileSync(f, 'utf8'))),
  );

  it('defines every key the code uses', () => {
    expect([...used].filter((k) => !defined.has(k))).toEqual([]);
  });

  it('has no unused key', () => {
    expect([...defined].filter((k) => !used.has(k))).toEqual([]);
  });
});
