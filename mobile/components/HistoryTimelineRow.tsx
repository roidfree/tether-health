import { StyleSheet, Text, View } from 'react-native';

import { LATE_THRESHOLD_MINUTES, dayLabel, minutesLate, type PastLog, STATUS_KEYS } from '../lib/historyFormat';
import { useTranslation } from '../lib/i18n';
import { colors, fonts, radii } from '../lib/theme';
import Card from './Card';

// One row of the History timeline (dot + connecting line + status card) -
// matches the reference theme's "04 · HISTORY" screen. Shared by the
// cared-for's own History tab and the carer's per-person History tab so
// both look identical.
export default function HistoryTimelineRow({ log, isLast }: { log: PastLog; isLast: boolean }) {
  const { t } = useTranslation();
  const late = minutesLate(log);
  const isLate = log.status === 'taken' && late > LATE_THRESHOLD_MINUTES;
  const displayDate = new Date(log.responded_at ?? log.scheduled_for);
  const dotColor = log.status === 'missed' ? colors.textFaint : isLate ? colors.warning : colors.primary;

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={styles.line} />}
      </View>
      <Card tone={log.status === 'missed' ? 'flat' : 'glass'} style={styles.card}>
        <View style={styles.header}>
          <Text style={[styles.title, log.status === 'missed' && styles.muted]}>
            {dayLabel(displayDate, t)} · {displayDate.toTimeString().slice(0, 5)}
          </Text>
          <View style={[styles.pill, log.status === 'missed' ? styles.pillMissed : isLate && styles.pillLate]}>
            <Text style={[styles.pillText, log.status === 'missed' ? styles.pillTextMissed : isLate && styles.pillTextLate]}>
              {log.status === 'missed' ? t(STATUS_KEYS.missed) : isLate ? t('minutesLateSuffix', { minutes: late }) : t('onTimePill')}
            </Text>
          </View>
        </View>
        <Text style={[styles.subtitle, log.status === 'missed' && styles.muted]}>{log.medication_name}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 13 },
  rail: { width: 13, alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6, marginTop: 22 },
  line: { width: 1, flex: 1, backgroundColor: colors.border },
  card: { flex: 1, marginBottom: 9 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, fontFamily: fonts.medium, marginTop: 4 },
  muted: { color: colors.textFaint },
  pill: {
    backgroundColor: colors.accentIce,
    borderRadius: radii.md - 4,
    paddingVertical: 4,
    paddingHorizontal: 11,
  },
  pillMissed: { backgroundColor: colors.missedBg },
  pillLate: { backgroundColor: colors.warningBg },
  pillText: { fontSize: 12, fontFamily: fonts.bold, color: colors.primaryDark },
  pillTextMissed: { color: colors.missedText },
  pillTextLate: { color: colors.warningText },
});
