import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { app } from './index';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const skippedDirs = new Set(['node_modules', 'dist', '.expo', 'coverage', 'ios', 'android']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.md', '.yaml', '.yml']);
const allowed = new Set([
  join('packages', 'config', 'src', 'app.ts'),
  join('packages', 'config', 'src', 'no-hardcoded-name.test.ts'),
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return skippedDirs.has(entry) ? [] : sourceFiles(path);
    return textExtensions.has(extname(entry)) ? [path] : [];
  });
}

describe('app name', () => {
  it('appears only in packages/config/src/app.ts', () => {
    const name = new RegExp(app.name, 'i');
    const offenders = ['apps', 'packages']
      .flatMap((dir) => {
        try {
          return sourceFiles(join(root, dir));
        } catch {
          return [];
        }
      })
      .map((path) => relative(root, path))
      .filter((path) => !allowed.has(path.split('/').join(sep)))
      .filter((path) => name.test(readFileSync(join(root, path), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
