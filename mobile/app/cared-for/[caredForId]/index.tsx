import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import AppButton from '../../../components/AppButton';
import Card from '../../../components/Card';
import DoseIcon from '../../../components/DoseIcon';
import NextCallHero from '../../../components/NextCallHero';
import * as api from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { buildTodaysDoses, countDoneToday, getNextDose, type DoseSlot } from '../../../lib/doseSchedule';
import { useTranslation } from '../../../lib/i18n';
import { colors, fonts, radii } from '../../../lib/theme';
import { useCaredFor } from './_layout';

const STATUS_LABEL_KEYS = {
  taken: 'statusTaken',
  missed: 'statusMissed',
  pending: 'statusPending',
  snoozed: 'statusSnoozed',
  upcoming: 'statusUpcoming',
} as const;

// A linked carer always has full write access to their cared-for's
// medications (backend/app/deps.py's resolve_target_user enforces this
// regardless of what this UI shows) - but never triggers calls themselves,
// hence no "call me back now" here (that's the cared-for's own self-service
// button, on their /home tab) and no buttons at all on the "next call" hero.
export default function CaredForMedications() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { caredForId } = useCaredFor();
  const [dashboard, setDashboard] = useState<api.Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingLogId, setMarkingLogId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getDashboard(token, caredForId);
      setDashboard(data);
    } catch (err: any) {
      Alert.alert(t('couldNotLoadDashboard'), err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token, caredForId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onMarkTaken = async (slot: DoseSlot) => {
    if (!token || !slot.log) return;
    setMarkingLogId(slot.key);
    try {
      // Lets a carer confirm a dose themselves (e.g. they were there when it
      // was taken, or the cared-for told them directly) without waiting on
      // the cared-for's own call to resolve it.
      await api.updateLog(token, slot.log.id, 'taken', caredForId);
      await load();
    } catch (err: any) {
      Alert.alert(t('couldNotMarkTaken'), err.message ?? 'Something went wrong');
    } finally {
      setMarkingLogId(null);
    }
  };

  const openMedicationForm = (item?: api.Medication) => {
    router.push({
      pathname: '/medication-form',
      params: {
        ...(item ? { medication: JSON.stringify(item) } : {}),
        caredForId,
      },
    });
  };

  const doseSlots = buildTodaysDoses(dashboard?.medications ?? [], dashboard?.recent_logs ?? []);
  const { done, total } = countDoneToday(doseSlots);
  const nextDose = getNextDose(doseSlots);

  return (
    <View style={styles.container}>
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
            <Pressable style={({ pressed }) => [pressed && styles.cardPressed]} onPress={() => openMedicationForm(item)}>
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
              <AppButton title={t('addMedication')} variant="outline" onPress={() => openMedicationForm()} />
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
                        <Text style={[styles.medicationName, slot.status === 'upcoming' && styles.textUpcoming]}>
                          {slot.label} — {slot.medicationName}
                        </Text>
                        <Text style={styles.logStatus}>{t(STATUS_LABEL_KEYS[slot.status])}</Text>
                      </View>
                      {actionable && (
                        <AppButton
                          title={markingLogId === slot.key ? t('markingTaken') : t('markAsTaken')}
                          onPress={() => onMarkTaken(slot)}
                          disabled={markingLogId === slot.key}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
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
  medicationName: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  textUpcoming: { color: colors.textFaint },
  logStatus: { textTransform: 'capitalize', color: colors.textMuted, fontFamily: fonts.medium, marginTop: 2 },
  inlineButton: { height: 44, paddingHorizontal: 16, borderRadius: radii.pill },
});
