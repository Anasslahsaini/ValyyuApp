import { color } from '@workspace/tokens';
import { Stack } from 'expo-router';

/** Sign-in screens: no title, only the native back chevron, on cream paper. */
export default function AuthLayout() {
  return (
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
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
