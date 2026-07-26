import { router, Tabs, useLocalSearchParams } from 'expo-router';
import { createContext, useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '../../../components/AppButton';
import GlassTabBar from '../../../components/GlassTabBar';
import { tabIcon } from '../../../components/TabIcon';
import { useTranslation } from '../../../lib/i18n';
import { colors, fonts } from '../../../lib/theme';

type CaredForParams = { caredForId: string; caredForName?: string };

const CaredForContext = createContext<CaredForParams | null>(null);

// Bottom tabs only get initial route params on the tab you actually
// navigated to (Medications, since that's what carer-home links to) -
// switching to History or Settings via the tab bar re-mounts those screens
// with no caredForId of their own, since it's never part of *their*
// navigation call. Reading it once here, where it's guaranteed present
// (this layout only renders because the dynamic [caredForId] segment
// matched), and sharing it via context avoids every tab needing to
// re-derive - and silently falling back to - the caller's own params.
export function useCaredFor(): CaredForParams {
  const ctx = useContext(CaredForContext);
  if (!ctx) throw new Error('useCaredFor must be used within the cared-for tabs layout');
  return ctx;
}

export default function CaredForTabsLayout() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<CaredForParams>();

  return (
    <CaredForContext.Provider value={{ caredForId: params.caredForId, caredForName: params.caredForName }}>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <AppButton
              title={`‹ ${t('carerHomeTitle')}`}
              variant="text"
              fullWidth={false}
              onPress={() => router.back()}
            />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {params.caredForName}
            </Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
          <Tabs.Screen
            name="index"
            options={{ title: t('tabMedications'), tabBarIcon: tabIcon('medkit-outline', 'medkit') }}
          />
          <Tabs.Screen
            name="history"
            options={{ title: t('tabHistory'), tabBarIcon: tabIcon('time-outline', 'time') }}
          />
          <Tabs.Screen
            name="settings"
            options={{ title: t('tabSettings'), tabBarIcon: tabIcon('settings-outline', 'settings') }}
          />
        </Tabs>
      </View>
    </CaredForContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, flexShrink: 1 },
  // Roughly balances the back button's width so the title stays centered.
  headerSpacer: { width: 90 },
});
