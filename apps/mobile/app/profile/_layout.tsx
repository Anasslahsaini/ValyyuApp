import { color } from '@workspace/tokens';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CloseButton } from '../../src/navigation/CloseButton';
import { largeTitleOptions } from '../../src/navigation/stack-options';

export default function ProfileLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Stack screenOptions={{ ...largeTitleOptions, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen
        name="index"
        options={{
          title: t('profile.title'),
          headerRight: () => (
            <CloseButton
              onPress={() => {
                router.back();
              }}
            />
          ),
        }}
      />
      <Stack.Screen
        name="info"
        options={{
          title: t('profile.info.title'),
          headerLargeTitle: false,
          headerStyle: { backgroundColor: color.bg.paper },
        }}
      />
      <Stack.Screen
        name="health"
        options={{
          title: t('profile.health.title'),
          headerLargeTitle: false,
          headerStyle: { backgroundColor: color.bg.paper },
        }}
      />
    </Stack>
  );
}
