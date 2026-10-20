import { finishFirstLaunch, planSummary } from '@workspace/domain/first-launch/finish';
import { color, layout, radius, size, space } from '@workspace/tokens';
import { Banner, Button, Card, Text } from '@workspace/ui';
import { getLocales } from 'expo-localization';
import { useEffect, useMemo, useState } from 'react';
import { tKey } from '@workspace/i18n';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { useLife } from '../../src/data/LifeProvider';
import { useDraft } from '../../src/first-launch/DraftProvider';
import { DIET_CHOICES } from '../../src/first-launch/options';

const PREP_STEPS = [
  tKey('onboarding.plan.prepNeeds'),
  tKey('onboarding.plan.prepMeals'),
  tKey('onboarding.plan.prepSessions'),
  tKey('onboarding.plan.prepGroceries'),
] as const;

/** O6 · On prépare ton plan, O6b · erreur, O7 · Ton plan est prêt (calories / sans consentement / mineur). */
export default function Plan() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { state, updateSettings } = useLife();
  const { draft, consent } = useDraft();
  const [done, setDone] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const patch = useMemo(() => {
    const currency = getLocales().at(0)?.currencyCode;
    return finishFirstLaunch(draft, consent, state.settings, currency ? { deviceCurrency: currency } : {});
  }, [draft, consent, state.settings]);
  const summary = planSummary(draft, consent, patch.calorieTarget);

  useEffect(() => {
    if (done >= PREP_STEPS.length) return;
    const timer = setTimeout(() => {
      setDone((d) => d + 1);
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [done]);

  const start = () => {
    setSaving(true);
    setFailed(false);
    updateSettings(patch).catch(() => {
      setFailed(true);
      setSaving(false);
    });
  };

  if (done < PREP_STEPS.length) {
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <Text variant="title1" accessibilityRole="header">
          {t('onboarding.plan.preparing')}
        </Text>
        {PREP_STEPS.map((key, i) => (
          <Animated.View key={key} entering={FadeIn.delay(i * 80)} style={styles.prepRow}>
            <View style={[styles.dot, i < done && styles.dotDone]}>
              {i < done ? (
                <Icon sf="checkmark" md="check" color={color.bg.surface} size={16} />
              ) : i === done ? (
                <ActivityIndicator size="small" />
              ) : null}
            </View>
            <Text tone={i <= done ? 'primary' : 'secondary'}>{t(key)}</Text>
          </Animated.View>
        ))}
      </View>
    );
  }

  const name = draft.firstName?.trim() ?? '';
  const dietLabel = [
    ...(draft.diet ?? [])
      .map((d) => DIET_CHOICES.find((c) => c.value === d)?.label)
      .filter((x): x is string => !!x)
      .map((k) => t(k).toLowerCase()),
    ...(draft.noPork ? [t('onboarding.meals.noPork').toLowerCase()] : []),
  ].join(', ');
  const sessions = patch.sessionsPerWeek ?? draft.sessionsPerWeek ?? 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space[10] }]}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text variant="largeTitle" accessibilityRole="header">
            {t('onboarding.plan.ready', { name })}
          </Text>
        </Animated.View>
        {failed ? <Banner tone="danger" title={t('onboarding.plan.saveFailed')} /> : null}
        <Animated.View entering={ZoomIn.delay(80).duration(320)} style={styles.card}>
          <PlanLine
            icon={{ sf: 'fork.knife', md: 'restaurant' }}
            title={
              summary.kind === 'calories'
                ? t('onboarding.plan.calories', { kcal: summary.calories.toLocaleString('fr-FR') })
                : summary.kind === 'minor'
                  ? t('onboarding.plan.mealsMinor')
                  : t('onboarding.plan.mealsBalanced')
            }
            body={
              summary.kind === 'minor'
                ? t('onboarding.plan.nothingToCount')
                : t(`onboarding.goal.${patch.mainGoal ?? 'maintain'}`)
            }
          />
          <PlanLine
            icon={{ sf: 'dumbbell', md: 'fitness_center' }}
            title={
              sessions ? t('onboarding.plan.sessions', { count: sessions }) : t('onboarding.plan.noSport')
            }
            body={t(`onboarding.sport.${draft.trainingPlace ?? 'home'}`)}
          />
          <PlanLine
            icon={{ sf: 'cart', md: 'shopping_cart' }}
            title={
              draft.weeklyBudget
                ? t('onboarding.plan.budget', { amount: draft.weeklyBudget })
                : t('onboarding.plan.budgetFree')
            }
            body={[t('onboarding.plan.people', { count: draft.people ?? 1 }), dietLabel]
              .filter(Boolean)
              .join(', ')}
            last
          />
        </Animated.View>
        {summary.kind === 'calories' ? (
          <Text variant="footnote" tone="secondary">
            {t('onboarding.plan.estimateNote')}
          </Text>
        ) : summary.kind === 'minor' ? (
          <Text variant="footnote" tone="secondary">
            {t('onboarding.plan.minorNote')}
          </Text>
        ) : (
          <Card>
            <Text>{t('onboarding.plan.noConsentNote')}</Text>
          </Card>
        )}
        <Text>{t('onboarding.plan.firstDay')}</Text>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <Button label={t('onboarding.plan.go')} onPress={start} loading={saving} testID="plan-go" />
      </View>
    </View>
  );
}

function PlanLine({
  icon,
  title,
  body,
  last = false,
}: {
  icon: { sf: string; md: string };
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${body}`}
      style={[styles.line, !last && styles.lineBorder]}
    >
      <View style={styles.lineIcon}>
        <Icon sf={icon.sf as never} md={icon.md as never} color={color.ink.primary} size={20} />
      </View>
      <View style={styles.flex}>
        <Text variant="headline" color={color.bg.surface}>
          {title}
        </Text>
        <Text variant="footnote" color={color.bg.sunken}>
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.paper },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: layout.margin,
    gap: space[5],
    backgroundColor: color.bg.paper,
  },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dot: {
    width: space[8],
    height: space[8],
    borderRadius: radius.pill,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: color.border.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: color.ink.primary, borderStyle: 'solid', borderColor: color.ink.primary },
  content: { padding: layout.margin, gap: space[5] },
  card: { backgroundColor: color.ink.primary, borderRadius: radius.card, paddingHorizontal: space[5] },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[4] },
  lineBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ink.secondary },
  lineIcon: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.pill,
    backgroundColor: color.accent.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: space[1] },
  footer: { paddingHorizontal: layout.margin, paddingTop: space[3], backgroundColor: color.bg.paper },
});
