import { allBoughtWrites } from '@workspace/domain/meal-writes';
import { money } from '@workspace/domain/mealplan';
import { color, radius, size, space } from '@workspace/tokens';
import { Banner, Button, Card, IconButton, Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Icon } from '../components/Icon';
import { useLife } from '../data/LifeProvider';
import { useRun } from '../data/useRun';

/** Courses: the list (ticked lines go to the end), its estimated total against the budget, "Tout est acheté". */
export function GroceriesView({ onMakeWeek }: { onMakeWeek: () => void }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { state, save, apply } = useLife();
  const { busy, failed, run } = useRun<'toggle' | 'bought'>();
  const [moved, setMoved] = useState<number | null>(null);
  const s = state.settings;
  const fm = (n: number, digits = 0) => money(n, s.currency, i18n.language, digits);
  const total = state.groceries.reduce((sum, g) => sum + (g.estimatedCost || 0), 0);
  const lines = [...state.groceries].sort((a, b) => Number(a.checked) - Number(b.checked));

  if (!lines.length) {
    return (
      <View style={styles.group}>
        {moved !== null ? <Banner tone="info" title={t('repas.boughtDone', { count: moved })} /> : null}
        <Card>
          <Text variant="headline">{t('repas.groceriesEmptyTitle')}</Text>
          <Text tone="secondary">{t('repas.groceriesEmptyBody')}</Text>
          <Button kind="secondary" label={t('today.makeWeek')} onPress={onMakeWeek} />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.group}>
      {failed ? <Banner tone="danger" title={t('today.saveFailed')} /> : null}
      <Card>
        <View style={styles.totals}>
          <View style={styles.flex}>
            <Text variant="subhead" tone="secondary">
              {t('repas.listTotal')}
            </Text>
            <Text variant="title1" numeric>
              {t('repas.about', { amount: fm(total) })}
            </Text>
          </View>
          <View style={styles.end}>
            <Text variant="subhead" tone="secondary">
              {t('repas.budget')}
            </Text>
            <Text variant="headline" numeric>
              {s.weeklyBudget ? fm(s.weeklyBudget) : t('repas.noBudget')}
            </Text>
          </View>
        </View>
        {s.weeklyBudget && total > s.weeklyBudget ? (
          <Text variant="footnote" tone="danger">
            {t('repas.overBudget', { amount: fm(total - s.weeklyBudget) })}
          </Text>
        ) : null}
        <Text variant="footnote" tone="secondary">
          {t('repas.pricesEstimate')}
        </Text>
      </Card>

      <View style={styles.list}>
        {lines.map((g, i) => (
          <Animated.View key={g.id} layout={LinearTransition} style={[styles.line, i > 0 && styles.rule]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: g.checked }}
              accessibilityLabel={[g.name, g.quantity].filter(Boolean).join(', ')}
              onPress={() => {
                void run('toggle', () => save('groceries', { ...g, checked: !g.checked }));
              }}
              style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
              testID={`grocery-${g.id}`}
            >
              <View style={[styles.box, g.checked && styles.boxOn]}>
                {g.checked ? <Icon sf="checkmark" md="check" color={color.bg.surface} size={16} /> : null}
              </View>
              <View style={styles.flex}>
                <Text tone={g.checked ? 'secondary' : 'primary'} strike={g.checked}>
                  {g.name}
                </Text>
                {g.quantity ? (
                  <Text variant="footnote" tone="secondary">
                    {g.quantity}
                  </Text>
                ) : null}
              </View>
              {g.estimatedCost ? (
                <Text variant="callout" tone="secondary" numeric>
                  {fm(g.estimatedCost, 2)}
                </Text>
              ) : null}
            </Pressable>
            <IconButton
              accessibilityLabel={t('repas.editLine', { name: g.name })}
              onPress={() => {
                router.push({ pathname: '/repas/grocery', params: { id: g.id } });
              }}
              icon={<Icon sf="pencil" md="edit" color={color.ink.secondary} size={20} />}
            />
          </Animated.View>
        ))}
      </View>

      <Button
        kind="secondary"
        label={t('repas.allBought')}
        loading={busy === 'bought'}
        onPress={() => {
          const count = state.groceries.length;
          void run('bought', async () => {
            await apply(allBoughtWrites(state));
            setMoved(count);
          });
        }}
        testID="repas-all-bought"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[3] },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], alignItems: 'flex-end' },
  flex: { flex: 1, minWidth: 120 },
  end: { alignItems: 'flex-end' },
  list: { backgroundColor: color.bg.surface, borderRadius: radius.card, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', paddingEnd: space[1] },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border.hairline },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingStart: space[4],
    paddingVertical: space[3],
    minHeight: size.touchMin,
  },
  pressed: { backgroundColor: color.bg.sunken },
  box: {
    width: space[6],
    height: space[6],
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: color.border.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: color.ink.primary, borderColor: color.ink.primary },
});
