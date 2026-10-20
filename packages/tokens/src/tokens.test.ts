import { describe, expect, it } from 'vitest';
import { radius, size, space, type } from './index';

describe('scales', () => {
  it('spacing uses multiples of 4', () => {
    for (const value of Object.values(space)) expect(value % 4).toBe(0);
  });

  it('touch targets are at least 44 pt', () => {
    expect(size.touchMin).toBe(44);
    expect(size.buttonHeight).toBeGreaterThanOrEqual(size.touchMin);
  });

  it('uses the display family for titles only', () => {
    const display = Object.entries(type)
      .filter(([, t]) => t.family === 'display')
      .map(([name]) => name);
    expect(display.sort()).toEqual(['largeTitle', 'title1', 'title2']);
  });

  it('body text is 17 pt on iOS and never below 12 pt anywhere', () => {
    expect(type.body.ios.size).toBe(17);
    for (const t of Object.values(type)) expect(t.ios.size).toBeGreaterThanOrEqual(12);
  });

  it('cards use the v1 radius', () => {
    expect(radius.card).toBe(20);
  });
});
