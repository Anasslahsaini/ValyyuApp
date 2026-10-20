import { tKey } from '@workspace/i18n';
import { ComingSoon } from '../../../src/components/ComingSoon';

export default function Screen() {
  return <ComingSoon messageKey={tKey('micro.soon')} />;
}
