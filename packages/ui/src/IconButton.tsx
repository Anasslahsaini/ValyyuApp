import { color, radius, size } from '@workspace/tokens';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

export type IconButtonProps = {
  /** Spoken name: the full action ("Ajouter un repas"), never the icon ("plus"). Required. */
  accessibilityLabel: string;
  onPress: () => void;
  icon: ReactNode;
  /** Filled variant: only for "+" in the top bar. */
  filled?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function IconButton({
  accessibilityLabel,
  onPress,
  icon,
  filled = false,
  disabled = false,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...(testID ? { testID } : {})}
      style={({ pressed }) => [
        styles.base,
        filled && styles.filled,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: size.touchMin,
    minHeight: size.touchMin,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: color.ink.primary },
  pressed: { backgroundColor: color.bg.sunken },
  disabled: { opacity: 0.4 },
});
