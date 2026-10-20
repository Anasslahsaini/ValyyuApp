import { totalsForDate } from '@workspace/domain/life';
import { addDays, dayCalorieTarget, isPlannedMealDone } from '@workspace/domain/mealplan';
import { logPlannedWrites, makeWeekWrites, swapPlannedWrites } from '@workspace/domain/week-writes';
import { color, layout, radius, space } from '@workspace/tokens';
import { Banner, Button, Card, IconButton, ListRow, Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, StyleSheet, View } from 'react-native';
import { DecisionCard } from '../components/DecisionCard';
import { Icon } from '../components/Icon';
import { useLife } from '../data/LifeProvider';
import { useRun } from '../data/useRun';
import { dayLabel, dayOf, localDay, number, SLOT_KEY, SLOTS } from './format';
import type { useRecipes } from './useRecipes';

const seed = () => 1 + Math.floor(Math.random() * 1_000_000);

/** Semaine: one day at a time (start / end arrows), what is planned per meal, what was eaten, the day's estimate. */
export function WeekView({ recipes }: { recipes: ReturnType<typeof useRecipes> }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { state, apply } = useLife();
  const { busy, failed, run } = useRun<'week' | 'swap' | 'log'>();
  const today = localDay();
  const [date, setDate] = useState(today);
  const lang = i18n.language;
  const s = state.settings;
  const hasConsent = !!s.healthConsentAt;
  const hasPlan = state.plannedMeals.some((p) => dayOf(p) >= today);
  const catalogue = recipes.data;

  const totals = totalsForDate(state.meals, date);
  const { target } = dayCalorieTarget(hasConsent ? s.calorieTarget : 0, state.sessions, date);

  const makeWeek = () => {
    if (!catalogue) return;
    void run('week', async () => {
      await apply(makeWeekWrites(state, catalogue, { today, lang, seed: seed() }).writes);
      setDate(today);
    });
  };

  const openRecipe = (id: string, plannedId: string) => {
    router.push({ pathname: '/repas/recipe', params: { id, planned: plannedId } });
  };

  const back = I18nManager.isRTL
    ? { sf: 'chevron.right', md: 'chevron-right' }
    : { sf: 'chevron.left', md: 'chevron-left' };
  const next = I18nManager.isRTL
    ? { sf: 'chevron.left', md: 'chevron-left' }
    : { sf: 'chevron.right', md: 'chevron-right' };

  return (
    <View style={styles.group}>
      {failed ? <Banner tone="danger" title={t('today.saveFailed')} /> : null}

      <View style={styles.dayNav}>
        <IconButton
          accessibilityLabel={t('repas.previousDay')}
          onPress={() => {
            setDate(addDays(date, -1));
          }}
          icon={<Icon sf={back.sf as never} md={back.md as never} color={color.ink.primary} />}
        />
        <View style={styles.dayTitle} accessibilityLiveRegion="polite">
          <Text variant="headline" align="center">
            {date === today ? t('repas.today') : dayLabel(date, lang)}
          </Text>
          {date === today ? (
            <Text variant="footnote" tone="secondary" align="center">
              {dayLabel(date, lang)}
            </Text>
          ) : null}
        </View>
        <IconButton
          accessibilityLabel={t('repas.nextDay')}
          onPress={() => {
            setDate(addDays(date, 1));
          }}
          icon={<Icon sf={next.sf as never} md={next.md as never} color={color.ink.primary} />}
        />
      </View>
      {date !== today ? (
        <Button
          kind="tertiary"
          label={t('repas.backToToday')}
          onPress={() => {
            setDate(today);
          }}
        />
      ) : null}

      {hasConsent && target > 0 ? (
        <Card>
          <Text variant="subhead" tone="secondary">
            {t('repas.dayEstimate')}
          </Text>
          <Text variant="title2" numeric>
            {t('repas.kcalOf', { eaten: number(totals.calories, lang), target: number(target, lang) })}
          </Text>
          <View
            style={styles.bar}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: target, now: Math.min(totals.calories, target) }}
          >
            <View style={[styles.barFill, { flex: Math.min(1, totals.calories / target) }]} />
            <View style={{ flex: Math.max(0, 1 - totals.calories / target) }} />
          </View>
          <Text variant="footnote" tone="secondary">
            {t('common.estimate')}
          </Text>
        </Card>
      ) : null}

      {!hasPlan ? (
        <Card elevated>
          <Text variant="title2">{t('today.weekTitle')}</Text>
          <Text tone="secondary">{t('today.weekBody')}</Text>
          <Button
            label={t('today.makeWeek')}
            onPress={makeWeek}
            loading={busy === 'week'}
            disabled={!catalogue}
            testID="repas-make-week"
          />
        </Card>
      ) : null}

      {SLOTS.map((slot, index) => {
        const planned = state.plannedMeals.find((p) => dayOf(p) === date && p.slot === slot);
        const eaten = state.meals.filter((m) => dayOf(m) === date && m.slot === slot);
        const done = planned ? isPlannedMealDone(state.meals, planned) : false;
        return (
          <View key={slot} style={styles.slot}>
            <Text variant="subhead" tone="secondary" accessibilityRole="header">
              {t(SLOT_KEY[slot])}
            </Text>
            {planned && !done ? (
              <DecisionCard
                index={index}
                domain="repas"
                {...(planned.minutes ? { meta: t('repas.minutes', { minutes: planned.minutes }) } : {})}
                title={planned.name}
                {...(planned.recipeId
                  ? {
                      details: {
                        label: t('repas.seeRecipe'),
                        onPress: () => {
                          openRecipe(planned.recipeId ?? '', planned.id);
                        },
                      },
                    }
                  : {})}
                changing={busy === 'swap'}
                {...(catalogue && date >= today
                  ? {
                      onChange: () => {
                        void run('swap', () =>
                          apply(swapPlannedWrites(state, catalogue, planned, { today, lang, seed: seed() })),
                        );
                      },
                    }
                  : {})}
                {...(catalogue
                  ? {
                      onOk: () => {
                        void run('log', () => apply(logPlannedWrites(state, catalogue, planned)));
                      },
                    }
                  : {})}
              />
            ) : null}
            {eaten.length ? (
              <View style={styles.list}>
                {eaten.map((m) => (
                  <ListRow
                    key={m.id}
                    title={m.name}
                    {...(hasConsent && m.calories
                      ? { value: t('repas.kcal', { kcal: number(m.calories * m.servings, lang) }) }
                      : {})}
                    onPress={() => {
                      router.push({ pathname: '/repas/meal', params: { id: m.id } });
                    }}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.start}>
              <Button
                kind="tertiary"
                label={t('repas.addTo', { slot: t(SLOT_KEY[slot]).toLowerCase() })}
                onPress={() => {
                  router.push({ pathname: '/repas/meal', params: { date, slot } });
                }}
              />
            </View>
          </View>
        );
      })}

      {hasPlan ? (
        <Button
          kind="secondary"
          label={t('repas.remakeWeek')}
          onPress={makeWeek}
          loading={busy === 'week'}
          disabled={!catalogue}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[4] },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dayTitle: { flex: 1 },
  bar: {
    flexDirection: 'row',
    height: space[2],
    borderRadius: radius.pill,
    backgroundColor: color.bg.sunken,
    overflow: 'hidden',
  },
  barFill: { backgroundColor: color.domain.repas.fg },
  slot: { gap: space[2] },
  list: { borderRadius: radius.field, overflow: 'hidden' },
  start: { alignItems: 'flex-start', marginStart: -layout.margin / 2 },
});
