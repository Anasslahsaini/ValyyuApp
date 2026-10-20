import { sessionKcal } from '@workspace/domain/targets';
import { exerciseLabel } from '@workspace/domain/training/exercise-names';
import { countPRs, detectPRs, isPR, summarizeSets } from '@workspace/domain/training/history';
import { weeklyStreak } from '@workspace/domain/streak';
import { color, layout, radius, size, space } from '@workspace/tokens';
import { Button, Card, Text } from '@workspace/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { CloseButton } from '../../../src/navigation/CloseButton';

/** Session done: what was done, records beaten, the week's goal. Calories only with consent, as an estimate. */
export default function SessionDone() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state } = useLife();
  const session = state.sessions.find((x) => x.id === id);
  const prs = useMemo(() => (session ? detectPRs(session, state.sessions) : {}), [session, state.sessions]);
  const goal = state.settings.sessionsPerWeek || 3;
  const streak = weeklyStreak(state, goal);
  const consent = !!state.settings.healthConsentAt;
  const weight = [...state.weightEntries].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight;
  const close = () => {
    router.back();
  };
  const isRecord = (name: string) => {
    const flags = prs[name];
    return !!flags && isPR(flags);
  };
  const sets = session?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <CloseButton onPress={close} /> }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={ZoomIn.duration(320)} style={styles.badge}>
          <Icon sf="checkmark" md="check" color={color.bg.surface} size={32} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(260)} style={styles.group}>
          <Text variant="title1" align="center" accessibilityRole="header">
            {t('sport.doneTitle')}
          </Text>
          <Text tone="secondary" align="center">
            {t('sport.doneSummary', {
              count: sets,
              minutes: Math.max(1, Math.round((session?.durationSec ?? 0) / 60)),
            })}
          </Text>
          <Text tone="secondary" align="center">
            {t('sport.weekCount', { done: streak.thisWeek.sessions, goal })}
          </Text>
          {consent ? (
            <Text variant="footnote" tone="secondary" align="center">
              {t('sport.kcalBurnt', { kcal: sessionKcal(session?.durationSec, weight) })} ·{' '}
              {t('common.estimate')}
            </Text>
          ) : null}
        </Animated.View>
        {session ? (
          <Card>
            {countPRs(prs) ? (
              <Text variant="headline" tone="success">
                {t('sport.recordsBeaten', { count: countPRs(prs) })}
              </Text>
            ) : null}
            {session.exercises.map((e) => (
              <View key={e.name} style={styles.line}>
                <View style={styles.flex}>
                  <Text>{exerciseLabel(e.name, i18n.language)}</Text>
                  <Text variant="footnote" tone="secondary" numeric>
                    {summarizeSets(e.sets)}
                  </Text>
                </View>
                {isRecord(e.name) ? (
                  <Text variant="footnote" tone="success">
                    {t('sport.record')}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}
        <Button label={t('sport.close')} onPress={close} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[4], alignItems: 'stretch' },
  badge: {
    alignSelf: 'center',
    width: size.touchMin * 2,
    height: size.touchMin * 2,
    borderRadius: radius.pill,
    backgroundColor: color.success.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { gap: space[2] },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1 },
});
