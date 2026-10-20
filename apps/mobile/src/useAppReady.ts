import { BricolageGrotesque_700Bold, useFonts } from '@expo-google-fonts/bricolage-grotesque';
import { initI18n } from '@workspace/i18n';
import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';

/**
 * True once the title font and the translations are ready. A failure never blocks the app:
 * titles fall back to the system font, and i18next falls back to the keys.
 */
export function useAppReady(): boolean {
  const [fontsLoaded, fontError] = useFonts({ BricolageGrotesque_700Bold });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    let active = true;
    const done = () => {
      if (active) setI18nReady(true);
    };
    initI18n(getLocales().map((locale) => locale.languageCode)).then(done, done);
    return () => {
      active = false;
    };
  }, []);

  return (fontsLoaded || fontError !== null) && i18nReady;
}
