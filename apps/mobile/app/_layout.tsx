import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { color } from '@workspace/tokens';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { CLERK_PUBLISHABLE_KEY } from '../src/auth/config';
import { MissingConfig } from '../src/auth/MissingConfig';
import { CloseButton } from '../src/navigation/CloseButton';
import { largeTitleOptions } from '../src/navigation/stack-options';
import { useAppReady } from '../src/useAppReady';

/** Signed out: only the sign-in screens. Signed in: the app. A deep link cannot skip this. */
function RootStack() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  const signedIn = isSignedIn;
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: color.bg.paper } }}>
      <Stack.Protected guard={signedIn}>
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
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const ready = useAppReady();
  if (!ready) return null;
  if (!CLERK_PUBLISHABLE_KEY) return <MissingConfig />;
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} {...(tokenCache ? { tokenCache } : {})}>
      <StatusBar style="dark" />
      <RootStack />
    </ClerkProvider>
  );
}
