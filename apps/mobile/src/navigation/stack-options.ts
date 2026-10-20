import { color, fontFamily } from '@workspace/tokens';
import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

type ScreenOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack.Screen>['options']>,
  (...args: never[]) => unknown
>;

/** Native large title on cream paper, as in the design system v1. */
export const largeTitleOptions: ScreenOptions = {
  headerLargeTitle: true,
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  headerStyle: { backgroundColor: color.bg.paper },
  headerLargeTitleStyle: { fontFamily: fontFamily.display, color: color.ink.primary },
  headerTitleStyle: { color: color.ink.primary },
  headerTintColor: color.ink.primary,
  contentStyle: { backgroundColor: color.bg.paper },
};
