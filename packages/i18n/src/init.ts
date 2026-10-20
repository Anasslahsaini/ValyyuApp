import { app } from '@workspace/config';
import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '../locales/ar.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { resolveLanguage } from './resolve-language';

/** Starts i18next in the device language (French when it is not shipped yet). */
export async function initI18n(deviceLanguageCodes?: readonly (string | null | undefined)[]): Promise<i18n> {
  await i18next.use(initReactI18next).init({
    lng: resolveLanguage(deviceLanguageCodes),
    fallbackLng: 'fr',
    resources: { fr: { translation: fr }, en: { translation: en }, ar: { translation: ar } },
    interpolation: { escapeValue: false, defaultVariables: { appName: app.name } },
    returnNull: false,
  });
  return i18next;
}
