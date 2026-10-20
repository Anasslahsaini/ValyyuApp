import { color } from '@workspace/tokens';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { CloseButton } from '../src/navigation/CloseButton';
import { largeTitleOptions } from '../src/navigation/stack-options';
import { useAppReady } from '../src/useAppReady';

function RootStack() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: color.bg.paper } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{
          ...largeTitleOptions,
          title: t('profile.title'),
          presentation: 'modal',
          headerRight: () => (
            <CloseButton
              onPress={() => {
                router.back();
              }}
            />
          ),
        }}
      />
      <Stack.Screen name="(community)" options={{ headerShown: false }} />
      <Stack.Screen name="dev" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const ready = useAppReady();
  if (!ready) return null;
  return (
    <>
      <StatusBar style="dark" />
      <RootStack />
    </>
  );
}
