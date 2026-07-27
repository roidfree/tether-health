import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '../../components/AppButton';
import Card from '../../components/Card';
import * as api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { colors, fonts, inputStyle } from '../../lib/theme';

export default function CarerHomeList() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [caredFor, setCaredFor] = useState<api.CaredForSummary[]>([]);
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);

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

  const onLink = async () => {
    if (!token || !inviteCode.trim()) return;
    setLinkSubmitting(true);
    try {
      await api.linkCarer(token, inviteCode.trim());
      setInviteCode('');
      setLinking(false);
      await load();
    } catch (err: any) {
      Alert.alert(t('couldNotLinkCarer'), err.message ?? 'Something went wrong');
    } finally {
      setLinkSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.intro}>
        {t('carerIntroPrefix')} <Text style={styles.introAccent}>{t('carerIntroAccent')}</Text>
      </Text>

      {linking ? (
        <View style={styles.linkForm}>
          <TextInput
            style={inputStyle}
            placeholder={t('inviteCodePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
          <Text style={styles.hint}>{t('inviteCodeHint')}</Text>
          <View style={styles.linkFormRow}>
            <AppButton
              title={t('cancel')}
              variant="outline"
              onPress={() => {
                setLinking(false);
                setInviteCode('');
              }}
              style={{ flex: 1 }}
            />
            <AppButton
              title={linkSubmitting ? t('saving') : t('linkCaredForButton')}
              onPress={onLink}
              disabled={linkSubmitting || !inviteCode.trim()}
              loading={linkSubmitting}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <AppButton title={t('linkCaredForButton')} variant="outline" onPress={() => setLinking(true)} style={styles.linkButton} />
      )}

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
  linkButton: { marginBottom: 16 },
  linkForm: { marginBottom: 16, gap: 8 },
  linkFormRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -4 },
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
