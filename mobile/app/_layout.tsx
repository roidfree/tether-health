import 'react-native-get-random-values';

import { registerGlobals } from '@livekit/react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '../lib/auth';
import { useCallKeepReminders } from '../lib/callkeep';

registerGlobals();

function AppShell() {
  useCallKeepReminders();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" options={{ headerShown: true, title: 'Log in' }} />
      <Stack.Screen name="signup" options={{ headerShown: true, title: 'Sign up' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: true, title: 'Welcome' }} />
      <Stack.Screen name="dashboard" options={{ headerShown: true, title: 'Tether Health' }} />
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
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppShell />
    </AuthProvider>
  );
}
