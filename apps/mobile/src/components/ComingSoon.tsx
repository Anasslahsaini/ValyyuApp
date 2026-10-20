import { layout } from '@workspace/tokens';
import { tKey } from '@workspace/i18n';
import { Text } from '@workspace/ui';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

/** Empty screen while the real one is designed. Scrolls under the large title, above the tab bar. */
export function ComingSoon({
  messageKey = tKey('common.comingSoon'),
}: {
  messageKey?: 'common.comingSoon' | 'micro.soon';
}) {
  const { t } = useTranslation();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text tone="secondary">{t(messageKey)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: layout.margin, gap: layout.gapCards } });
