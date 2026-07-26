import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { DoseSlot } from '../lib/doseSchedule';
import { colors, fonts } from '../lib/theme';
import PulseDot from './PulseDot';

// The per-dose status icon from the reference theme's "Today's doses" list -
// a checkmark for taken, a pulsing dot for the currently-actionable dose,
// and the scheduled hour in a muted circle for anything still upcoming (or
// missed). Shared by every "today's doses" list (self/cared-for's own Home,
// and the carer's per-person view).
export default function DoseIcon({ status, time }: { status: DoseSlot['status']; time: string }) {
  if (status === 'taken') {
    return (
      <View style={[styles.icon, styles.taken]}>
        <Ionicons name="checkmark" size={15} color={colors.primary} />
      </View>
    );
  }
  if (status === 'pending' || status === 'snoozed') {
    return (
      <View style={[styles.icon, styles.active]}>
        <PulseDot color={colors.accent} />
      </View>
    );
  }
  return (
    <View style={[styles.icon, styles.muted]}>
      <Text style={styles.mutedText}>{time.split(':')[0]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  taken: { backgroundColor: colors.accentIce },
  active: { backgroundColor: colors.primary },
  muted: { backgroundColor: colors.surfaceMuted },
  mutedText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted },
});
