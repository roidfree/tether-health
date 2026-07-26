import { StyleSheet, Text, View } from 'react-native';

import { formatCountdown, type DoseSlot } from '../lib/doseSchedule';
import { useTranslation } from '../lib/i18n';
import { colors, fonts, radii } from '../lib/theme';
import PulseDot from './PulseDot';

// The "NEXT CALL" hero card from the reference theme's Home screen - same
// deep-blue-with-two-soft-circles background as the landing/login screen
// (components/AuthBackground.tsx), scaled down to card size. Shows the dose
// that will actually call next: if it's been snoozed, that means the
// snoozed-until retry time, not the original (by-then-passed) scheduled
// time - showing the stale scheduled time here was the earlier bug.
export default function NextCallHero({ nextDose }: { nextDose?: DoseSlot }) {
  const { t } = useTranslation();
  const isFuture = nextDose ? nextDose.nextCallAt.getTime() > Date.now() : false;

  return (
    <View style={styles.hero}>
      <View style={styles.circleTopRight} />
      <View style={styles.circleBottomLeft} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.label}>{t('nextCallLabel')}</Text>
          {nextDose && (
            <View style={styles.pill}>
              <PulseDot />
              <Text style={styles.pillText}>{isFuture ? t('onTrack') : t('dueNow')}</Text>
            </View>
          )}
        </View>

        {nextDose ? (
          <>
            <View style={styles.timeRow}>
              <Text style={styles.time}>
                {String(nextDose.nextCallAt.getHours()).padStart(2, '0')}:
                {String(nextDose.nextCallAt.getMinutes()).padStart(2, '0')}
              </Text>
              {isFuture && <Text style={styles.countdown}>{t('inDuration', { duration: formatCountdown(nextDose.nextCallAt) })}</Text>}
            </View>
            <Text style={styles.subtitle}>
              {nextDose.medicationName} · {nextDose.dosage ?? t('asPrescribed')} — {t('ringBeforeSuffix')}
            </Text>
          </>
        ) : (
          <Text style={styles.allDone}>{t('allMedicationsTaken')}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    overflow: 'hidden',
    marginBottom: 16,
  },
  circleTopRight: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleBottomLeft: {
    position: 'absolute',
    left: -50,
    bottom: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: { padding: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontFamily: fonts.bold, color: colors.accent, letterSpacing: 0.6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 13,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  pillText: { color: colors.textOnPrimary, fontSize: 12, fontFamily: fonts.semiBold },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8 },
  time: { fontSize: 46, fontFamily: fonts.extraBold, color: colors.textOnPrimary, letterSpacing: -1.5 },
  countdown: { fontSize: 14, color: colors.textOnPrimaryMuted, fontFamily: fonts.medium },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.accentIce, marginTop: 6, fontFamily: fonts.medium },
  allDone: { fontSize: 18, fontFamily: fonts.bold, color: colors.textOnPrimary, marginTop: 10 },
});
