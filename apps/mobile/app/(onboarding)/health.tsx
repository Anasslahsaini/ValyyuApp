import { tKey } from '@workspace/i18n';
import { layout, space } from '@workspace/tokens';
import { Card, CheckboxRow, Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { StepScreen } from '../../src/components/StepScreen';
import { useDraft } from '../../src/first-launch/DraftProvider';

const ROWS = [
  { title: tKey('onboarding.health.keptTitle'), body: tKey('onboarding.health.keptBody') },
  { title: tKey('onboarding.health.whyTitle'), body: tKey('onboarding.health.whyBody') },
  { title: tKey('onboarding.health.whoTitle'), body: tKey('onboarding.health.whoBody') },
  { title: tKey('onboarding.health.changeTitle'), body: tKey('onboarding.health.changeBody') },
];

/** O2 · données de santé: explicit, unticked, and the app still works without it. */
export default function Health() {
  const { t } = useTranslation();
  const router = useRouter();
  const { consent, setConsent } = useDraft();
  return (
    <StepScreen
      step={2}
      title={t('onboarding.health.title')}
      primary={{
        label: t('common.continue'),
        onPress: () => {
          router.push('/goal');
        },
      }}
    >
      <Card>
        {ROWS.map((row) => (
          <View key={row.title} style={styles.row}>
            <Text variant="headline">{t(row.title)}</Text>
            <Text tone="secondary">{t(row.body)}</Text>
          </View>
        ))}
      </Card>
      <CheckboxRow label={t('onboarding.health.consent')} checked={consent} onChange={setConsent} />
      <Text variant="footnote" tone="secondary">
        {t('onboarding.health.without')}
      </Text>
    </StepScreen>
  );
}

const styles = StyleSheet.create({ row: { gap: space[1], paddingVertical: layout.gapCards / 2 } });
