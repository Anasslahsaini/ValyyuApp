import { color, space } from '@workspace/tokens';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type SheetProps = { visible: boolean; onClose: () => void; title: string; children: ReactNode };

function CloseIcon() {
  return (
    <View importantForAccessibility="no-hide-descendants" style={styles.icon}>
      <View style={[styles.bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

/** Native page sheet with a visible Close button (dragging alone is not enough for VoiceOver). */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.title}>
            <Text variant="title2" accessibilityRole="header">
              {title}
            </Text>
          </View>
          <IconButton accessibilityLabel={t('common.close')} onPress={onClose} icon={<CloseIcon />} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[4],
  },
  title: { flex: 1 },
  content: { padding: space[4], gap: space[3] },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', width: 18, height: 2, borderRadius: 1, backgroundColor: color.ink.primary },
});
