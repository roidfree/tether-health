import { Tabs } from 'expo-router';

import GlassTabBar from '../../components/GlassTabBar';
import { tabIcon } from '../../components/TabIcon';
import { useTranslation } from '../../lib/i18n';

export default function HomeTabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      // The bottom tab bar already labels each screen (Medications/History/
      // Settings) - a native top header repeating the same word was pure
      // duplication, so it stays off (see screenOptions below); the custom
      // GlassTabBar reproduces the reference theme's floating frosted dock.
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabMedications'), tabBarIcon: tabIcon('medkit-outline', 'medkit') }}
      />
      <Tabs.Screen name="history" options={{ title: t('tabHistory'), tabBarIcon: tabIcon('time-outline', 'time') }} />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabSettings'), tabBarIcon: tabIcon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
