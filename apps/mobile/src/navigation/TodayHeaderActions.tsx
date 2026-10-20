import { color } from '@workspace/tokens';
import { IconButton } from '@workspace/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Icon } from '../components/Icon';

export type TodayHeaderActionsProps = { community: boolean; onProfile: () => void; onCommunity: () => void };

export function TodayHeaderActions({ community, onProfile, onCommunity }: TodayHeaderActionsProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {community ? (
        <IconButton
          accessibilityLabel={t('a11y.community')}
          onPress={onCommunity}
          icon={<Icon sf="person.2" md="group" color={color.ink.primary} />}
        />
      ) : null}
      <IconButton
        accessibilityLabel={t('a11y.profile')}
        onPress={onProfile}
        icon={<Icon sf="person.crop.circle" md="account-circle" color={color.ink.primary} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
