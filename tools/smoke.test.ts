import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('workspace smoke test', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('pins Node 24 in .nvmrc', () => {
    const nvmrc = readFileSync(fileURLToPath(new URL('../.nvmrc', import.meta.url)), 'utf8');
    expect(nvmrc.trim()).toBe('24');
  });
});
