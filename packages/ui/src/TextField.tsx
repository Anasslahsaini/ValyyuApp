import { color, radius, size, space } from '@workspace/tokens';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, TextInput, View } from 'react-native';
import { Text, textStyle } from './Text';

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  help?: string;
  /** Unit shown as text at the end of the field (e.g. "cm"). */
  unit?: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad';
  textContentType?: 'emailAddress' | 'oneTimeCode' | 'none';
  disabled?: boolean;
  testID?: string;
};

/** Label always visible above the field; errors are shown and read aloud. */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  help,
  unit,
  keyboardType = 'default',
  textContentType = 'none',
  disabled = false,
  testID,
}: TextFieldProps) {
  const previousErrorRef = useRef(error);
  useEffect(() => {
    // accessibilityLiveRegion only works on Android: announce new errors explicitly for VoiceOver.
    if (error && error !== previousErrorRef.current) AccessibilityInfo.announceForAccessibility(error);
    previousErrorRef.current = error;
  }, [error]);
  return (
    <View style={styles.wrapper}>
      <Text variant="subhead" tone="secondary" hiddenFromScreenReaders>
        {label}
      </Text>
      <View style={[styles.field, error ? styles.fieldError : null, disabled && styles.disabled]}>
        <TextInput
          accessibilityLabel={label}
          {...(error ? { accessibilityHint: error } : help ? { accessibilityHint: help } : {})}
          accessibilityState={{ disabled }}
          editable={!disabled}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          textContentType={textContentType}
          allowFontScaling
          {...(testID ? { testID } : {})}
          style={[textStyle('body'), styles.input]}
        />
        {unit ? <Text tone="secondary">{unit}</Text> : null}
      </View>
      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text variant="footnote" tone="danger">
            {error}
          </Text>
        </View>
      ) : help ? (
        <Text variant="footnote" tone="secondary">
          {help}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space[2] },
  field: {
    minHeight: size.touchMin + space[1],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: color.border.field,
    backgroundColor: color.bg.surface,
  },
  fieldError: { borderColor: color.danger.fg, borderWidth: 2 },
  input: { flex: 1, color: color.ink.primary, paddingVertical: space[3] },
  disabled: { opacity: 0.4 },
});
