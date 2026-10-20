import { exerciseLabel } from '@workspace/domain/training/exercise-names';
import { exerciseProgress, formatKg, summarizeSets } from '@workspace/domain/training/history';
import { weeklyStreak } from '@workspace/domain/streak';
import { color, layout, radius, space } from '@workspace/tokens';
import { Button, Card, ListRow, Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { DomainTag } from '../../../src/components/DomainTag';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { localDay } from '../../../src/meals/format';
import { useTodayWorkout } from '../../../src/sport/useTodayWorkout';

/** Sport: today's session (start, another one), the week's goal, records and the last sessions. */
export default function Sport() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { state } = useLife();
  const [variant, setVariant] = useState(0);
  const s = state.settings;
  const plansSport = s.trainingPlace !== 'none' && (s.sessionsPerWeek ?? 0) > 0;
  const [short, setShort] = useState(!plansSport);
  const minutes = short ? 10 : undefined;
  const { workout } = useTodayWorkout(variant, minutes);
  const lang = i18n.language;
  const goal = s.sessionsPerWeek || 3;
  const streak = useMemo(() => weeklyStreak(state, goal), [state, goal]);
  const records = useMemo(() => exerciseProgress(state.sessions).slice(0, 3), [state.sessions]);
  const last = useMemo(
    () => [...state.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [state.sessions],
  );
  const doneToday = state.sessions.some((x) => localDay(new Date(x.date)) === localDay());

  const start = () => {
    router.push({
      pathname: '/sport/session',
      params: { variant: String(variant), ...(minutes ? { minutes: String(minutes) } : {}) },
    });
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Animated.View key={`${String(variant)}-${String(short)}`} entering={FadeInDown.duration(260)}>
        <Card elevated>
          <View style={styles.top}>
            <DomainTag domain="sport" />
            <Text variant="footnote" tone="secondary">
              {t('sport.meta', { minutes: workout.minutes, count: workout.exercises.length })}
            </Text>
          </View>
          <Text variant="title2">{doneToday ? t('sport.doneTodayTitle') : workout.name}</Text>
          {workout.exercises.length ? (
            <View style={styles.exercises}>
              {workout.exercises.map((e) => (
                <View key={e.id} style={styles.exercise}>
                  <View style={styles.dot} />
                  <View style={styles.flex}>
                    <Text>{exerciseLabel(e.name, lang)}</Text>
                  </View>
                  <Text variant="callout" tone="secondary" numeric>
                    {e.weight > 0
                      ? t('sport.setsRepsKg', { sets: e.sets, reps: e.reps, kg: formatKg(e.weight) })
                      : t('sport.setsReps', { sets: e.sets, reps: e.reps })}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text tone="secondary">{t('sport.noExercise')}</Text>
          )}
          <Button
            label={t('sport.start')}
            onPress={start}
            disabled={!workout.exercises.length}
            testID="sport-start"
          />
          <View style={styles.row}>
            <Button
              kind="tertiary"
              label={t('sport.another')}
              onPress={() => {
                setVariant((v) => v + 1);
              }}
            />
            <Button
              kind="tertiary"
              label={short ? t('sport.normalLength') : t('sport.tenMinutes')}
              onPress={() => {
                setShort((v) => !v);
              }}
            />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(80)}>
        <Card>
          <Text variant="subhead" tone="secondary">
            {t('sport.thisWeek')}
          </Text>
          <Text variant="title2" numeric>
            {t('sport.weekCount', { done: streak.thisWeek.sessions, goal })}
          </Text>
          <View
            style={styles.pips}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: goal }, (_, i) => (
              <View key={i} style={[styles.pip, i < streak.thisWeek.sessions && styles.pipOn]} />
            ))}
          </View>
          {streak.weeks > 1 ? (
            <View style={styles.row}>
              <Icon sf="flame.fill" md="local-fire-department" color={color.domain.sport.fg} size={18} />
              <Text variant="callout">{t('sport.streak', { count: streak.weeks })}</Text>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      {records.length ? (
        <View style={styles.group}>
          <Text variant="subhead" tone="secondary" accessibilityRole="header">
            {t('sport.records')}
          </Text>
          <View style={styles.list}>
            {records.map((r) => (
              <ListRow
                key={r.name}
                title={exerciseLabel(r.name, lang)}
                value={
                  r.bestWeight > 0
                    ? t('sport.kg', { kg: formatKg(r.bestWeight) })
                    : t('sport.reps', { count: r.bestReps })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        <Text variant="subhead" tone="secondary" accessibilityRole="header">
          {t('sport.history')}
        </Text>
        {last.length ? (
          <View style={styles.list}>
            {last.map((x) => (
              <ListRow
                key={x.id}
                title={x.workoutName}
                value={[
                  new Date(x.date).toLocaleDateString(lang, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  }),
                  x.exercises
                    .slice(0, 2)
                    .map((e) => `${exerciseLabel(e.name, lang)} ${summarizeSets(e.sets)}`)
                    .join(', '),
                ].join(' · ')}
              />
            ))}
          </View>
        ) : (
          <Text tone="secondary">{t('sport.noHistory')}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[4], paddingBottom: space[12] },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  exercises: { gap: space[2] },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dot: {
    width: space[2],
    height: space[2],
    borderRadius: radius.pill,
    backgroundColor: color.domain.sport.fg,
  },
  flex: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  pips: { flexDirection: 'row', gap: space[2] },
  pip: { flex: 1, height: space[2], borderRadius: radius.pill, backgroundColor: color.bg.sunken },
  pipOn: { backgroundColor: color.domain.sport.fg },
  group: { gap: space[2] },
  list: { borderRadius: radius.field, overflow: 'hidden' },
});
