import { cookedWrites } from '@workspace/domain/meal-writes';
import { ingredientAmount, isPlannedMealDone, pantryFor } from '@workspace/domain/mealplan';
import { slotForTime } from '@workspace/domain/nutrition';
import { recipeSteps } from '@workspace/domain/recipe-catalogue';
import { logPlannedWrites } from '@workspace/domain/week-writes';
import { color, layout, radius, space } from '@workspace/tokens';
import { Banner, Button, Card, Text } from '@workspace/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DomainTag } from '../../../src/components/DomainTag';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { useRun } from '../../../src/data/useRun';
import { localDay, number } from '../../../src/meals/format';
import { useRecipes } from '../../../src/meals/useRecipes';
import { CloseButton } from '../../../src/navigation/CloseButton';

/** A recipe: time, ingredients (what the fridge already has is marked), steps; "Je l'ai mangé" or "Je l'ai cuisiné". */
export default function RecipeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; planned?: string; cook?: string }>();
  const { state, apply } = useLife();
  const recipes = useRecipes();
  const { busy, failed, run } = useRun<'log'>();
  const recipe = params.id ? recipes.byId.get(params.id) : undefined;
  const planned = params.planned ? state.plannedMeals.find((p) => p.id === params.planned) : undefined;
  const people = state.settings.people ?? 1;
  const servings = planned?.servings ?? people;
  const factor = recipe ? servings / (recipe.servings || 1) : 1;
  const consent = !!state.settings.healthConsentAt;
  const close = () => {
    router.back();
  };

  const catalogueRecipe = recipes.data?.recipes.find((r) => r.id === params.id);
  const steps = catalogueRecipe
    ? recipeSteps(catalogueRecipe, i18n.language)
    : (state.recipes.find((r) => r.id === params.id)?.steps ?? []);
  const done = planned ? isPlannedMealDone(state.meals, planned) : false;

  const header = <Stack.Screen options={{ title: '', headerRight: () => <CloseButton onPress={close} /> }} />;
  if (!recipe) {
    return (
      <View style={styles.center}>
        {header}
        {recipes.error ? <Banner tone="danger" title={t('today.catalogueFailed')} /> : <ActivityIndicator />}
      </View>
    );
  }

  const markEaten = () => {
    const data = recipes.data;
    void run('log', async () => {
      if (planned && data) await apply(logPlannedWrites(state, data, planned));
      else await apply(cookedWrites(state, recipe, { date: localDay(), slot: slotForTime(), servings }));
      close();
    });
  };

  return (
    <>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[6] }]}>
        <Animated.View entering={FadeInDown.duration(260)} style={styles.group}>
          <DomainTag domain="repas" />
          <Text variant="title1" accessibilityRole="header">
            {recipe.name}
          </Text>
          <Text tone="secondary">
            {t('repas.recipeMeta', { minutes: recipe.prepMinutes + recipe.cookMinutes, count: servings })}
          </Text>
          {consent && recipe.macrosKnown !== false ? (
            <Text variant="footnote" tone="secondary">
              {t('repas.perServing', { kcal: number(recipe.perServing.calories, i18n.language) })} ·{' '}
              {t('common.estimate')}
            </Text>
          ) : null}
        </Animated.View>

        {failed ? <Banner tone="danger" title={t('today.saveFailed')} /> : null}

        <Card>
          <Text variant="headline" accessibilityRole="header">
            {t('repas.ingredients')}
          </Text>
          {recipe.ingredients.map((ing, i) => {
            const have = !ing.staple && !!pantryFor(ing, state.pantry);
            const amount = ingredientAmount(ing, factor);
            return (
              <View
                key={`${ing.name}-${String(i)}`}
                style={styles.line}
                accessible
                accessibilityLabel={[amount, ing.name, have ? t('repas.inFridge') : null]
                  .filter(Boolean)
                  .join(' ')}
              >
                <View style={[styles.dot, have && styles.dotHave]}>
                  {have ? <Icon sf="checkmark" md="check" color={color.bg.surface} size={12} /> : null}
                </View>
                <View style={styles.flex}>
                  <Text>{ing.name}</Text>
                  {have ? (
                    <Text variant="footnote" tone="success">
                      {t('repas.inFridge')}
                    </Text>
                  ) : null}
                </View>
                {amount ? (
                  <Text tone="secondary" numeric>
                    {amount}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Card>

        {steps.length ? (
          <Card>
            <Text variant="headline" accessibilityRole="header">
              {t('repas.steps')}
            </Text>
            {steps.map((step, i) => (
              <View key={String(i)} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text variant="footnote" numeric>
                    {String(i + 1)}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text>{step}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {done ? (
          <View style={styles.done}>
            <Icon sf="checkmark" md="check" color={color.success.fg} size={18} />
            <Text variant="headline" tone="success">
              {t('today.noted')}
            </Text>
          </View>
        ) : (
          <Button
            label={planned ? t('repas.ateIt') : t('repas.cookedIt')}
            onPress={markEaten}
            loading={busy === 'log'}
            testID="recipe-done"
          />
        )}
        {!planned && !done ? (
          <Text variant="footnote" tone="secondary">
            {t('repas.cookedHint')}
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.margin },
  content: { padding: layout.margin, gap: space[4] },
  group: { gap: space[2] },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space[8] },
  flex: { flex: 1 },
  dot: {
    width: space[5],
    height: space[5],
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.border.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotHave: { backgroundColor: color.success.fg, borderColor: color.success.fg },
  step: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  stepNumber: {
    width: space[6],
    height: space[6],
    borderRadius: radius.pill,
    backgroundColor: color.bg.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { flexDirection: 'row', alignItems: 'center', gap: space[2], justifyContent: 'center' },
});
