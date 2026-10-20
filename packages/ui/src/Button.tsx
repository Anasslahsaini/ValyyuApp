import { color, radius, size, space } from '@workspace/tokens';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';

export type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'decision' | 'destructive';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  testID?: string;
};

const kinds: Record<ButtonKind, { container: ViewStyle; pressed: ViewStyle; label: string }> = {
  primary: {
    container: { backgroundColor: color.ink.primary },
    pressed: { opacity: 0.85 },
    label: color.bg.surface,
  },
  secondary: {
    container: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.field },
    pressed: { backgroundColor: color.bg.sunken },
    label: color.ink.primary,
  },
  tertiary: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: color.bg.sunken },
    label: color.ink.primary,
  },
  decision: {
    container: { backgroundColor: color.accent.lime },
    pressed: { backgroundColor: color.accent.limePressed },
    label: color.ink.primary,
  },
  destructive: {
    container: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.danger.fg },
    pressed: { backgroundColor: color.danger.bg },
    label: color.danger.fg,
  },
};

/** One primary (ink) button per screen; lime "decision" only for OK on a ready decision. */
export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
  loading = false,
  icon,
  testID,
}: ButtonProps) {
  const k = kinds[kind];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      {...(testID ? { testID } : {})}
      style={({ pressed }) => [styles.base, k.container, pressed && k.pressed, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={k.label} />
      ) : icon ? (
        <View importantForAccessibility="no">{icon}</View>
      ) : null}
      <View style={styles.label} {...(testID ? { testID: `${testID}-label` } : {})}>
        <Text variant="headline" color={k.label} align="center">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.buttonHeight,
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  label: { flexShrink: 1 },
  disabled: { opacity: 0.4 },
});
