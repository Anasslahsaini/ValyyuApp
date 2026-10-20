import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { color } from '@workspace/tokens';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CLERK_PUBLISHABLE_KEY } from '../src/auth/config';
import { MissingConfig } from '../src/auth/MissingConfig';
import { LifeProvider, useLife } from '../src/data/LifeProvider';
import { GateContext } from '../src/navigation/gate';
import { useAppReady } from '../src/useAppReady';

/** Signed out → sign-in. Signed in, first launch not done → first launch. Otherwise the app. Deep links cannot skip a step. */
function RootStack() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return null;
  // Keyed by user: another account starts from a fresh, unloaded state.
  if (isSignedIn && userId) {
    return (
      <LifeProvider key={userId} userId={userId}>
        <SignedInStack />
      </LifeProvider>
    );
  }
  return (
    <GateContext.Provider value={{ signedIn: false, onboarded: false }}>
      <AppStack signedIn={false} onboarded={false} />
    </GateContext.Provider>
  );
}

function SignedInStack() {
  const { state, ready } = useLife();
  if (!ready) return null;
  const onboarded = !!state.settings.onboardedAt;
  return (
    <GateContext.Provider value={{ signedIn: true, onboarded }}>
      <AppStack signedIn onboarded={onboarded} />
    </GateContext.Provider>
  );
}

function AppStack({ signedIn, onboarded }: { signedIn: boolean; onboarded: boolean }) {
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: color.bg.paper }, animation: 'fade' }}>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal', headerShown: false }} />
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
