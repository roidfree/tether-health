import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../lib/auth';

export default function Index() {
  const { isLoading, token, profile } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token) return <Redirect href="/login" />;
  if (profile && !profile.onboarding_completed) return <Redirect href="/onboarding" />;
  return <Redirect href="/dashboard" />;
}
