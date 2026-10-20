import { color, elevation, radius, space } from '@workspace/tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export type CardProps = {
  children: ReactNode;
  elevated?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** Flat card with a hairline by default; `elevated` for the highlighted "decision" card. */
export function Card({ children, elevated = false, accessibilityLabel, testID }: CardProps) {
  return (
    <View
      {...(accessibilityLabel ? { accessible: true, accessibilityLabel } : {})}
      {...(testID ? { testID } : {})}
      style={[styles.base, elevated ? elevation[1] : styles.flat]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: color.bg.surface, borderRadius: radius.card, padding: space[4], gap: space[3] },
  flat: { borderWidth: StyleSheet.hairlineWidth, borderColor: color.border.hairline },
});
