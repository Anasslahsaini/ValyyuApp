import { describe, expect, it } from 'vitest';
import { app, features } from './index';

describe('app identity', () => {
  it('uses a slug made only of lowercase letters, digits and dashes', () => {
    expect(app.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('uses reverse-DNS bundle identifiers', () => {
    expect(app.iosBundleId).toMatch(/^[a-z]+(\.[a-z0-9]+)+$/);
    expect(app.androidPackage).toMatch(/^[a-z]+(\.[a-z0-9]+)+$/);
  });

  it('has no legal links yet', () => {
    expect(app.legal).toEqual({ termsUrl: null, privacyUrl: null });
  });
});

describe('feature flags', () => {
  it('keeps the community space hidden', () => {
    expect(features.community).toBe(false);
  });
});
