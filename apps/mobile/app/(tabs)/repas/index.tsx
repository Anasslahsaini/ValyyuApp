import { money } from '@workspace/domain/mealplan';
import { color, layout, radius, space } from '@workspace/tokens';
import { Banner, Button, IconButton, ListRow, SegmentedControl } from '@workspace/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { FridgeView } from '../../../src/meals/FridgeView';
import { GroceriesView } from '../../../src/meals/GroceriesView';
import { useRecipes } from '../../../src/meals/useRecipes';
import { WeekView } from '../../../src/meals/WeekView';

type Tab = 'week' | 'fridge' | 'groceries';
const ADD = { week: 'repas.addMeal', fridge: 'repas.addPantry', groceries: 'repas.addGrocery' } as const;

/** Repas: the week (what to eat, what was eaten), the fridge (what to cook with it) and the grocery list. */
export default function Repas() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { state } = useLife();
  const recipes = useRecipes();
  const [tab, setTab] = useState<Tab>(
    params.tab === 'fridge' || params.tab === 'groceries' ? params.tab : 'week',
  );
  const s = state.settings;
  const hasConsent = !!s.healthConsentAt;

  const info = [
    hasConsent && s.calorieTarget ? t('repas.kcalDay', { kcal: s.calorieTarget }) : null,
    s.weeklyBudget
      ? t('repas.budgetWeek', { amount: money(s.weeklyBudget, s.currency, i18n.language) })
      : null,
    t('repas.people', { count: s.people ?? 1 }),
  ]
    .filter(Boolean)
    .join(' · ');

  const add = () => {
    if (tab === 'week') router.push('/repas/meal');
    else if (tab === 'fridge') router.push('/repas/pantry');
    else router.push('/repas/grocery');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              accessibilityLabel={t(ADD[tab])}
              onPress={add}
              filled
              icon={<Icon sf="plus" md="add" color={color.bg.surface} />}
              testID="repas-add"
            />
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.info}>
          <ListRow
            title={t('repas.myInfo')}
            value={info}
            onPress={() => {
              router.push('/profile');
            }}
          />
        </View>
        <SegmentedControl
          accessibilityLabel={t('tabs.repas')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'week', label: t('repas.tabWeek') },
            { value: 'fridge', label: t('repas.tabFridge') },
            {
              value: 'groceries',
              label: state.groceries.length
                ? t('repas.tabGroceriesCount', { count: state.groceries.length })
                : t('repas.tabGroceries'),
            },
          ]}
        />
        {recipes.error ? (
          <View style={styles.group}>
            <Banner tone="danger" title={t('today.catalogueFailed')} />
            <Button kind="secondary" label={t('common.retry')} onPress={recipes.retry} />
          </View>
        ) : null}
        <Animated.View key={tab} entering={FadeIn.duration(200)} style={styles.group}>
          {tab === 'week' ? <WeekView recipes={recipes} /> : null}
          {tab === 'fridge' ? <FridgeView recipes={recipes} /> : null}
          {tab === 'groceries' ? (
            <GroceriesView
              onMakeWeek={() => {
                setTab('week');
              }}
            />
          ) : null}
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[4], paddingBottom: space[12] },
  info: { borderRadius: radius.field, overflow: 'hidden' },
  group: { gap: space[3] },
});
