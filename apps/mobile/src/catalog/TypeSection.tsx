import { radius, space, type, type TypeToken } from '@workspace/tokens';
import { Text } from '@workspace/ui';
import { StyleSheet, View } from 'react-native';
import { color } from '@workspace/tokens';
import { Section } from './Section';

export function TypeSection() {
  return (
    <>
      <Section title="Typographie">
        {(Object.keys(type) as TypeToken[]).map((name) => (
          <View key={name} testID={`type-${name}`}>
            <Text variant={name}>{`type.${name}`}</Text>
            <Text
              variant="footnote"
              tone="secondary"
            >{`${String(type[name].ios.size)} / ${String(type[name].ios.lineHeight)} pt`}</Text>
          </View>
        ))}
        <Text numeric>1 950 kcal · 12,5 kg</Text>
      </Section>
      <Section title="Espacements">
        {Object.entries(space).map(([name, value]) => (
          <View key={name} style={styles.row}>
            <Text variant="subhead">{`space.${name}`}</Text>
            <View style={[styles.bar, { width: value }]} />
          </View>
        ))}
      </Section>
      <Section title="Rayons">
        {Object.entries(radius).map(([name, value]) => (
          <View key={name} style={styles.row}>
            <Text variant="subhead">{`radius.${name}`}</Text>
            <View style={[styles.box, { borderRadius: Math.min(value, 22) }]} />
          </View>
        ))}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  bar: { height: 12, backgroundColor: color.ink.primary },
  box: {
    width: 44,
    height: 44,
    backgroundColor: color.bg.sunken,
    borderWidth: 1,
    borderColor: color.border.field,
  },
});
