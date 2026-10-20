import { features } from '@workspace/config';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { largeTitleOptions } from '../../../src/navigation/stack-options';
import { TodayHeaderActions } from '../../../src/navigation/TodayHeaderActions';

export default function TodayLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        ...largeTitleOptions,
        title: t('tabs.today'),
        headerRight: () => (
          <TodayHeaderActions
            community={features.community}
            onProfile={() => {
              router.push('/profile');
            }}
            onCommunity={() => {
              router.push('/community');
            }}
          />
        ),
      }}
    />
  );
}
