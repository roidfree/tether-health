import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '../components/AppButton';
import AuthBackground from '../components/AuthBackground';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';
import { colors, fonts, inputStyle } from '../lib/theme';

export default function Signup() {
  const { signUp } = useAuth();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (password.length < 8) {
      Alert.alert(t('passwordTooShort'), t('useAtLeast8Chars'));
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email.trim(), password, fullName.trim());
      router.replace('/');
    } catch (err: any) {
      Alert.alert(t('signUpFailed'), err.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground>
      <View style={styles.container}>
        <Text style={styles.title}>{t('createYourAccount')}</Text>

        <View style={styles.form}>
          <TextInput
            style={inputStyle}
            placeholder={t('fullName')}
            placeholderTextColor={colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={inputStyle}
            placeholder={t('email')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={inputStyle}
            placeholder={t('passwordMin8')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <AppButton
            title={submitting ? t('creatingAccount') : t('signUp')}
            variant="glass"
            onPress={onSubmit}
            disabled={submitting}
            loading={submitting}
          />
        </View>

        <Link href="/login" style={styles.link}>
          {t('haveAccountLogIn')}
        </Link>
      </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 20 },
  title: { fontSize: 26, fontFamily: fonts.extraBold, color: colors.textOnPrimary, letterSpacing: -0.5 },
  form: { gap: 12 },
  link: { marginTop: 16, textAlign: 'center', color: colors.textOnPrimaryMuted, fontFamily: fonts.semiBold },
});
