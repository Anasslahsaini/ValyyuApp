import { IconButton } from '../index';

// An icon-only button without a spoken name must not compile.
// @ts-expect-error accessibilityLabel is required
export const missingLabel = <IconButton onPress={() => undefined} icon={null} />;
