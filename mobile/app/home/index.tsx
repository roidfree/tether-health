import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '../../components/AppButton';
import Card from '../../components/Card';
import DoseIcon from '../../components/DoseIcon';
import NextCallHero from '../../components/NextCallHero';
import * as api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { buildTodaysDoses, countDoneToday, getNextDose, type DoseSlot } from '../../lib/doseSchedule';
import { useTranslation } from '../../lib/i18n';
import { colors, fonts, radii } from '../../lib/theme';

const STATUS_LABEL_KEYS = {
  taken: 'statusTaken',
  missed: 'statusMissed',
  pending: 'statusPending',
  snoozed: 'statusSnoozed',
  upcoming: 'statusUpcoming',
} as const;

function greetingKey(): 'goodMorning' | 'goodAfternoon' | 'goodEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'goodMorning';
  if (hour < 18) return 'goodAfternoon';
  return 'goodEvening';
}

export default function HomeMedications() {
  const { token, profile } = useAuth();
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<api.Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [callingLogId, setCallingLogId] = useState<string | null>(null);

  // A managed cared-for keeps read access and can still receive calls, but
  // medication changes belong to their linked carer from this point on - see
  // backend/app/deps.py's resolve_target_user for the enforcement this
  // mirrors.
  const canWrite = !profile?.is_managed;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getDashboard(token);
      setDashboard(data);
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

  const onCallBackNow = async (slot: DoseSlot) => {
    if (!token) return;
    setCallingLogId(slot.key);
    try {
      // Fires the call server-side; the existing CallKit polling (lib/callkeep.tsx)
      // picks it up and rings in a few seconds, same as any scheduled call.
      await api.startCall(token, slot.medicationId, slot.log?.id);
    } catch (err: any) {
      Alert.alert(t('couldNotStartCall'), err.message ?? 'Something went wrong');
    } finally {
      setCallingLogId(null);
    }
  };

  const openMedicationForm = (item?: api.Medication) => {
    router.push({
      pathname: '/medication-form',
      ...(item ? { params: { medication: JSON.stringify(item) } } : {}),
    });
  };

  const doseSlots = buildTodaysDoses(dashboard?.medications ?? [], dashboard?.recent_logs ?? []);
  const { done, total } = countDoneToday(doseSlots);
  const nextDose = getNextDose(doseSlots);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.greetingRow}>
        <Text style={styles.greetingSmall}>{t(greetingKey())}</Text>
        <Text style={styles.greetingName}>{profile?.full_name?.split(' ')[0] ?? 'there'}</Text>
      </View>

      {!canWrite && <Text style={styles.managedNote}>{t('managedByCarerNote')}</Text>}

      <NextCallHero nextDose={nextDose} />

      {loading && !dashboard ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <FlatList
          data={dashboard?.medications ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('noMedicationsYet')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              disabled={!canWrite}
              style={({ pressed }) => [pressed && canWrite && styles.cardPressed]}
              onPress={() => canWrite && openMedicationForm(item)}
            >
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.dosage ?? t('asPrescribed')} • {t('perDaySuffix', { n: item.frequency_per_day })}
                  {item.scheduled_times.length ? ` • ${item.scheduled_times.join(', ')}` : ''}
                </Text>
              </Card>
            </Pressable>
          )}
          ListFooterComponent={
            <>
              {canWrite && (
                <AppButton title={t('addMedication')} variant="outline" onPress={() => openMedicationForm()} />
              )}
              <View style={styles.sectionRow}>
                <Text style={styles.section}>{t('todaysDoses')}</Text>
                {total > 0 && <Text style={styles.doneCount}>{t('doneCountSuffix', { done, total })}</Text>}
              </View>
              {doseSlots.length === 0 ? (
                <Text style={styles.empty}>{t('noDosesToday')}</Text>
              ) : (
                doseSlots.map((slot) => {
                  const actionable = slot.status === 'pending' || slot.status === 'snoozed';
                  return (
                    <Card key={slot.key} style={styles.logRow}>
                      <DoseIcon status={slot.status} time={slot.time} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.logTime, slot.status === 'upcoming' && styles.logTimeUpcoming]}>
                          {slot.label} — {slot.medicationName}
                        </Text>
                        <Text style={styles.logStatus}>{t(STATUS_LABEL_KEYS[slot.status])}</Text>
                      </View>
                      {actionable && (
                        <AppButton
                          title={callingLogId === slot.key ? t('calling') : t('callMeBackNow')}
                          onPress={() => onCallBackNow(slot)}
                          disabled={callingLogId === slot.key}
                          fullWidth={false}
                          style={styles.inlineButton}
                        />
                      )}
                    </Card>
                  );
                })
              )}
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  greetingRow: { marginBottom: 12 },
  greetingSmall: { fontSize: 14, color: colors.textMuted, fontFamily: fonts.medium },
  greetingName: { fontSize: 22, fontFamily: fonts.extraBold, color: colors.textPrimary, letterSpacing: -0.4 },
  managedNote: { color: colors.textMuted, fontSize: 12, marginBottom: 8, fontFamily: fonts.medium },
  section: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 20, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doneCount: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary, marginTop: 20 },
  empty: { color: colors.textMuted, marginBottom: 12, fontFamily: fonts.medium },
  card: { marginBottom: 10 },
  cardPressed: { opacity: 0.85 },
  cardTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  cardSubtitle: { color: colors.textMuted, marginTop: 2, fontFamily: fonts.medium },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  logTime: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
  logTimeUpcoming: { color: colors.textFaint },
  logStatus: { textTransform: 'capitalize', color: colors.textMuted, fontFamily: fonts.medium, marginTop: 2 },
  inlineButton: { height: 44, paddingHorizontal: 16, borderRadius: radii.pill },
});
