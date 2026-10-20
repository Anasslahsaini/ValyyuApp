import { tKey } from '@workspace/i18n';

export type TabName = 'today' | 'repas' | 'sport' | 'style' | 'micro';

export type TabSpec = {
  name: TabName;
  labelKey: `tabs.${TabName}`;
  /** Spoken name when it differs from the label. */
  a11yKey?: 'a11y.micro';
  /** SF Symbol (iOS) and Material icon (Android), from the design system v1. */
  icon: { sf: string; md: string };
  /** iOS 26 places a "search" item apart at the end of the bar: design variant B for the mic. */
  role?: 'search';
};

export const TABS: readonly TabSpec[] = [
  { name: 'today', labelKey: tKey('tabs.today'), icon: { sf: 'sun.max', md: 'wb_sunny' } },
  { name: 'repas', labelKey: tKey('tabs.repas'), icon: { sf: 'fork.knife', md: 'restaurant' } },
  { name: 'sport', labelKey: tKey('tabs.sport'), icon: { sf: 'dumbbell', md: 'fitness_center' } },
  { name: 'style', labelKey: tKey('tabs.style'), icon: { sf: 'tshirt', md: 'checkroom' } },
  {
    name: 'micro',
    labelKey: tKey('tabs.micro'),
    a11yKey: tKey('a11y.micro'),
    icon: { sf: 'mic.fill', md: 'mic' },
    role: 'search',
  },
];
