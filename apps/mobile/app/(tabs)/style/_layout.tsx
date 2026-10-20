import { color } from '@workspace/tokens';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { largeTitleOptions } from '../../../src/navigation/stack-options';

export default function Layout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ ...largeTitleOptions, title: t('tabs.style') }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="piece"
        options={{
          presentation: 'modal',
          headerLargeTitle: false,
          headerStyle: { backgroundColor: color.bg.paper },
          contentStyle: { backgroundColor: color.bg.paper },
        }}
      />
    </Stack>
  );
}
