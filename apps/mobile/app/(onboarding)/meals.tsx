import { Chip, SegmentedControl, Text, TextField, Button } from '@workspace/ui';
import { space } from '@workspace/tokens';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { StepScreen } from '../../src/components/StepScreen';
import { useDraft } from '../../src/first-launch/DraftProvider';
import { ALLERGY_CHOICES, DIET_CHOICES, type DietChoice } from '../../src/first-launch/options';

const PEOPLE = ['1', '2', '3', '4'] as const;

/** O4 · repas: people, weekly budget, diet, allergies (allergies only with consent, they are health data). */
export default function Meals() {
  const { t } = useTranslation();
  const router = useRouter();
  const { draft, update, consent } = useDraft();
  const diet = draft.diet ?? [];
  const selectedDiet = (choice: DietChoice) =>
    choice === 'all'
      ? diet.length === 0 && !draft.noPork
      : choice === 'noPork'
        ? !!draft.noPork
        : diet.includes(choice);
  const toggleDiet = (choice: DietChoice) => {
    if (choice === 'all') {
      update({ diet: [], noPork: false });
    } else if (choice === 'noPork') {
      update({ noPork: !draft.noPork });
    } else {
      update({ diet: diet.includes(choice) ? diet.filter((d) => d !== choice) : [...diet, choice] });
    }
  };
  const next = () => {
    router.push('/sport');
  };
  return (
    <StepScreen
      step={4}
      title={t('onboarding.meals.title')}
      primary={{ label: t('common.continue'), onPress: next }}
      secondary={<Button kind="tertiary" label={t('common.skip')} onPress={next} />}
    >
      <Text variant="subhead">{t('onboarding.meals.people')}</Text>
      <SegmentedControl
        accessibilityLabel={t('onboarding.meals.people')}
        options={PEOPLE.map((p) => ({ value: p, label: p === '4' ? t('onboarding.meals.fourPlus') : p }))}
        value={String(Math.min(draft.people ?? 1, 4)) as (typeof PEOPLE)[number]}
        onChange={(p) => {
          update({ people: Number(p) });
        }}
      />
      <TextField
        label={t('onboarding.meals.budget')}
        unit={t('onboarding.units.euro')}
        keyboardType="number-pad"
        value={draft.weeklyBudget ? String(draft.weeklyBudget) : ''}
        onChangeText={(v) => {
          const n = Number(v.replace(/\D/g, '').slice(0, 4));
          update({ weeklyBudget: n || undefined });
        }}
      />
      <Text variant="subhead">{t('onboarding.meals.diet')}</Text>
      <View style={styles.chips}>
        {DIET_CHOICES.map((choice) => (
          <Chip
            key={choice.value}
            label={t(choice.label)}
            selected={selectedDiet(choice.value)}
            onPress={() => {
              toggleDiet(choice.value);
            }}
          />
        ))}
      </View>
      {consent ? (
        <>
          <Text variant="subhead">{t('onboarding.meals.allergies')}</Text>
          <View style={styles.chips}>
            {ALLERGY_CHOICES.map((choice) => {
              const on = (draft.allergies ?? []).includes(choice.value);
              return (
                <Chip
                  key={choice.value}
                  label={t(choice.label)}
                  selected={on}
                  onPress={() => {
                    const list = draft.allergies ?? [];
                    update({
                      allergies: on ? list.filter((a) => a !== choice.value) : [...list, choice.value],
                    });
                  }}
                />
              );
            })}
          </View>
        </>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({ chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] } });
