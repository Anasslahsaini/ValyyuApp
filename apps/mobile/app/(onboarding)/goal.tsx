import { Card, ChoiceRow, SegmentedControl, Text, TextField } from '@workspace/ui';
import type { Sex } from '@workspace/domain/targets';
import { space } from '@workspace/tokens';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StepScreen } from '../../src/components/StepScreen';
import { useDraft } from '../../src/first-launch/DraftProvider';
import { GOALS, SEXES } from '../../src/first-launch/options';

const num = (value: string, max: number) => {
  const n = Number(value.replace(',', '.').replace(/[^\d.]/g, ''));
  return n > 0 && n <= max ? Math.round(n) : undefined;
};

/** O3 · but, taille, poids (body fields only with consent). A minor choosing "lose" gets the keep-fit message. */
export default function Goal() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, update, consent } = useDraft();
  const minor = (draft.age ?? 0) < 18;
  return (
    <StepScreen
      step={3}
      title={t('onboarding.goal.title')}
      primary={{
        label: t('common.continue'),
        disabled: !draft.mainGoal,
        onPress: () => {
          router.push('/meals');
        },
      }}
    >
      <View accessibilityRole="radiogroup" style={styles.goal}>
        {GOALS.map((goal) => (
          <View key={goal.value} style={styles.goal}>
            <ChoiceRow
              label={t(goal.label)}
              selected={draft.mainGoal === goal.value}
              onPress={() => {
                update({ mainGoal: goal.value });
              }}
            />
            {minor && goal.value === 'lose' && draft.mainGoal === 'lose' ? (
              <Animated.View entering={FadeIn}>
                <Card>
                  <Text variant="headline">{t('onboarding.goal.minorTitle')}</Text>
                  <Text tone="secondary">{t('onboarding.goal.minorMessage')}</Text>
                </Card>
              </Animated.View>
            ) : null}
          </View>
        ))}
      </View>
      {consent ? (
        <>
          <Text variant="headline">
            {minor ? t('onboarding.goal.bodyTitleMinor') : t('onboarding.goal.bodyTitle')}
          </Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label={t('onboarding.goal.height')}
                unit={t('onboarding.units.cm')}
                keyboardType="number-pad"
                value={draft.heightCm ? String(draft.heightCm) : ''}
                onChangeText={(v) => {
                  update({ heightCm: num(v, 250) });
                }}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label={t('onboarding.goal.weight')}
                unit={t('onboarding.units.kg')}
                keyboardType="number-pad"
                value={draft.weightKg ? String(draft.weightKg) : ''}
                onChangeText={(v) => {
                  update({ weightKg: num(v, 400) });
                }}
              />
            </View>
          </View>
          <Text variant="subhead">{t('onboarding.goal.basedOn')}</Text>
          <SegmentedControl<Sex>
            accessibilityLabel={t('onboarding.goal.basedOn')}
            options={SEXES.map((s) => ({ value: s.value, label: t(s.label) }))}
            value={draft.sex ?? 'other'}
            onChange={(sex) => {
              update({ sex });
            }}
          />
          <Text variant="footnote" tone="secondary">
            {t('common.estimate')}
          </Text>
        </>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  goal: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[3] },
  flex: { flex: 1 },
});
