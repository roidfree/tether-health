import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../lib/i18n';
import { colors, fonts, radii } from '../lib/theme';

// The closing "X of Y on time" tinted card from the reference theme's
// History screen. Shared by both History tabs (self/cared-for and the
// carer's per-person view).
export default function HistorySummaryCard({ onTime, total }: { onTime: number; total: number }) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="sparkles" size={16} color={colors.accentIce} />
      </View>
      <Text style={styles.text}>
        <Text style={styles.bold}>{t('onTimeSummary', { onTime, total })}</Text>
        {' — '}
        {t('summaryStarNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.tint,
    borderRadius: radii.lg,
    padding: 15,
    marginTop: 8,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.primaryDark, fontFamily: fonts.medium },
  bold: { fontFamily: fonts.bold },
});
