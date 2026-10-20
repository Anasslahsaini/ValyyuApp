import { withdrawHealthConsent } from '@workspace/domain/first-launch/profile';
import { layout, space } from '@workspace/tokens';
import { Banner, Button, Card, CheckboxRow, Text } from '@workspace/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLife } from '../../src/data/LifeProvider';
import { useRun } from '../../src/data/useRun';

const ROWS = [
  ['onboarding.health.keptTitle', 'onboarding.health.keptBody'],
  ['onboarding.health.whyTitle', 'onboarding.health.whyBody'],
  ['onboarding.health.whoTitle', 'onboarding.health.whoBody'],
] as const;

/** Health data: what is kept and why, the consent (unticked by default) and its withdrawal, which erases the data. */
export default function HealthData() {
  const { t } = useTranslation();
  const { state, updateSettings, apply } = useLife();
  const { busy, failed, run } = useRun<'save'>();
  const [checked, setChecked] = useState(false);
  const given = state.settings.healthConsentAt;

  const withdraw = () => {
    Alert.alert(t('profile.health.withdrawTitle'), t('profile.health.withdrawMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.health.withdraw'),
        style: 'destructive',
        onPress: () => {
          const { patch, writes } = withdrawHealthConsent(state);
          void run('save', async () => {
            await apply(writes);
            await updateSettings(patch);
            setChecked(false);
          });
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {failed ? <Banner tone="danger" title={t('today.saveFailed')} /> : null}
      {ROWS.map(([title, body]) => (
        <View key={title} style={styles.row}>
          <Text variant="headline">{t(title)}</Text>
          <Text tone="secondary">{t(body)}</Text>
        </View>
      ))}
      {given ? (
        <Card>
          <Text variant="headline" tone="success">
            {t('profile.health.givenOn', { date: new Date(given).toLocaleDateString() })}
          </Text>
          <Text tone="secondary">{t('profile.health.withdrawHint')}</Text>
          <Button
            kind="destructive"
            label={t('profile.health.withdraw')}
            onPress={withdraw}
            loading={busy === 'save'}
            testID="health-withdraw"
          />
        </Card>
      ) : (
        <View style={styles.row}>
          <CheckboxRow label={t('onboarding.health.consent')} checked={checked} onChange={setChecked} />
          <Text variant="footnote" tone="secondary">
            {t('profile.health.afterConsent')}
          </Text>
          <Button
            label={t('profile.health.give')}
            disabled={!checked}
            loading={busy === 'save'}
            onPress={() => {
              void run('save', () => updateSettings({ healthConsentAt: new Date().toISOString() }));
            }}
            testID="health-give"
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[5], paddingBottom: space[12] },
  row: { gap: space[2] },
});
