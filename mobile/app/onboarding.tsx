import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '../components/AppButton';
import * as api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';
import { LANGUAGES } from '../lib/languages';
import { chipSelectedStyle, chipStyle, colors, fonts, inputStyle } from '../lib/theme';

export default function Onboarding() {
  const { token, profile, refreshProfile } = useAuth();
  const { t } = useTranslation();

  const [accountType, setAccountType] = useState<'myself' | 'carer'>('myself');

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferred_language ?? 'en');
  const [inviteCode, setInviteCode] = useState('');

  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState('08:00');

  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!token) return;
    if (!fullName.trim()) {
      Alert.alert(t('nameRequired'), t('pleaseEnterYourName'));
      return;
    }

    setSubmitting(true);
    try {
      if (accountType === 'carer') {
        // Link first - if the code is bad, nothing else about this account
        // should be saved as "onboarding complete" yet.
        await api.linkCarer(token, inviteCode.trim());
        await api.updateProfile(token, {
          full_name: fullName.trim(),
          preferred_language: preferredLanguage,
          onboarding_completed: true,
        });
      } else {
        await api.updateProfile(token, {
          full_name: fullName.trim(),
          age: age ? Number(age) : undefined,
          phone: phone.trim() || undefined,
          preferred_language: preferredLanguage,
          onboarding_completed: true,
        });

        if (medName.trim()) {
          await api.createMedication(token, {
            name: medName.trim(),
            dosage: dosage.trim() || undefined,
            frequency_per_day: times.split(',').filter(Boolean).length || 1,
            scheduled_times: times
              .split(',')
              .map((time) => time.trim())
              .filter(Boolean),
          });
        }
      }

      await refreshProfile();
      router.replace(accountType === 'carer' ? '/carer-home' : '/home');
    } catch (err: any) {
      Alert.alert(
        accountType === 'carer' ? t('couldNotLinkCarer') : t('couldNotFinishOnboarding'),
        err.message ?? 'Something went wrong'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>{t('whoIsThisFor')}</Text>
      <View style={styles.accountTypeRow}>
        <Text
          onPress={() => setAccountType('myself')}
          style={[styles.accountTypeChip, accountType === 'myself' && styles.accountTypeChipSelected]}
        >
          {t('setupForYourself')}
        </Text>
        <Text
          onPress={() => setAccountType('carer')}
          style={[styles.accountTypeChip, accountType === 'carer' && styles.accountTypeChipSelected]}
        >
          {t('setupAsCarer')}
        </Text>
      </View>

      <Text style={styles.section}>{t('aboutYou')}</Text>
      <TextInput
        style={inputStyle}
        placeholder={t('fullName')}
        placeholderTextColor={colors.textMuted}
        value={fullName}
        onChangeText={setFullName}
      />

      {accountType === 'carer' ? (
        <>
          <TextInput
            style={inputStyle}
            placeholder={t('inviteCodePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
          <Text style={styles.hint}>{t('inviteCodeHint')}</Text>

          <Text style={styles.section}>{t('appLanguage')}</Text>
          <View style={styles.languageRow}>
            {LANGUAGES.map((lang) => (
              <Text
                key={lang.code}
                onPress={() => setPreferredLanguage(lang.code)}
                style={[chipStyle, preferredLanguage === lang.code && chipSelectedStyle]}
              >
                {lang.label}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <>
          <TextInput
            style={inputStyle}
            placeholder={t('age')}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={age}
            onChangeText={setAge}
          />
          <TextInput
            style={inputStyle}
            placeholder={t('phoneOptional')}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.section}>{t('preferredLanguageForCalls')}</Text>
          <View style={styles.languageRow}>
            {LANGUAGES.map((lang) => (
              <Text
                key={lang.code}
                onPress={() => setPreferredLanguage(lang.code)}
                style={[chipStyle, preferredLanguage === lang.code && chipSelectedStyle]}
              >
                {lang.label}
              </Text>
            ))}
          </View>

          <Text style={styles.section}>{t('addFirstMedicationOptional')}</Text>
          <TextInput
            style={inputStyle}
            placeholder={t('medicationName')}
            placeholderTextColor={colors.textMuted}
            value={medName}
            onChangeText={setMedName}
          />
          <TextInput
            style={inputStyle}
            placeholder={t('dosageExample')}
            placeholderTextColor={colors.textMuted}
            value={dosage}
            onChangeText={setDosage}
          />
          <TextInput
            style={inputStyle}
            placeholder={t('timesCommaSeparated')}
            placeholderTextColor={colors.textMuted}
            value={times}
            onChangeText={setTimes}
          />
        </>
      )}

      <AppButton
        title={submitting ? t('saving') : t('finishSetup')}
        onPress={onSubmit}
        disabled={submitting}
        loading={submitting}
        style={{ marginTop: 8 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, backgroundColor: colors.background },
  section: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 16, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -8 },
  accountTypeRow: { flexDirection: 'row', gap: 8 },
  accountTypeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  accountTypeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.textOnPrimary,
  },
  languageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
