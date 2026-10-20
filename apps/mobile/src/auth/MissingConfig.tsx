import { layout } from '@workspace/tokens';
import { Text } from '@workspace/ui';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

/** Shown when apps/mobile/.env has no Clerk key: says what to do instead of crashing. */
export function MissingConfig() {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="title1" accessibilityRole="header">
        {t('auth.missingConfig.title')}
      </Text>
      <Text tone="secondary">{t('auth.missingConfig.message')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, paddingTop: 96, gap: layout.gapCards },
});
