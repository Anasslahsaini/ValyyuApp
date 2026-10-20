import { color } from '@workspace/tokens';
import { ListRow } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { ComingSoon } from '../src/components/ComingSoon';
import { isDevBuild } from '../src/env';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  if (!isDevBuild()) return <ComingSoon />;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.root}>
      <ListRow
        title={t('profile.catalog')}
        onPress={() => {
          router.push('/dev/catalog');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ root: { backgroundColor: color.bg.paper } });
