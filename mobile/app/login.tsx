import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '../components/AppButton';
import AuthBackground from '../components/AuthBackground';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';
import { colors, fonts, inputStyle } from '../lib/theme';

export default function Login() {
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (err: any) {
      Alert.alert(t('logInFailed'), err.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground>
      <View style={styles.container}>
        <View style={styles.logoRow}>
          <Logo dark={false} size={96} />
        </View>
        <Text style={styles.title}>{t('welcomeBack')}</Text>

        <View style={styles.form}>
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
            placeholder={t('password')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <AppButton
            title={submitting ? t('loggingIn') : t('logIn')}
            variant="glass"
            onPress={onSubmit}
            disabled={submitting}
            loading={submitting}
          />
        </View>

        <Link href="/signup" style={styles.link}>
          {t('noAccountSignUp')}
        </Link>
      </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 20 },
  logoRow: { alignItems: 'center', marginBottom: 56 },
  title: { fontSize: 26, fontFamily: fonts.extraBold, color: colors.textOnPrimary, letterSpacing: -0.5 },
  form: { gap: 12 },
  link: { marginTop: 16, textAlign: 'center', color: colors.textOnPrimaryMuted, fontFamily: fonts.semiBold },
});
