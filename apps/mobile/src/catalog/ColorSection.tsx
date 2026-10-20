import { color, CONTRAST_PAIRS, contrastRatio, radius, space } from '@workspace/tokens';
import { Text } from '@workspace/ui';
import { StyleSheet, View } from 'react-native';
import { flattenColors, formatRatio } from './format';
import { Section } from './Section';

export function ColorSection() {
  return (
    <>
      <Section title="Couleurs">
        {flattenColors(color).map(([name, hex]) => (
          <View key={name} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: hex }]} />
            <View style={styles.texts}>
              <Text variant="subhead">{name}</Text>
              <Text variant="footnote" tone="secondary">
                {hex}
              </Text>
            </View>
          </View>
        ))}
      </Section>
      <Section title="Contrastes">
        {CONTRAST_PAIRS.map((pair) => (
          <View
            key={pair.usage}
            testID={`pair-${pair.usage}`}
            style={[styles.pair, { backgroundColor: pair.bg }]}
          >
            <Text color={pair.fg}>{pair.usage}</Text>
            <Text color={pair.fg} numeric>
              {formatRatio(contrastRatio(pair.fg, pair.bg))}
            </Text>
          </View>
        ))}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.field,
  },
  texts: { flex: 1 },
  pair: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.field,
  },
});
