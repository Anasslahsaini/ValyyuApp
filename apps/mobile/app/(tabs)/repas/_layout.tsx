import { color } from '@workspace/tokens';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { largeTitleOptions } from '../../../src/navigation/stack-options';

const modal = {
  presentation: 'modal',
  headerLargeTitle: false,
  headerStyle: { backgroundColor: color.bg.paper },
  contentStyle: { backgroundColor: color.bg.paper },
} as const;

export default function Layout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ ...largeTitleOptions, title: t('tabs.repas') }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="meal" options={modal} />
      <Stack.Screen name="pantry" options={modal} />
      <Stack.Screen name="grocery" options={modal} />
      <Stack.Screen name="recipe" options={modal} />
    </Stack>
  );
}
