import { mealEntry } from '@workspace/domain/meal-writes';
import { recentMeals, slotForTime } from '@workspace/domain/nutrition';
import { space } from '@workspace/tokens';
import { Chip, SegmentedControl, Text, TextField } from '@workspace/ui';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FormScreen } from '../../../src/components/FormScreen';
import { useLife } from '../../../src/data/LifeProvider';
import { useRun } from '../../../src/data/useRun';
import { localDay, SLOT_KEY, SLOTS, type MealSlot } from '../../../src/meals/format';

const toNumber = (v: string) => {
  const n = Number(v.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 100000) : 0;
};
const isSlot = (v: string | undefined): v is MealSlot => SLOTS.includes(v as MealSlot);

/** Add or edit a meal of the journal. Calories and macros only with the health consent, always an estimate. */
export default function MealForm() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string; date?: string; slot?: string }>();
  const { state, save, remove } = useLife();
  const { busy, failed, run } = useRun<'save'>();
  const existing = params.id ? state.meals.find((m) => m.id === params.id) : undefined;
  const consent = !!state.settings.healthConsentAt;
  const [name, setName] = useState(existing?.name ?? '');
  const [slot, setSlot] = useState<MealSlot>(
    existing?.slot ?? (isSlot(params.slot) ? params.slot : slotForTime()),
  );
  const [kcal, setKcal] = useState(existing?.calories ? String(existing.calories) : '');
  const [protein, setProtein] = useState(existing?.protein ? String(existing.protein) : '');
  const [carbs, setCarbs] = useState(existing?.carbs ? String(existing.carbs) : '');
  const [fat, setFat] = useState(existing?.fat ? String(existing.fat) : '');
  const [missingName, setMissingName] = useState(false);
  const recent = useMemo(() => (existing ? [] : recentMeals(state.meals, 6)), [existing, state.meals]);

  const onSave = () => {
    if (!name.trim()) {
      setMissingName(true);
      return Promise.resolve(false);
    }
    const base = mealEntry(
      {
        name,
        date: existing?.date ?? params.date ?? localDay(),
        slot,
        ...(consent
          ? {
              calories: toNumber(kcal),
              protein: toNumber(protein),
              carbs: toNumber(carbs),
              fat: toNumber(fat),
            }
          : {}),
      },
      existing?.id,
    );
    return run('save', () =>
      save('meals', existing ? { ...existing, ...base, servings: existing.servings } : base),
    );
  };

  return (
    <FormScreen
      title={existing ? t('repas.editMeal') : t('repas.addMeal')}
      onSave={onSave}
      {...(existing ? { onDelete: () => run('save', () => remove('meals', existing.id)) } : {})}
      busy={busy === 'save'}
      error={failed ? t('today.saveFailed') : null}
    >
      {recent.length ? (
        <View style={styles.group}>
          <Text variant="subhead" tone="secondary">
            {t('repas.recent')}
          </Text>
          <View style={styles.chips}>
            {recent.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                action={t('repas.useRecent', { name: m.name })}
                onPress={() => {
                  setName(m.name);
                  setMissingName(false);
                  if (consent) {
                    setKcal(m.calories ? String(m.calories) : '');
                    setProtein(m.protein ? String(m.protein) : '');
                    setCarbs(m.carbs ? String(m.carbs) : '');
                    setFat(m.fat ? String(m.fat) : '');
                  }
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      <TextField
        label={t('repas.mealName')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setMissingName(false);
        }}
        {...(missingName ? { error: t('repas.nameRequired') } : {})}
        testID="meal-name"
      />
      <SegmentedControl
        accessibilityLabel={t('repas.slot')}
        value={slot}
        onChange={setSlot}
        options={SLOTS.map((value) => ({ value, label: t(SLOT_KEY[value]) }))}
      />
      {consent ? (
        <View style={styles.group}>
          <TextField
            label={t('repas.calories')}
            unit={t('repas.kcalUnit')}
            value={kcal}
            onChangeText={setKcal}
            keyboardType="number-pad"
            testID="meal-kcal"
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label={t('repas.protein')}
                unit={t('repas.gramUnit')}
                value={protein}
                onChangeText={setProtein}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label={t('repas.carbs')}
                unit={t('repas.gramUnit')}
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label={t('repas.fat')}
                unit={t('repas.gramUnit')}
                value={fat}
                onChangeText={setFat}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Text variant="footnote" tone="secondary">
            {t('common.estimate')}
          </Text>
        </View>
      ) : (
        <Text variant="footnote" tone="secondary">
          {t('repas.noConsentMacros')}
        </Text>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  flex: { flex: 1, minWidth: 96 },
});
