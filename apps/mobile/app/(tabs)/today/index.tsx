import { useUser } from '@clerk/expo';
import { logPlannedWrites, makeWeekWrites, swapPlannedWrites } from '@workspace/domain/week-writes';
import { color, layout, radius, size, space } from '@workspace/tokens';
import { Banner, Button, Card, ListRow, Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { tKey } from '@workspace/i18n';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { DecisionCard } from '../../../src/components/DecisionCard';
import { DomainTag } from '../../../src/components/DomainTag';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { useCatalogue } from '../../../src/meals/useCatalogue';
import { todayView } from '../../../src/today/today';

const localDay = (d: Date) =>
  `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SLOT_KEY = {
  breakfast: tKey('today.slot.breakfast'),
  lunch: tKey('today.slot.lunch'),
  dinner: tKey('today.slot.dinner'),
  snack: tKey('today.slot.snack'),
} as const;

/** Aujourd'hui: A1 new person, A2 three ready decisions, A3 day done, A4 loading. */
export default function Today() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUser();
  const { state, apply } = useLife();
  const catalogue = useCatalogue();
  const [busy, setBusy] = useState<'week' | 'swap' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = useMemo(() => todayView(state), [state]);
  const now = new Date();
  const dateLabel = now.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  const name = state.settings.firstName ?? user?.firstName ?? '';
  const hasConsent = !!state.settings.healthConsentAt;

  const run = (kind: 'week' | 'swap', action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    action()
      .catch(() => {
        setError(t('today.saveFailed'));
      })
      .finally(() => {
        setBusy(null);
      });
  };
  const makeWeek = () => {
    if (!catalogue.data) return;
    const data = catalogue.data;
    run('week', () =>
      apply(
        makeWeekWrites(state, data, { today: localDay(now), lang: i18n.language, seed: Date.now() % 100000 })
          .writes,
      ),
    );
  };

  const allDone = !!view.meal?.done && (!view.workout || view.workout.done);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text variant="subhead" tone="secondary">
        {name ? t('today.greeting', { date: dateLabel, name }) : dateLabel}
      </Text>
      {error ? <Banner tone="danger" title={error} /> : null}

      {catalogue.error ? (
        <View style={styles.group}>
          <Banner tone="danger" title={t('today.catalogueFailed')} />
          <Button kind="secondary" label={t('common.retry')} onPress={catalogue.retry} />
        </View>
      ) : null}

      {!catalogue.data && !catalogue.error ? (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator />
          <Text>{t('today.preparing')}</Text>
        </View>
      ) : null}

      {view.meal ? (
        <>
          {allDone ? (
            <Animated.View entering={FadeIn} style={styles.ready}>
              <View style={styles.readyIcon}>
                <Icon sf="checkmark" md="check" color={color.ink.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="title2" color={color.bg.surface}>
                  {t('today.dayReadyTitle')}
                </Text>
                <Text variant="callout" color={color.bg.sunken}>
                  {t('today.dayReadyBody')}
                </Text>
              </View>
            </Animated.View>
          ) : null}
          <DecisionCard
            index={0}
            domain="repas"
            meta={t(SLOT_KEY[view.meal.planned.slot])}
            title={view.meal.planned.name}
            note={hasConsent ? t('common.estimate') : t('today.noConsent')}
            done={view.meal.done ? t('today.noted') : null}
            changing={busy === 'swap'}
            onChange={() => {
              const data = catalogue.data;
              const planned = view.meal?.planned;
              if (!data || !planned) return;
              run('swap', () =>
                apply(
                  swapPlannedWrites(state, data, planned, {
                    today: localDay(now),
                    lang: i18n.language,
                    seed: Date.now() % 100000,
                  }),
                ),
              );
            }}
            onOk={() => {
              const data = catalogue.data;
              const planned = view.meal?.planned;
              if (!data || !planned) return;
              run('swap', () => apply(logPlannedWrites(state, data, planned)));
            }}
          />
        </>
      ) : (
        <Animated.View entering={FadeInDown.duration(280)}>
          <Card elevated>
            <DomainTag domain="repas" />
            <Text variant="title2">{t('today.weekTitle')}</Text>
            <Text tone="secondary">{t('today.weekBody')}</Text>
            <Button
              label={t('today.makeWeek')}
              onPress={makeWeek}
              loading={busy === 'week'}
              disabled={!catalogue.data}
              testID="today-make-week"
            />
          </Card>
        </Animated.View>
      )}

      {view.workout ? (
        <DecisionCard
          index={1}
          domain="sport"
          meta={t('today.workoutMeta', { minutes: view.workout.today.minutes })}
          title={t('today.workoutTitle', { count: view.workout.today.exercises.length })}
          done={view.workout.done ? t('today.workoutDone') : null}
          onOk={() => {
            router.navigate('/sport');
          }}
        />
      ) : null}

      {view.outfit ? (
        <DecisionCard
          index={2}
          domain="style"
          title={view.outfit.names}
          onOk={() => {
            router.navigate('/style');
          }}
        />
      ) : null}

      {!view.meal || !view.outfit ? (
        <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.group}>
          <Text variant="subhead" tone="secondary">
            {t('today.orStart')}
          </Text>
          <View style={styles.list}>
            {!view.workout ? (
              <ListRow
                title={t('today.tryWorkout')}
                onPress={() => {
                  router.navigate('/sport');
                }}
              />
            ) : null}
            {!view.outfit ? (
              <ListRow
                title={t('today.photoClothes')}
                onPress={() => {
                  router.navigate('/style');
                }}
              />
            ) : null}
          </View>
          <View style={styles.hint}>
            <Icon sf="mic.fill" md="mic" color={color.ink.secondary} size={18} />
            <View style={styles.flex}>
              <Text variant="footnote" tone="secondary">
                {t('today.micHint')}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : (
        <Text variant="footnote" tone="secondary">
          {t('today.tomorrow')}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[3] },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  ready: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    backgroundColor: color.ink.primary,
    borderRadius: radius.card,
    padding: space[4],
  },
  readyIcon: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.pill,
    backgroundColor: color.accent.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  group: { gap: space[2] },
  list: { borderRadius: radius.field, overflow: 'hidden' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingTop: space[2] },
});
