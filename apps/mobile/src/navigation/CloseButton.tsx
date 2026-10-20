import { color } from '@workspace/tokens';
import { IconButton } from '@workspace/ui';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';

/** Visible Close for modals: swiping down alone is not enough for VoiceOver. */
export function CloseButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <IconButton
      accessibilityLabel={t('common.close')}
      onPress={onPress}
      icon={<Icon sf="xmark" md="close" color={color.ink.primary} />}
    />
  );
}
