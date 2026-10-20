import { useUser } from '@clerk/expo';
import { color, layout, radius, space } from '@workspace/tokens';
import { Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon } from '../../src/components/Icon';

/** O0 · Voix ou questions. Voice needs the server (next lots): the card says so and stays inactive. */
export default function Start() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useUser();
  const name = user?.firstName ?? '';
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(280)} style={styles.head}>
        <Text variant="largeTitle" accessibilityRole="header">
          {name ? t('onboarding.start.titleNamed', { name }) : t('onboarding.start.title')}
        </Text>
        <Text tone="secondary">{t('onboarding.start.subtitle')}</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(80).duration(280)}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={`${t('onboarding.start.voiceTitle')}. ${t('onboarding.start.voiceSoon')}`}
          style={styles.voice}
        >
          <View style={styles.mic}>
            <Icon sf="mic.fill" md="mic" color={color.ink.primary} />
          </View>
          <Text variant="title2" color={color.bg.surface}>
            {t('onboarding.start.voiceTitle')}
          </Text>
          <Text variant="callout" color={color.bg.surface}>
            {t('onboarding.start.voiceExample')}
          </Text>
          <Text variant="footnote" color={color.accent.lime}>
            {t('onboarding.start.voiceSoon')}
          </Text>
        </View>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(140).duration(280)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('onboarding.start.questions')}. ${t('onboarding.start.questionsHint')}`}
          onPress={() => {
            router.push('/you');
          }}
          style={({ pressed }) => [styles.questions, pressed && styles.pressed]}
          testID="onboarding-questions"
        >
          <View style={styles.flex}>
            <Text variant="headline">{t('onboarding.start.questions')}</Text>
            <Text variant="footnote" tone="secondary">
              {t('onboarding.start.questionsHint')}
            </Text>
          </View>
          <Icon sf="chevron.forward" md="chevron-right" color={color.ink.secondary} size={20} />
        </Pressable>
      </Animated.View>
      <Text variant="footnote" tone="secondary">
        {t('onboarding.start.note')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, paddingTop: space[12] + space[8], gap: space[5] },
  head: { gap: space[2] },
  flex: { flex: 1, gap: space[1] },
  voice: { backgroundColor: color.ink.primary, borderRadius: radius.card, padding: space[5], gap: space[3] },
  mic: {
    width: space[12] + space[2],
    height: space[12] + space[2],
    borderRadius: radius.pill,
    backgroundColor: color.accent.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questions: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border.field,
    backgroundColor: color.bg.surface,
  },
  pressed: { backgroundColor: color.bg.sunken },
});
