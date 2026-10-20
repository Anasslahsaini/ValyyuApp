import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findPhysicalDirection } from '../test-utils/physical-direction';

const root = join(__dirname, '../../../..');

function files(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.expo' || entry === '__tests__' || entry === 'test-utils')
      return [];
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('layout direction', () => {
  it('uses start/end, never left/right, so Arabic can mirror', () => {
    const offenders = [join(root, 'packages/ui/src'), join(root, 'apps/mobile')]
      .flatMap(files)
      .filter((f) => findPhysicalDirection(readFileSync(f, 'utf8')).length > 0)
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });
});
