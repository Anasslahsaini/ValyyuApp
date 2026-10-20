import { color, space } from '@workspace/tokens';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';

export type ListRowProps = {
  title: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  /** Opens the phone's Settings or another app. */
  external?: boolean;
  testID?: string;
};

function Chevron() {
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.chevron, I18nManager.isRTL && styles.chevronRtl]}
    />
  );
}

/** Settings-style row; grows with large text (value moves under the title when needed). */
export function ListRow({
  title,
  value,
  onPress,
  destructive = false,
  external = false,
  testID,
}: ListRowProps) {
  const { t } = useTranslation();
  const content = (
    <>
      <View style={styles.texts}>
        <Text tone={destructive ? 'danger' : 'primary'}>{title}</Text>
        {value ? <Text tone="secondary">{value}</Text> : null}
      </View>
      {onPress && !destructive ? <Chevron /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View {...(testID ? { testID } : {})} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      {...(external ? { accessibilityHint: t('a11y.opensSettings') } : {})}
      onPress={onPress}
      {...(testID ? { testID } : {})}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: color.bg.surface,
  },
  pressed: { backgroundColor: color.bg.sunken },
  texts: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  chevron: {
    width: 9,
    height: 9,
    borderTopWidth: 2,
    borderEndWidth: 2,
    borderColor: color.ink.secondary,
    transform: [{ rotate: '45deg' }],
  },
  chevronRtl: { transform: [{ rotate: '-135deg' }] },
});
