import { createId } from '@workspace/domain/life';
import { expiryStatus, fridgeIdeas } from '@workspace/domain/mealplan';
import { findPantryItem } from '@workspace/domain/pantry-match';
import { ingredientName } from '@workspace/domain/recipe-catalogue';
import { slotForTime } from '@workspace/domain/nutrition';
import { tKey } from '@workspace/i18n';
import { layout, radius, space } from '@workspace/tokens';
import { Banner, Button, Card, Chip, ListRow, Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { DomainTag } from '../components/DomainTag';
import { useLife } from '../data/LifeProvider';
import { useRun } from '../data/useRun';
import { localDay } from './format';
import type { useRecipes } from './useRecipes';

/** Common things people keep at home: one tap adds them to the fridge. */
const QUICK = [
  'egg-whole-raw',
  'milk-whole',
  'tomato',
  'onion-raw',
  'potato-raw',
  'rice-white-raw',
  'pasta-dry',
  'chicken-breast-raw',
  'carrot-raw',
  'yogurt-greek-whole',
  'cheese-cheddar',
  'banana',
  'tuna-canned-water',
  'chickpeas-canned',
  'zucchini',
  'lemon',
];
const shortName = (name: string) => (name.replace(/\s*\(.*?\)/g, '').split(' / ')[0] ?? name).trim();
const EXPIRY_KEY = {
  expired: tKey('repas.expired'),
  soon: tKey('repas.useSoon'),
  ok: tKey('repas.keeps'),
} as const;

/** Frigo: what is at home, 3 meal ideas from it, and quick add of common items. */
export function FridgeView({ recipes }: { recipes: ReturnType<typeof useRecipes> }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { state, save } = useLife();
  const { failed, run } = useRun<'quick'>();
  const [page, setPage] = useState(0);
  const today = localDay();
  const s = state.settings;
  const consent = !!s.healthConsentAt;

  const ideas = useMemo(
    () =>
      state.pantry.length && recipes.all.length
        ? fridgeIdeas(recipes.all, state.pantry, {
            slot: slotForTime(),
            diet: s.diet ?? [],
            dislikes: s.dislikes ?? [],
            allergies: consent ? (s.allergies ?? []) : [],
            page,
            today,
          })
        : [],
    [recipes.all, state.pantry, s.diet, s.dislikes, s.allergies, consent, page, today],
  );
  const quick = useMemo(() => {
    const data = recipes.data;
    if (!data) return [];
    return QUICK.map((id) => shortName(ingredientName(id, i18n.language, data)))
      .filter((n) => !findPantryItem(n, state.pantry))
      .slice(0, 10);
  }, [recipes.data, i18n.language, state.pantry]);
  const sorted = [...state.pantry].sort((a, b) => (a.expiresOn ?? '9').localeCompare(b.expiresOn ?? '9'));

  return (
    <View style={styles.group}>
      {failed ? <Banner tone="danger" title={t('today.saveFailed')} /> : null}

      {state.pantry.length ? (
        <Card elevated>
          <DomainTag domain="repas" />
          <Text variant="title2">{t('repas.whatToEat')}</Text>
          {ideas.length ? (
            <View style={styles.list}>
              {ideas.map((idea, i) => (
                <Animated.View key={idea.recipe.id} entering={FadeInDown.delay(i * 60).duration(240)}>
                  <ListRow
                    title={idea.recipe.name}
                    value={
                      idea.missing.length
                        ? t('repas.missing', { count: idea.missing.length })
                        : t('repas.allThere')
                    }
                    onPress={() => {
                      router.push({ pathname: '/repas/recipe', params: { id: idea.recipe.id, cook: '1' } });
                    }}
                  />
                </Animated.View>
              ))}
            </View>
          ) : (
            <Text tone="secondary">{t('repas.noIdea')}</Text>
          )}
          {ideas.length ? (
            <Button
              kind="tertiary"
              label={t('repas.otherIdeas')}
              onPress={() => {
                setPage((p) => p + 1);
              }}
            />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text variant="headline">{t('repas.fridgeEmptyTitle')}</Text>
          <Text tone="secondary">{t('repas.fridgeEmptyBody')}</Text>
        </Card>
      )}

      {sorted.length ? (
        <View style={styles.list}>
          {sorted.map((item) => {
            const status = expiryStatus(item.expiresOn, today);
            const value = [item.quantity, status ? t(EXPIRY_KEY[status]) : null].filter(Boolean).join(' · ');
            return (
              <ListRow
                key={item.id}
                title={item.name}
                {...(value ? { value } : {})}
                onPress={() => {
                  router.push({ pathname: '/repas/pantry', params: { id: item.id } });
                }}
              />
            );
          })}
        </View>
      ) : null}

      {quick.length ? (
        <View style={styles.group}>
          <Text variant="subhead" tone="secondary" accessibilityRole="header">
            {t('repas.quickAdd')}
          </Text>
          <View style={styles.chips}>
            {quick.map((name) => (
              <Chip
                key={name}
                label={name}
                action={t('repas.quickAddOne', { name })}
                onPress={() => {
                  void run('quick', () => save('pantry', { id: createId(), name, quantity: '' }));
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[3] },
  list: { borderRadius: radius.field, overflow: 'hidden', marginHorizontal: -layout.margin / 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
