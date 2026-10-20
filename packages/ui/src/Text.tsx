import { color, fontFamily, type, type TypeToken } from '@workspace/tokens';
import type { ReactNode } from 'react';
import { Platform, Text as RNText, type TextStyle } from 'react-native';

export type TextTone = 'primary' | 'secondary' | 'danger' | 'success';

export type TextProps = {
  variant?: TypeToken;
  tone?: TextTone;
  /** Tabular figures, so numbers line up. */
  numeric?: boolean;
  /** Overrides the tone with a design-system color (e.g. a button label). */
  color?: string;
  accessibilityRole?: 'header' | 'text';
  align?: 'auto' | 'center';
  /** Hide from screen readers when another element already speaks this text. */
  hiddenFromScreenReaders?: boolean;
  /** Struck through (a ticked grocery line); the checked state is also given in words or by role. */
  strike?: boolean;
  children: ReactNode;
};

const toneColor: Record<TextTone, string> = {
  primary: color.ink.primary,
  secondary: color.ink.secondary,
  danger: color.danger.fg,
  success: color.success.fg,
};

export function textStyle(variant: TypeToken): TextStyle {
  const t = type[variant];
  const metrics =
    Platform.OS === 'android'
      ? { fontSize: t.android.size, lineHeight: t.android.lineHeight }
      : { fontSize: t.ios.size, lineHeight: t.ios.lineHeight };
  return t.family === 'display'
    ? { ...metrics, fontFamily: fontFamily.display }
    : { ...metrics, fontWeight: t.ios.weight };
}

/** Text that always follows the user's text size setting. */
export function Text({
  variant = 'body',
  tone = 'primary',
  numeric = false,
  color: override,
  accessibilityRole,
  align = 'auto',
  hiddenFromScreenReaders = false,
  strike = false,
  children,
}: TextProps) {
  return (
    <RNText
      allowFontScaling
      {...(accessibilityRole ? { accessibilityRole } : {})}
      {...(hiddenFromScreenReaders
        ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : {})}
      style={[
        textStyle(variant),
        { color: override ?? toneColor[tone] },
        numeric && { fontVariant: ['tabular-nums'] },
        align === 'center' && { textAlign: 'center' },
        strike && { textDecorationLine: 'line-through' },
      ]}
    >
      {children}
    </RNText>
  );
}
