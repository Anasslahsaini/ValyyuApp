import { color, layout, space } from '@workspace/tokens';
import { Button, StepProgress, Text } from '@workspace/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const STEPS_TOTAL = 5;

type Props = {
  step?: number;
  total?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  primary: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  secondary?: ReactNode;
};

/** One first-launch step: progress, big title, content that scrolls, one primary button pinned at the bottom. */
export function StepScreen({
  step,
  total = STEPS_TOTAL,
  title,
  subtitle,
  children,
  primary,
  secondary,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {step ? (
          <StepProgress label={t('onboarding.step', { step, total })} step={step} total={total} />
        ) : null}
        <Animated.View entering={FadeInDown.duration(260)} style={styles.head}>
          <Text variant="largeTitle" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(60).duration(260)} style={styles.body}>
          {children}
        </Animated.View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <Button
          label={primary.label}
          onPress={primary.onPress}
          {...(primary.disabled !== undefined ? { disabled: primary.disabled } : {})}
          {...(primary.loading !== undefined ? { loading: primary.loading } : {})}
          testID="step-primary"
        />
        {secondary}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.paper },
  content: { padding: layout.margin, gap: space[5] },
  head: { gap: space[2] },
  body: { gap: space[4] },
  footer: {
    paddingHorizontal: layout.margin,
    paddingTop: space[3],
    gap: space[2],
    backgroundColor: color.bg.paper,
  },
});
