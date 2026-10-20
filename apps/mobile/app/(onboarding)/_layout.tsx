import { color } from '@workspace/tokens';
import { Stack } from 'expo-router';
import { DraftProvider } from '../../src/first-launch/DraftProvider';

export default function OnboardingLayout() {
  return (
    <DraftProvider>
      <Stack
        screenOptions={{
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: color.bg.paper },
          headerTintColor: color.ink.primary,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: color.bg.paper },
        }}
      >
        <Stack.Screen name="start" options={{ headerShown: false }} />
        <Stack.Screen name="plan" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </DraftProvider>
  );
}
