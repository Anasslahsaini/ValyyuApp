import type { WardrobeItem } from '@workspace/domain/life';
import { swatchFor } from '@workspace/domain/constants/swatches';
import { color, radius, space } from '@workspace/tokens';
import { Text } from '@workspace/ui';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/** A piece: its photo, or its color as a swatch, with the name under it. */
export function PieceTile({
  item,
  label,
  onPress,
  badge,
}: {
  item: WardrobeItem;
  /** Spoken name of the action, e.g. "Changer le haut : T-shirt blanc". */
  label: string;
  onPress?: () => void;
  badge?: string;
}) {
  const swatch = item.colorHex ?? swatchFor(item.color) ?? color.bg.sunken;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={label}
      {...(onPress ? { onPress } : {})}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Animated.View key={item.id} entering={FadeIn.duration(220)} style={styles.photo}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.image} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.image, { backgroundColor: swatch }]} />
        )}
      </Animated.View>
      <Text variant="footnote" hiddenFromScreenReaders>
        {item.name}
      </Text>
      {badge ? (
        <Text variant="caption" tone="secondary" hiddenFromScreenReaders>
          {badge}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flexBasis: '28%', flexGrow: 1, gap: space[1], minWidth: 0 },
  pressed: { opacity: 0.7 },
  photo: {
    aspectRatio: 3 / 4,
    borderRadius: radius.field,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.hairline,
  },
  image: { width: '100%', height: '100%' },
});
