import { Tabs } from 'expo-router';

import GlassTabBar from '../../components/GlassTabBar';
import { tabIcon } from '../../components/TabIcon';
import { useTranslation } from '../../lib/i18n';

export default function CarerHomeTabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('carerHomeTitle'), tabBarIcon: tabIcon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabSettings'), tabBarIcon: tabIcon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
