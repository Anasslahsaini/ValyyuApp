import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { largeTitleOptions } from '../../../src/navigation/stack-options';

export default function Layout() {
  const { t } = useTranslation();
  return <Stack screenOptions={{ ...largeTitleOptions, title: t('tabs.repas') }} />;
}
