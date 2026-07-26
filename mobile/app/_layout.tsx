import 'react-native-get-random-values';

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts as usePlusJakartaSans,
} from '@expo-google-fonts/plus-jakarta-sans';
import { InstrumentSerif_400Regular_Italic, useFonts as useInstrumentSerif } from '@expo-google-fonts/instrument-serif';
import { registerGlobals } from '@livekit/react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { applyDefaultFont } from '../lib/applyDefaultFont';
import { AuthProvider } from '../lib/auth';
import { useCallKeepReminders } from '../lib/callkeep';
import { colors, fonts } from '../lib/theme';

registerGlobals();

function AppShell() {
  useCallKeepReminders();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: true, title: 'Welcome' }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="cared-for/[caredForId]" options={{ headerShown: false }} />
      <Stack.Screen name="carer-home" options={{ headerShown: false }} />
      <Stack.Screen
        name="medication-form"
        options={{ headerShown: true, title: 'Medication', presentation: 'modal' }}
      />
      <Stack.Screen
        name="call"
        options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [jakartaLoaded] = usePlusJakartaSans({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [serifLoaded] = useInstrumentSerif({ InstrumentSerif_400Regular_Italic });
  const fontsReady = jakartaLoaded && serifLoaded;

  useEffect(() => {
    if (fontsReady) applyDefaultFont();
  }, [fontsReady]);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AppShell />
    </AuthProvider>
  );
}
