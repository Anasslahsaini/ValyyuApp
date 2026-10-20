import { describe, expect, it } from 'vitest';
import { color, CONTRAST_PAIRS, contrastRatio } from './index';

describe('contrastRatio (WCAG 2.2)', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
  });

  it('is 1 for identical colors', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#161616', '#F2F1EC')).toBe(contrastRatio('#F2F1EC', '#161616'));
  });

  it.each(['#FFF', 'red', '161616', '#GGGGGG'])('rejects %s', (bad) => {
    expect(() => contrastRatio(bad, '#FFFFFF')).toThrow();
  });
});

describe('design system v1 contrasts', () => {
  it('ink on paper is about 16.0:1', () => {
    expect(contrastRatio(color.ink.primary, color.bg.paper)).toBeCloseTo(16.0, 0);
  });

  it('secondary ink on paper is about 5.8:1', () => {
    expect(Math.abs(contrastRatio(color.ink.secondary, color.bg.paper) - 5.8)).toBeLessThanOrEqual(0.1);
  });

  it.each(CONTRAST_PAIRS.map((p) => [p.usage, p] as const))('%s meets its minimum', (_usage, pair) => {
    expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
  });

  it('keeps the light logo grey unusable for text', () => {
    expect(contrastRatio(color.logo.light, color.bg.paper)).toBeLessThan(3);
  });
});
