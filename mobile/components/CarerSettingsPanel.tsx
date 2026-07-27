import { useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import * as api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';
import { LANGUAGES } from '../lib/languages';
import { chipSelectedStyle, chipStyle, colors, fonts } from '../lib/theme';
import AppButton from './AppButton';

// A carer's own settings - app language and logout. Shared verbatim between
// the cared-for list (app/carer-home/settings.tsx) and every individual
// cared-for's own Settings tab (app/cared-for/[caredForId]/settings.tsx) -
// these are the carer's own account settings, not scoped to whichever
// cared-for they happen to be viewing, so there's exactly one
// implementation reused everywhere rather than a per-screen copy.
//
// Unlike the cared-for's own settings (app/home/settings.tsx), there's no
// invite-code section here (carers link *to* a code, they don't generate
// one) and the language label is generic rather than "for calls" - carers
// never receive reminder calls themselves, this only changes the app's UI
// text.
// `children`, when given, renders between the language section and logout -
// used by the per-cared-for Settings tab to add a "remove this person"
// section that's specific to whichever cared-for is currently open, without
// nesting a second ScrollView inside this one.
export default function CarerSettingsPanel({ children }: { children?: ReactNode }) {
  const { token, profile, refreshProfile, signOut } = useAuth();
  const { t } = useTranslation();

  // See mobile/app/home/settings.tsx for why this optimistic overlay
  // (rather than local state mirroring profile) is used.
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>{t('appLanguage')}</Text>
      <Text style={styles.hint}>{t('appLanguageHint')}</Text>
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

      {children}

      <View style={styles.logoutRow}>
        <AppButton title={t('logOut')} variant="danger" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, backgroundColor: colors.background },
  section: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -8, fontFamily: fonts.medium },
  languageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipSaving: { opacity: 0.5 },
  logoutRow: { marginTop: 24 },
});
