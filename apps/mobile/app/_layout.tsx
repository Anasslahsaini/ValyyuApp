import { BricolageGrotesque_700Bold, useFonts } from '@expo-google-fonts/bricolage-grotesque';
import { initI18n } from '@workspace/i18n';
import { color } from '@workspace/tokens';
import { getLocales } from 'expo-localization';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { largeTitleOptions } from '../src/navigation/stack-options';

function RootStack() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: color.bg.paper } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{ ...largeTitleOptions, title: t('profile.title'), presentation: 'modal' }}
      />
      <Stack.Screen name="(community)" options={{ headerShown: false }} />
      <Stack.Screen name="dev" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    void initI18n(getLocales().map((locale) => locale.languageCode)).then(() => {
      setI18nReady(true);
    });
  }, []);

  if (!fontsLoaded || !i18nReady) return null;
  return (
    <>
      <StatusBar style="dark" />
      <RootStack />
    </>
  );
}
