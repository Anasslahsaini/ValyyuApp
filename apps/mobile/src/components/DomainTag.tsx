import { color, radius, space, type Domain } from '@workspace/tokens';
import { tKey } from '@workspace/i18n';
import { Text } from '@workspace/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Icon } from './Icon';

const META: Record<Domain, { label: string; sf: string; md: string }> = {
  today: { label: tKey('tabs.today'), sf: 'sun.max', md: 'wb-sunny' },
  repas: { label: tKey('tabs.repas'), sf: 'fork.knife', md: 'restaurant' },
  sport: { label: tKey('tabs.sport'), sf: 'dumbbell', md: 'fitness-center' },
  style: { label: tKey('tabs.style'), sf: 'tshirt', md: 'checkroom' },
};

/** Domain label: icon + word, never a color dot alone. Not touchable. */
export function DomainTag({ domain }: { domain: Domain }) {
  const { t } = useTranslation();
  const m = META[domain];
  return (
    <View style={[styles.tag, { backgroundColor: color.domain[domain].bg }]}>
      <Icon sf={m.sf as never} md={m.md as never} color={color.domain[domain].fg} size={16} />
      <Text variant="subhead" color={color.domain[domain].fg}>
        {t(m.label)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
});
