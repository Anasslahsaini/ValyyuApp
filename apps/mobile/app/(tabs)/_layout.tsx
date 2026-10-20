import { color } from '@workspace/tokens';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';
import { TABS } from '../../src/navigation/tabs';

/** Native tab bar: 4 sections plus the mic, set apart at the end (design variant B). */
export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <NativeTabs
      tintColor={color.ink.primary}
      iconColor={color.ink.secondary}
      labelStyle={{ color: color.ink.secondary }}
    >
      {TABS.map((tab) => (
        <NativeTabs.Trigger
          key={tab.name}
          name={tab.name}
          accessibilityLabel={t(tab.a11yKey ?? tab.labelKey)}
          {...(tab.role ? { role: tab.role } : {})}
        >
          <NativeTabs.Trigger.Icon sf={tab.icon.sf as never} md={tab.icon.md as never} />
          <NativeTabs.Trigger.Label>{t(tab.labelKey)}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
