import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

export default function Index() {
  const { isLoading, token, profile } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!token) return <Redirect href="/login" />;
  if (profile && !profile.onboarding_completed) return <Redirect href="/onboarding" />;
  if (profile?.role === 'carer') return <Redirect href="/carer-home" />;
  return <Redirect href="/home" />;
}
