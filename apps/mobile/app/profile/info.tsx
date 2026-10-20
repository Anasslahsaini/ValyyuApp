import { editProfile } from '@workspace/domain/first-launch/profile';
import type { Place } from '@workspace/domain/onboarding';
import type { MainGoal, Sex } from '@workspace/domain/targets';
import { createId } from '@workspace/domain/life';
import { space } from '@workspace/tokens';
import { ChoiceRow, SegmentedControl, Text, TextField } from '@workspace/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FormScreen } from '../../src/components/FormScreen';
import { useLife } from '../../src/data/LifeProvider';
import { useRun } from '../../src/data/useRun';
import { GOALS, PLACES, SEXES } from '../../src/first-launch/options';
import { localDay } from '../../src/meals/format';

type Count = '1' | '2' | '3' | '4';
const COUNTS: readonly Count[] = ['1', '2', '3', '4'];

/** Mes infos: the first-launch answers, editable; the same rules apply (a minor never gets a weight goal). */
export default function MyInfo() {
  const { t } = useTranslation();
  const { state, updateSettings, save } = useLife();
  const { busy, failed, run } = useRun<'save'>();
  const s = state.settings;
  const [firstName, setFirstName] = useState(s.firstName ?? '');
  const [goal, setGoal] = useState<MainGoal | undefined>(s.mainGoal);
  const [people, setPeople] = useState<Count>(String(Math.min(4, s.people ?? 1)) as Count);
  const [budget, setBudget] = useState(s.weeklyBudget ? String(s.weeklyBudget) : '');
  const [place, setPlace] = useState<Place | undefined>(s.trainingPlace);
  const [sessions, setSessions] = useState<Count>(
    String(Math.min(4, Math.max(1, s.sessionsPerWeek ?? 3))) as Count,
  );
  const consent = !!s.healthConsentAt;
  const lastWeight = [...state.weightEntries].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight;
  const [sex, setSex] = useState<Sex | undefined>(s.sex);
  const [height, setHeight] = useState(s.heightCm ? String(s.heightCm) : '');
  const [weight, setWeight] = useState(lastWeight ? String(lastWeight) : '');
  const minor = !!s.birthYear && new Date().getFullYear() - s.birthYear < 18;

  const onSave = () => {
    const amount = Math.round(Number(budget.replace(',', '.')));
    const cm = Math.round(Number(height));
    const kg = Math.round(Number(weight.replace(',', '.')) * 10) / 10;
    const body = consent
      ? {
          ...(sex ? { sex } : {}),
          ...(cm >= 90 && cm <= 250 ? { heightCm: cm } : {}),
          ...(kg >= 20 && kg <= 400 ? { weightKg: kg } : {}),
        }
      : {};
    const patch = editProfile(state, {
      ...(firstName.trim() ? { firstName } : {}),
      ...(goal ? { mainGoal: goal } : {}),
      people: Number(people),
      ...(amount > 0 ? { weeklyBudget: Math.min(amount, 10000) } : {}),
      ...(place ? { trainingPlace: place, sessionsPerWeek: Number(sessions) } : {}),
      ...body,
    });
    return run('save', async () => {
      if (body.weightKg && body.weightKg !== lastWeight)
        await save('weightEntries', { id: createId(), date: localDay(), weight: body.weightKg });
      await updateSettings(patch);
    });
  };

  return (
    <FormScreen
      title={t('profile.info.title')}
      onSave={onSave}
      busy={busy === 'save'}
      error={failed ? t('today.saveFailed') : null}
    >
      <TextField
        label={t('onboarding.you.firstName')}
        value={firstName}
        onChangeText={setFirstName}
        testID="info-name"
      />

      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="subhead" tone="secondary">
          {t('onboarding.goal.title')}
        </Text>
        {GOALS.map((g) => (
          <ChoiceRow
            key={g.value}
            label={t(g.label)}
            selected={goal === g.value}
            onPress={() => {
              setGoal(g.value);
            }}
          />
        ))}
        {minor && goal === 'lose' ? (
          <Text variant="footnote" tone="secondary">
            {t('onboarding.goal.minorMessage')}
          </Text>
        ) : null}
      </View>

      {consent ? (
        <View style={styles.group}>
          <Text variant="subhead" tone="secondary">
            {minor ? t('onboarding.goal.bodyTitleMinor') : t('onboarding.goal.bodyTitle')}
          </Text>
          <SegmentedControl
            accessibilityLabel={t('onboarding.goal.basedOn')}
            value={sex ?? 'other'}
            onChange={setSex}
            options={SEXES.map((x) => ({ value: x.value, label: t(x.label) }))}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label={t('onboarding.goal.height')}
                unit={t('onboarding.units.cm')}
                value={height}
                onChangeText={setHeight}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label={t('onboarding.goal.weight')}
                unit={t('onboarding.units.kg')}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <Text variant="footnote" tone="secondary">
            {t('common.estimate')}
          </Text>
        </View>
      ) : null}

      <View style={styles.group}>
        <Text variant="subhead" tone="secondary">
          {t('onboarding.meals.people')}
        </Text>
        <SegmentedControl
          accessibilityLabel={t('onboarding.meals.people')}
          value={people}
          onChange={setPeople}
          options={COUNTS.map((value) => ({
            value,
            label: value === '4' ? t('onboarding.meals.fourPlus') : value,
          }))}
        />
      </View>
      <TextField
        label={t('onboarding.meals.budget')}
        unit={t('onboarding.units.euro')}
        value={budget}
        onChangeText={setBudget}
        keyboardType="number-pad"
      />

      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="subhead" tone="secondary">
          {t('onboarding.sport.where')}
        </Text>
        {PLACES.map((p) => (
          <ChoiceRow
            key={p.value}
            label={t(p.label)}
            selected={place === p.value}
            onPress={() => {
              setPlace(p.value);
            }}
          />
        ))}
      </View>
      {place && place !== 'none' ? (
        <View style={styles.group}>
          <Text variant="subhead" tone="secondary">
            {t('onboarding.sport.howOften')}
          </Text>
          <SegmentedControl
            accessibilityLabel={t('onboarding.sport.howOften')}
            value={sessions}
            onChange={setSessions}
            options={COUNTS.map((value) => ({
              value,
              label: value === '4' ? t('onboarding.meals.fourPlus') : value,
            }))}
          />
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  flex: { flex: 1, minWidth: 120 },
});
