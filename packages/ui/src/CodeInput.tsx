import { color, radius, size, space } from '@workspace/tokens';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Text';

export type CodeInputProps = {
  label: string;
  value: string;
  onChangeText: (digits: string) => void;
  length?: number;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * One real input (so iOS can offer the code from Mail/Messages above the keyboard), drawn as one box per digit.
 */
export function CodeInput({
  label,
  value,
  onChangeText,
  length = 6,
  error,
  disabled = false,
  autoFocus = false,
}: CodeInputProps) {
  const previousErrorRef = useRef(error);
  useEffect(() => {
    if (error && error !== previousErrorRef.current) AccessibilityInfo.announceForAccessibility(error);
    previousErrorRef.current = error;
  }, [error]);

  return (
    <View style={styles.wrapper}>
      <Text variant="subhead" hiddenFromScreenReaders>
        {label}
      </Text>
      <View>
        <View
          style={styles.boxes}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {Array.from({ length }, (_, i) => (
            <View
              key={i}
              testID="code-box"
              style={[
                styles.box,
                i === value.length && !disabled && styles.current,
                error ? styles.error : null,
                disabled && styles.disabled,
              ]}
            >
              <Text variant="title2" numeric tone={disabled ? 'secondary' : 'primary'}>
                {value[i] ?? ''}
              </Text>
            </View>
          ))}
        </View>
        <TextInput
          accessibilityLabel={label}
          {...(error ? { accessibilityHint: error } : {})}
          accessibilityState={{ disabled }}
          editable={!disabled}
          value={value}
          onChangeText={(text) => {
            onChangeText(text.replace(/\D/g, '').slice(0, length));
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          autoFocus={autoFocus}
          caretHidden
          style={styles.input}
        />
      </View>
      {error ? (
        <Text variant="footnote" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space[2] },
  boxes: { flexDirection: 'row', gap: space[2] },
  box: {
    flex: 1,
    minHeight: size.touchMin + space[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: color.border.field,
    backgroundColor: color.bg.surface,
  },
  current: { borderWidth: 2, borderColor: color.ink.primary },
  error: { borderColor: color.danger.fg, borderWidth: 2 },
  disabled: { backgroundColor: color.bg.sunken, borderColor: color.bg.sunken },
  // The real input covers the boxes: taps focus it, the OS reads it, it stays invisible.
  input: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, opacity: 0.02, color: 'transparent' },
});
