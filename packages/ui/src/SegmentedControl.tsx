import { color, radius, size, space } from '@workspace/tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';

export type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** 2 to 4 choices. The chosen one gets a surface background and bold text (not color alone). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  if (options.length < 2 || options.length > 4) {
    throw new Error(`SegmentedControl needs 2 to 4 options, got ${String(options.length)}`);
  }
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(option.value);
            }}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text variant={selected ? 'headline' : 'body'} tone={selected ? 'primary' : 'secondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: space[1],
    gap: space[1],
    borderRadius: radius.field,
    backgroundColor: color.bg.sunken,
  },
  segment: {
    flexGrow: 1,
    minHeight: size.touchMin,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.field - space[1],
  },
  selected: { backgroundColor: color.bg.surface },
});
