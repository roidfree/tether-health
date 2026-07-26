import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../lib/theme';

// The deep-blue landing page background from the reference theme (see
// wellnest-export-src.dc.html, "01 · LANDING") - solid brand blue with two
// soft translucent circles bleeding off the edges. Used behind login/signup
// (no native header on these two screens - see app/_layout.tsx) so the
// first thing anyone sees, for any account type, matches that look.
export default function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.container}>
      {/* Reverts to the app's default "dark" status bar once this screen
          unmounts - expo-status-bar hands control back to the previously
          mounted <StatusBar> (the one in app/_layout.tsx). */}
      <StatusBar style="light" />
      <View style={styles.circleTopRight} />
      <View style={styles.circleBottomLeft} />
      <SafeAreaView style={styles.content}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary, overflow: 'hidden' },
  content: { flex: 1 },
  circleTopRight: {
    position: 'absolute',
    right: -70,
    top: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circleBottomLeft: {
    position: 'absolute',
    left: -90,
    bottom: 100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
