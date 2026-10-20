import { features } from '@workspace/config';
import { Redirect, Stack } from 'expo-router';

/** The community space ships last: unreachable, even by deep link, while the flag is off. */
export default function CommunityLayout() {
  if (!features.community) return <Redirect href="/" />;
  return <Stack />;
}
