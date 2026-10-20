import { layout } from '@workspace/tokens';
import { ScrollView, StyleSheet } from 'react-native';
import { ColorSection } from '../../src/catalog/ColorSection';
import { ComponentSection } from '../../src/catalog/ComponentSection';
import { TypeSection } from '../../src/catalog/TypeSection';

/** Developer-only: every token and component of packages/ui, to check a design change at a glance. */
export default function Catalog() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <ComponentSection />
      <ColorSection />
      <TypeSection />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: layout.margin, gap: layout.gapSection } });
