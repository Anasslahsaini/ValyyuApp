import { color } from '@workspace/tokens';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { largeTitleOptions } from '../../../src/navigation/stack-options';

export default function Layout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ ...largeTitleOptions, title: t('tabs.sport') }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="session"
        options={{
          presentation: 'fullScreenModal',
          headerLargeTitle: false,
          gestureEnabled: false,
          contentStyle: { backgroundColor: color.bg.paper },
        }}
      />
      <Stack.Screen name="done" options={{ presentation: 'modal', headerLargeTitle: false, title: '' }} />
    </Stack>
  );
}
