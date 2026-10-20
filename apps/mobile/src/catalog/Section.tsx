import { layout } from '@workspace/tokens';
import { Text } from '@workspace/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title2" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ section: { gap: layout.gapCards } });
