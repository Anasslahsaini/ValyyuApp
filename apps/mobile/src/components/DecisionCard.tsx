import type { Domain } from '@workspace/tokens';
import { color, elevation, layout, radius, space } from '@workspace/tokens';
import { Button, Text } from '@workspace/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { DomainTag } from './DomainTag';
import { Icon } from './Icon';

type Props = {
  domain: Exclude<Domain, 'today'>;
  meta?: string;
  title: string;
  note?: string;
  done?: string | null;
  onChange?: () => void;
  onOk?: () => void;
  changing?: boolean;
  index?: number;
  /** Optional link under the title, e.g. "Voir la recette". */
  details?: { label: string; onPress: () => void };
};

/** Design "carte décision": domain tag, what is decided, Changer / OK (OK at the end, lime). */
export function DecisionCard({
  domain,
  meta,
  title,
  note,
  done,
  onChange,
  onOk,
  changing = false,
  index = 0,
  details,
}: Props) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(280)}
      layout={LinearTransition}
      style={styles.card}
    >
      <View style={styles.top}>
        <DomainTag domain={domain} />
        {meta ? (
          <Text variant="footnote" tone="secondary">
            {meta}
          </Text>
        ) : null}
      </View>
      <Text variant="title2">{title}</Text>
      {note ? (
        <Text variant="footnote" tone="secondary">
          {note}
        </Text>
      ) : null}
      {details ? (
        <View style={styles.details}>
          <Button kind="tertiary" label={details.label} onPress={details.onPress} />
        </View>
      ) : null}
      {done ? (
        <View style={styles.done}>
          <Icon sf="checkmark" md="check" color={color.success.fg} size={18} />
          <Text variant="headline" tone="success">
            {done}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          {onChange ? (
            <View style={styles.flex}>
              <Button kind="secondary" label={t('today.change')} onPress={onChange} loading={changing} />
            </View>
          ) : null}
          {onOk ? (
            <View style={styles.flex}>
              <Button kind="decision" label={t('today.ok')} onPress={onOk} />
            </View>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bg.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
    ...elevation[1],
    marginBottom: layout.gapCards,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    flexWrap: 'wrap',
  },
  actions: { flexDirection: 'row', gap: space[3], flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 140 },
  done: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  details: { alignItems: 'flex-start' },
});
