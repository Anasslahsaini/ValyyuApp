import { app } from '@workspace/config';
import { initI18n } from '@workspace/i18n';
import type { i18n } from 'i18next';
import { TABS } from '../src/navigation/tabs';

let i18next: i18n;
beforeAll(async () => {
  i18next = await initI18n(['fr-FR']);
});

describe('tab bar', () => {
  it('has Aujourd’hui, Repas, Sport, Style, then the mic', () => {
    expect(TABS.map((tab) => i18next.t(tab.labelKey))).toEqual([
      'Aujourd’hui',
      'Repas',
      'Sport',
      'Style',
      'Micro',
    ]);
  });

  it('keeps at most 5 entries', () => {
    expect(TABS.length).toBeLessThanOrEqual(5);
  });

  it('separates the mic at the end of the bar (variant B) with a spoken name', () => {
    const mic = TABS.at(-1);
    expect(mic?.name).toBe('micro');
    expect(mic?.role).toBe('search');
    expect(mic?.a11yKey && i18next.t(mic.a11yKey)).toBe(`Micro. Parle ou écris à ${app.name}`);
  });

  it('gives every tab an SF Symbol and a Material icon', () => {
    for (const tab of TABS) {
      expect(tab.icon.sf).toBeTruthy();
      expect(tab.icon.md).toBeTruthy();
    }
  });
});
