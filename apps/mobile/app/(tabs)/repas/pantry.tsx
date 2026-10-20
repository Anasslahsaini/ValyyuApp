import { createId, type PantryItem } from '@workspace/domain/life';
import { EXPIRY_CHIPS, expiryChipDate } from '@workspace/domain/mealplan';
import { tKey } from '@workspace/i18n';
import { space } from '@workspace/tokens';
import { Chip, Text, TextField } from '@workspace/ui';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FormScreen } from '../../../src/components/FormScreen';
import { useLife } from '../../../src/data/LifeProvider';
import { useRun } from '../../../src/data/useRun';
import { localDay } from '../../../src/meals/format';

const CHIP_KEY = {
  tomorrow: tKey('repas.expTomorrow'),
  threeDays: tKey('repas.expThreeDays'),
  week: tKey('repas.expWeek'),
} as const;

/** Add or edit a fridge item: name, quantity, "use by" behind 3 quick choices (no date picker to fight with). */
export default function PantryForm() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const { state, save, remove } = useLife();
  const { busy, failed, run } = useRun<'save'>();
  const existing = params.id ? state.pantry.find((p) => p.id === params.id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [quantity, setQuantity] = useState(existing?.quantity ?? '');
  const [expires, setExpires] = useState(existing?.expiresOn?.slice(0, 10) ?? '');
  const [missingName, setMissingName] = useState(false);
  const today = localDay();

  const onSave = () => {
    if (!name.trim()) {
      setMissingName(true);
      return Promise.resolve(false);
    }
    const record: Partial<PantryItem> & { id: string } = { ...(existing ?? { id: createId() }) };
    delete record.expiresOn;
    return run('save', () =>
      save('pantry', {
        ...record,
        name: name.trim(),
        quantity: quantity.trim().slice(0, 100),
        ...(expires ? { expiresOn: expires } : {}),
      }),
    );
  };

  return (
    <FormScreen
      title={existing ? t('repas.editPantry') : t('repas.addPantry')}
      onSave={onSave}
      {...(existing ? { onDelete: () => run('save', () => remove('pantry', existing.id)) } : {})}
      busy={busy === 'save'}
      error={failed ? t('today.saveFailed') : null}
    >
      <TextField
        label={t('repas.itemName')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setMissingName(false);
        }}
        {...(missingName ? { error: t('repas.nameRequired') } : {})}
        testID="pantry-name"
      />
      <TextField
        label={t('repas.quantity')}
        help={t('repas.quantityHelp')}
        value={quantity}
        onChangeText={setQuantity}
      />
      <View style={styles.group}>
        <Text variant="subhead" tone="secondary">
          {t('repas.useBy')}
        </Text>
        <View style={styles.chips}>
          {EXPIRY_CHIPS.map((chip) => {
            const d = expiryChipDate(chip, today);
            return (
              <Chip
                key={chip}
                label={t(CHIP_KEY[chip])}
                selected={expires === d}
                onPress={() => {
                  setExpires(expires === d ? '' : d);
                }}
              />
            );
          })}
        </View>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
