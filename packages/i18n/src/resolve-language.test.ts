import { describe, expect, it } from 'vitest';
import { ENABLED_LANGUAGES, isRtl, resolveLanguage } from './index';

describe('resolveLanguage', () => {
  it('only French is enabled at launch', () => {
    expect(ENABLED_LANGUAGES).toEqual(['fr']);
  });

  it.each([
    [['fr-FR'], 'fr'],
    [['fr'], 'fr'],
    [['en-US'], 'fr'],
    [['de-DE'], 'fr'],
    [[], 'fr'],
    [undefined, 'fr'],
    [[null, 'fr'], 'fr'],
  ] as const)('resolves %j to %s', (codes, expected) => {
    expect(resolveLanguage(codes)).toBe(expected);
  });
});

describe('isRtl', () => {
  it('is true for Arabic only', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fr')).toBe(false);
    expect(isRtl('en')).toBe(false);
  });
});
