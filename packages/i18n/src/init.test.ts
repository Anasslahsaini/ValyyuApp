import { app } from '@workspace/config';
import { describe, expect, it } from 'vitest';
import { initI18n } from './index';

describe('initI18n', () => {
  it('starts in French when the device language is not shipped', async () => {
    const i18n = await initI18n(['de-DE']);
    expect(i18n.language).toBe('fr');
  });

  it('injects the app name as a default variable', async () => {
    const i18n = await initI18n(['fr-FR']);
    i18n.addResource('fr', 'translation', 'probe', 'Bienvenue sur {{appName}}');
    expect(i18n.t('probe')).toBe(`Bienvenue sur ${app.name}`);
  });
});
