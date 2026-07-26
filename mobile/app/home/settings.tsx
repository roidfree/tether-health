import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '../../components/AppButton';
import Card from '../../components/Card';
import * as api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { LANGUAGES } from '../../lib/languages';
import { chipSelectedStyle, chipStyle, colors, fonts } from '../../lib/theme';

export default function HomeSettings() {
  const { token, profile, refreshProfile, signOut } = useAuth();
  const { t } = useTranslation();
  const [inviteCode, setInviteCode] = useState<api.CarerInviteCode | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const onGenerateCode = async () => {
    if (!token) return;
    setGeneratingCode(true);
    try {
      const code = await api.generateInviteCode(token);
      setInviteCode(code);
    } catch (err: any) {
      Alert.alert(t('couldNotSave'), err.message ?? 'Something went wrong');
    } finally {
      setGeneratingCode(false);
    }
  };

  // No local "selected language" state that mirrors profile - that copy can
  // drift out of sync with the real value (e.g. if this screen re-renders
  // before refreshProfile resolves, its useState initializer never re-runs,
  // so it'd keep showing the pre-save language even after saving succeeded).
  // pendingCode is only an optimistic overlay for the brief in-flight
  // window; the displayed selection otherwise always comes straight from
  // context, which can't go stale the same way.
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const selectedCode = pendingCode ?? profile?.preferred_language ?? 'en';

  const onSelectLanguage = async (code: string) => {
    if (!token || code === selectedCode) return;
    setPendingCode(code);
    try {
      await api.updateProfile(token, { preferred_language: code });
      await refreshProfile();
    } catch (err: any) {
      Alert.alert(t('couldNotSave'), err.message ?? 'Something went wrong');
    } finally {
      setPendingCode(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.section}>{t('languageForCalls')}</Text>
        <Text style={styles.hint}>{t('languageHint')}</Text>
        <View style={styles.languageRow}>
          {LANGUAGES.map((lang) => (
            <Text
              key={lang.code}
              onPress={() => onSelectLanguage(lang.code)}
              style={[chipStyle, selectedCode === lang.code && chipSelectedStyle, pendingCode === lang.code && styles.chipSaving]}
            >
              {lang.label}
            </Text>
          ))}
        </View>

        {profile?.role !== 'carer' && (
          <>
            <Text style={styles.section}>{t('inviteACarerSection')}</Text>
            <Text style={styles.hint}>{t('inviteACarerHint')}</Text>
            {inviteCode ? (
              <Card tone="flat" style={styles.codeBox}>
                <Text style={styles.codeText}>{inviteCode.code}</Text>
                <Text style={styles.hint}>
                  {t('expiresLabel')}: {new Date(inviteCode.expires_at).toLocaleString()}
                </Text>
              </Card>
            ) : null}
            <AppButton
              title={generatingCode ? t('saving') : t('generateCodeButton')}
              variant="outline"
              onPress={onGenerateCode}
              disabled={generatingCode}
            />
          </>
        )}

        <View style={styles.logoutRow}>
          <AppButton title={t('logOut')} variant="danger" onPress={signOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, backgroundColor: colors.background },
  section: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -8, fontFamily: fonts.medium },
  languageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipSaving: { opacity: 0.5 },
  codeBox: { alignItems: 'center', gap: 4 },
  codeText: { fontSize: 28, fontFamily: fonts.extraBold, color: colors.primaryDark, letterSpacing: 4 },
  logoutRow: { marginTop: 24 },
});
