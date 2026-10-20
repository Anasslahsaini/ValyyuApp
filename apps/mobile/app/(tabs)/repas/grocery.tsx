import { createId } from '@workspace/domain/life';
import { TextField } from '@workspace/ui';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormScreen } from '../../../src/components/FormScreen';
import { useLife } from '../../../src/data/LifeProvider';
import { useRun } from '../../../src/data/useRun';

/** Add or edit a grocery line: name, quantity, estimated price. */
export default function GroceryForm() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const { state, save, remove } = useLife();
  const { busy, failed, run } = useRun<'save'>();
  const existing = params.id ? state.groceries.find((g) => g.id === params.id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [quantity, setQuantity] = useState(existing?.quantity ?? '');
  const [cost, setCost] = useState(existing?.estimatedCost ? String(existing.estimatedCost) : '');
  const [missingName, setMissingName] = useState(false);
  const currency =
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: state.settings.currency || 'EUR' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? state.settings.currency;

  const onSave = () => {
    if (!name.trim()) {
      setMissingName(true);
      return Promise.resolve(false);
    }
    const price = Number(cost.replace(',', '.'));
    return run('save', () =>
      save('groceries', {
        ...(existing ?? { id: createId(), checked: false }),
        name: name.trim(),
        quantity: quantity.trim().slice(0, 100),
        estimatedCost: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 0,
      }),
    );
  };

  return (
    <FormScreen
      title={existing ? t('repas.editGrocery') : t('repas.addGrocery')}
      onSave={onSave}
      {...(existing ? { onDelete: () => run('save', () => remove('groceries', existing.id)) } : {})}
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
        testID="grocery-name"
      />
      <TextField label={t('repas.quantity')} value={quantity} onChangeText={setQuantity} />
      <TextField
        label={t('repas.price')}
        unit={currency}
        value={cost}
        onChangeText={setCost}
        keyboardType="decimal-pad"
      />
    </FormScreen>
  );
}
