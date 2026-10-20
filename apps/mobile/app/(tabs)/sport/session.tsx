import { findCatalogueExercise } from '@workspace/domain/exercises';
import { exerciseLabel } from '@workspace/domain/training/exercise-names';
import { finishSession, startSession } from '@workspace/domain/training/session-start';
import type { Session } from '@workspace/domain/training/types';
import { color, layout, radius, size, space } from '@workspace/tokens';
import { Banner, Button, Card, IconButton, Text, textStyle } from '@workspace/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DomainTag } from '../../../src/components/DomainTag';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { useRun } from '../../../src/data/useRun';
import { CloseButton } from '../../../src/navigation/CloseButton';
import { useTodayWorkout } from '../../../src/sport/useTodayWorkout';

const clock = (sec: number) => `${String(Math.floor(sec / 60))}:${String(sec % 60).padStart(2, '0')}`;
const toInt = (v: string, max: number) =>
  Math.min(max, Math.max(0, Math.round(Number(v.replace(',', '.')) || 0)));
const toKg = (v: string) =>
  Math.min(500, Math.max(0, Math.round((Number(v.replace(',', '.')) || 0) * 4) / 4));

/** The session runner: each set prefilled, tick it when done (rest timer starts), Terminer saves what was done. */
export default function SessionScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ variant?: string; minutes?: string }>();
  const { state, save } = useLife();
  const { workout, settings } = useTodayWorkout(
    Number(params.variant ?? 0),
    params.minutes ? Number(params.minutes) : undefined,
  );
  const [session, setSession] = useState<Session>(() => startSession(workout, state.sessions, settings));
  const [rest, setRest] = useState<{ until: number; remaining: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { busy, failed, run } = useRun<'finish'>();
  const [nothingDone, setNothingDone] = useState(false);
  const lang = i18n.language;

  useEffect(() => {
    if (!rest) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((rest.until - Date.now()) / 1000));
      if (remaining === 0) setRest(null);
      else setRest({ until: rest.until, remaining });
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [rest]);

  const updateSet = (
    ei: number,
    si: number,
    patch: Partial<Session['exercises'][number]['sets'][number]>,
  ) => {
    setSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e, i) =>
        i === ei ? { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...patch } : x)) } : e,
      ),
    }));
  };
  const toggle = (ei: number, si: number) => {
    const setEntry = session.exercises[ei]?.sets[si];
    if (!setEntry) return;
    updateSet(ei, si, { completed: !setEntry.completed });
    setNothingDone(false);
    if (!setEntry.completed) {
      const seconds = session.exercises[ei]?.restSeconds ?? 90;
      setRest({ until: Date.now() + seconds * 1000, remaining: seconds });
    }
  };
  const addSet = (ei: number) => {
    setSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e, i) => {
        const last = e.sets.at(-1);
        return i === ei && e.sets.length < 20
          ? {
              ...e,
              sets: [...e.sets, { reps: last?.reps ?? 10, weight: last?.weight ?? 0, completed: false }],
            }
          : e;
      }),
    }));
  };

  const finish = () => {
    const done = finishSession(session);
    if (!done) {
      setNothingDone(true);
      return;
    }
    void run('finish', async () => {
      await save('sessions', done);
      router.replace({ pathname: '/sport/done', params: { id: done.id } });
    });
  };
  const quit = () => {
    if (!session.exercises.some((e) => e.sets.some((x) => x.completed))) {
      router.back();
      return;
    }
    Alert.alert(t('sport.quitTitle'), t('sport.quitBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sport.quit'),
        style: 'destructive',
        onPress: () => {
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{ title: session.workoutName, headerRight: () => <CloseButton onPress={quit} /> }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[12] * 2 }]}
      >
        {session.exercises.map((e, ei) => {
          const info = findCatalogueExercise(e.name);
          const name = exerciseLabel(e.name, lang);
          return (
            <Animated.View key={`${e.name}-${String(ei)}`} entering={FadeInDown.delay(ei * 50).duration(240)}>
              <Card>
                <View style={styles.head}>
                  <DomainTag domain="sport" />
                  <Text variant="footnote" tone="secondary">
                    {t('sport.restFor', { time: clock(e.restSeconds ?? 90) })}
                  </Text>
                </View>
                <Text variant="title2" accessibilityRole="header">
                  {name}
                </Text>
                {info?.instructions.length ? (
                  <Button
                    kind="tertiary"
                    label={open === e.name ? t('sport.hideHow') : t('sport.how')}
                    onPress={() => {
                      setOpen(open === e.name ? null : e.name);
                    }}
                  />
                ) : null}
                {open === e.name && info ? (
                  <Animated.View entering={FadeIn} style={styles.how}>
                    {info.instructions.map((line, i) => (
                      <Text key={String(i)} variant="callout" tone="secondary">
                        {line}
                      </Text>
                    ))}
                  </Animated.View>
                ) : null}
                <View
                  style={styles.setHeader}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text variant="caption" tone="secondary">
                    {t('sport.set')}
                  </Text>
                  <View style={styles.flex} />
                  <Text variant="caption" tone="secondary">
                    {t('sport.repsLabel')}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {t('sport.kgLabel')}
                  </Text>
                  <View style={styles.checkSpace} />
                </View>
                {e.sets.map((x, si) => (
                  <View key={String(si)} style={[styles.set, x.completed && styles.setDone]}>
                    <Text variant="headline" numeric>
                      {String(si + 1)}
                    </Text>
                    <View style={styles.flex} />
                    <TextInput
                      accessibilityLabel={t('sport.repsOf', { set: si + 1, name })}
                      value={String(x.reps)}
                      onChangeText={(v) => {
                        updateSet(ei, si, { reps: toInt(v, 100) });
                      }}
                      keyboardType="number-pad"
                      style={styles.input}
                      allowFontScaling
                    />
                    <TextInput
                      accessibilityLabel={t('sport.kgOf', { set: si + 1, name })}
                      value={String(x.weight)}
                      onChangeText={(v) => {
                        updateSet(ei, si, { weight: toKg(v) });
                      }}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      allowFontScaling
                    />
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: x.completed }}
                      accessibilityLabel={t('sport.setDone', { set: si + 1, name })}
                      onPress={() => {
                        toggle(ei, si);
                      }}
                      style={[styles.check, x.completed && styles.checkOn]}
                      testID={`set-${String(ei)}-${String(si)}`}
                    >
                      <Icon
                        sf="checkmark"
                        md="check"
                        color={x.completed ? color.bg.surface : color.ink.secondary}
                        size={20}
                      />
                    </Pressable>
                  </View>
                ))}
                <Button
                  kind="tertiary"
                  label={t('sport.addSet')}
                  onPress={() => {
                    addSet(ei);
                  }}
                />
              </Card>
            </Animated.View>
          );
        })}
        {nothingDone ? <Banner tone="info" title={t('sport.nothingDone')} /> : null}
        {failed ? <Banner tone="danger" title={t('today.saveFailed')} /> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space[3] }]}>
        {rest ? (
          <Animated.View entering={FadeIn} style={styles.rest} accessibilityLiveRegion="polite">
            <Icon sf="timer" md="timer" color={color.ink.primary} size={20} />
            <View style={styles.flex}>
              <Text variant="headline" numeric>
                {t('sport.restLeft', { time: clock(rest.remaining) })}
              </Text>
            </View>
            <IconButton
              accessibilityLabel={t('sport.skipRest')}
              onPress={() => {
                setRest(null);
              }}
              icon={<Icon sf="forward.end.fill" md="skip-next" color={color.ink.primary} size={20} />}
            />
          </Animated.View>
        ) : null}
        <Button
          label={t('sport.finish')}
          onPress={finish}
          loading={busy === 'finish'}
          testID="sport-finish"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[3] },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  how: { gap: space[2] },
  flex: { flex: 1 },
  setHeader: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[2] },
  checkSpace: { width: size.touchMin },
  set: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.field,
  },
  setDone: { backgroundColor: color.domain.sport.bg },
  input: {
    minWidth: space[12] + space[4],
    minHeight: size.touchMin,
    borderWidth: 1,
    borderColor: color.border.field,
    borderRadius: radius.sm,
    backgroundColor: color.bg.surface,
    color: color.ink.primary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    ...textStyle('body'),
  },
  check: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.border.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: color.domain.sport.fg, borderColor: color.domain.sport.fg },
  footer: {
    paddingHorizontal: layout.margin,
    paddingTop: space[3],
    gap: space[3],
    backgroundColor: color.bg.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.hairline,
  },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: color.domain.sport.bg,
    borderRadius: radius.field,
    paddingStart: space[4],
  },
});
