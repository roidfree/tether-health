import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import HistorySummaryCard from '../../../components/HistorySummaryCard';
import HistoryTimelineRow from '../../../components/HistoryTimelineRow';
import * as api from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { LATE_THRESHOLD_MINUTES, minutesLate, type PastLog } from '../../../lib/historyFormat';
import { useTranslation } from '../../../lib/i18n';
import { colors, fonts } from '../../../lib/theme';
import { useCaredFor } from './_layout';

export default function CaredForHistory() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { caredForId } = useCaredFor();
  const [dashboard, setDashboard] = useState<api.Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'week' | 'month'>('week');

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

  const pastLogs = useMemo(() => {
    const cutoff = Date.now() - (range === 'week' ? 7 : 30) * 86400000;
    return (dashboard?.recent_logs ?? [])
      .filter((log): log is PastLog => log.status === 'taken' || log.status === 'missed')
      .filter((log) => new Date(log.scheduled_for).getTime() >= cutoff);
  }, [dashboard, range]);

  const onTimeCount = pastLogs.filter((log) => log.status === 'taken' && minutesLate(log) <= LATE_THRESHOLD_MINUTES).length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.intro}>
          {t('historyIntroPrefix')} <Text style={styles.introAccent}>{t('historyIntroAccent')}</Text>
        </Text>
        <View style={styles.rangeToggle}>
          <Text onPress={() => setRange('week')} style={[styles.rangeChip, range === 'week' && styles.rangeChipActive]}>
            {t('weekFilter')}
          </Text>
          <Text onPress={() => setRange('month')} style={[styles.rangeChip, range === 'month' && styles.rangeChipActive]}>
            {t('monthFilter')}
          </Text>
        </View>
      </View>

      {loading && !dashboard ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <FlatList
          data={pastLogs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('noPastHistory')}</Text>}
          renderItem={({ item, index }) => <HistoryTimelineRow log={item} isLast={index === pastLogs.length - 1} />}
          ListFooterComponent={pastLogs.length > 0 ? <HistorySummaryCard onTime={onTimeCount} total={pastLogs.length} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  rangeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 19,
    padding: 4,
  },
  rangeChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 15, fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  rangeChipActive: { backgroundColor: colors.primary, color: colors.textOnPrimary },
  intro: { flex: 1, fontSize: 15, color: colors.textMuted, fontFamily: fonts.medium },
  introAccent: { fontFamily: fonts.serifItalic, color: colors.primary, fontSize: 17 },
  empty: { color: colors.textMuted, fontFamily: fonts.medium },
});
