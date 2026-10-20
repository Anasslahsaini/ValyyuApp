import { color, radius, size, space } from '@workspace/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';

/** One option of a single-choice list (O3 "Ton but", O5 "Où ?"). */
export function ChoiceRow({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...(testID ? { testID } : {})}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
    >
      <View
        style={[styles.radio, selected && styles.radioOn]}
        importantForAccessibility="no-hide-descendants"
      >
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.flex}>
        <Text variant={selected ? 'headline' : 'body'}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Multi-choice pill (diet, allergies). Selected = border + check mark, never color alone. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      {selected ? (
        <View testID="chip-check" importantForAccessibility="no-hide-descendants" style={styles.check} />
      ) : null}
      <Text variant={selected ? 'headline' : 'callout'}>{label}</Text>
    </Pressable>
  );
}

/** Consent box: unchecked by default, label fully visible. */
export function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => {
        onChange(!checked);
      }}
      style={({ pressed }) => [styles.consent, checked && styles.rowSelected, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxOn]} importantForAccessibility="no-hide-descendants">
        {checked ? <View style={styles.boxTick} /> : null}
      </View>
      <View style={styles.flex}>
        <Text>{label}</Text>
      </View>
    </Pressable>
  );
}

/** "Étape 2 sur 5" with segments. */
export function StepProgress({ label, step, total }: { label: string; step: number; total: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: step }}
      style={styles.progress}
    >
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} testID="step-segment" style={[styles.segment, i < step && styles.segmentOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  row: {
    minHeight: size.touchMin + space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: color.border.hairline,
    backgroundColor: color.bg.surface,
  },
  rowSelected: { borderColor: color.ink.primary, borderWidth: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: color.border.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: color.ink.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.ink.primary },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: color.border.field,
    backgroundColor: color.bg.surface,
  },
  chipSelected: { borderColor: color.ink.primary, borderWidth: 2, backgroundColor: color.bg.sunken },
  check: {
    width: 10,
    height: 6,
    borderStartWidth: 2,
    borderBottomWidth: 2,
    borderColor: color.ink.primary,
    transform: [{ rotate: '-45deg' }],
    marginBottom: 3,
  },
  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border.field,
    backgroundColor: color.bg.surface,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: color.border.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: color.ink.primary, borderColor: color.ink.primary },
  boxTick: {
    width: 12,
    height: 7,
    borderStartWidth: 2,
    borderBottomWidth: 2,
    borderColor: color.bg.surface,
    transform: [{ rotate: '-45deg' }],
    marginBottom: 3,
  },
  progress: { gap: space[2] },
  segments: { flexDirection: 'row', gap: space[1] },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.bg.sunken },
  segmentOn: { backgroundColor: color.ink.primary },
});
