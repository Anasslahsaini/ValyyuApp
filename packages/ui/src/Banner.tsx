import { color, radius, space } from '@workspace/tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

export type BannerProps = { tone: 'danger' | 'info'; title: string; message?: string; icon?: ReactNode };

/** Short message above the content (no connection, offline…). Read as one alert. */
export function Banner({ tone, title, message, icon }: BannerProps) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message ? `${title}. ${message}` : title}
      style={[styles.base, tone === 'danger' ? styles.danger : styles.info]}
    >
      {icon ? <View importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      <View style={styles.texts}>
        <Text variant="headline">{title}</Text>
        {message ? <Text variant="callout">{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.card },
  danger: { backgroundColor: color.danger.bg },
  info: { backgroundColor: color.bg.surface },
  texts: { flex: 1, gap: space[1] },
});
