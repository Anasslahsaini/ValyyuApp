import { Button, ChoiceRow, SegmentedControl, Text } from '@workspace/ui';
import { space } from '@workspace/tokens';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { StepScreen } from '../../src/components/StepScreen';
import { useDraft } from '../../src/first-launch/DraftProvider';
import { PLACES } from '../../src/first-launch/options';

const TIMES = ['1', '2', '3', '4'] as const;

/** O5 · sport: where, and how often. */
export default function Sport() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, update } = useDraft();
  const next = () => {
    router.push('/plan');
  };
  return (
    <StepScreen
      step={5}
      title={t('onboarding.sport.title')}
      primary={{ label: t('onboarding.sport.seePlan'), onPress: next }}
      secondary={<Button kind="tertiary" label={t('common.skip')} onPress={next} />}
    >
      <Text variant="subhead">{t('onboarding.sport.where')}</Text>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {PLACES.map((place) => (
          <ChoiceRow
            key={place.value}
            label={t(place.label)}
            selected={draft.trainingPlace === place.value}
            onPress={() => {
              update({ trainingPlace: place.value });
            }}
          />
        ))}
      </View>
      {draft.trainingPlace !== 'none' ? (
        <>
          <Text variant="subhead">{t('onboarding.sport.howOften')}</Text>
          <SegmentedControl
            accessibilityLabel={t('onboarding.sport.howOften')}
            options={TIMES.map((n) => ({ value: n, label: n === '4' ? t('onboarding.meals.fourPlus') : n }))}
            value={String(Math.min(draft.sessionsPerWeek ?? 3, 4)) as (typeof TIMES)[number]}
            onChange={(n) => {
              update({ sessionsPerWeek: Number(n) });
            }}
          />
        </>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({ list: { gap: space[2] } });
