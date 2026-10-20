import { Redirect, Stack } from 'expo-router';
import { largeTitleOptions } from '../../src/navigation/stack-options';
import { isDevBuild } from '../../src/env';

/** Developer screens: unreachable in store builds. */
export default function DevLayout() {
  if (!isDevBuild()) return <Redirect href="/" />;
  return <Stack screenOptions={largeTitleOptions} />;
}
