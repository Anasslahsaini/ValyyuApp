import { app } from '@workspace/config';
import { color, radius, space } from '@workspace/tokens';
import { Text } from '@workspace/ui';
import { StyleSheet, View } from 'react-native';

const MARK = 'yy';

/** "yy" mark + lowercase name. Spoken once as the app name. */
export function Logo() {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={app.name} style={styles.row}>
      <View style={styles.mark}>
        <Text variant="headline" color={color.ink.primary}>
          {MARK}
        </Text>
      </View>
      <Text variant="title2">{app.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.field,
    backgroundColor: color.accent.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
