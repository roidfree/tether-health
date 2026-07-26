import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '../../components/Card';
import * as api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { colors, fonts } from '../../lib/theme';

export default function CarerHomeList() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [caredFor, setCaredFor] = useState<api.CaredForSummary[]>([]);
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [people, alerts] = await Promise.all([api.listCaredFor(token), api.getCarerAlerts(token)]);
      setCaredFor(people);
      const counts: Record<string, number> = {};
      for (const alert of alerts) {
        counts[alert.cared_for_id] = (counts[alert.cared_for_id] ?? 0) + 1;
      }
      setAlertCounts(counts);
    } catch (err: any) {
      Alert.alert(t('couldNotLoadDashboard'), err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.intro}>
        {t('carerIntroPrefix')} <Text style={styles.introAccent}>{t('carerIntroAccent')}</Text>
      </Text>
      {loading && caredFor.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <FlatList
          data={caredFor}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>{t('noCaredForYet')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [pressed && styles.cardPressed]}
              onPress={() =>
                router.push({
                  pathname: '/cared-for/[caredForId]',
                  params: { caredForId: item.id, caredForName: item.full_name },
                })
              }
            >
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>{item.full_name}</Text>
                {alertCounts[item.id] ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{alertCounts[item.id]}</Text>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  intro: { fontSize: 15, color: colors.textMuted, fontFamily: fonts.medium, marginBottom: 16 },
  introAccent: { fontFamily: fonts.serifItalic, color: colors.primary, fontSize: 17 },
  empty: { color: colors.textMuted, marginTop: 16, fontFamily: fonts.medium },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardPressed: { opacity: 0.85 },
  cardTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.textOnPrimary, fontFamily: fonts.bold, fontSize: 12 },
});
