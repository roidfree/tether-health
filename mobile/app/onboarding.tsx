import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import * as api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Onboarding() {
  const { token, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');

  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState('08:00');

  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!token) return;
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }

    setSubmitting(true);
    try {
      await api.updateProfile(token, {
        full_name: fullName.trim(),
        age: age ? Number(age) : undefined,
        phone: phone.trim() || undefined,
        onboarding_completed: true,
      });

      if (medName.trim()) {
        await api.createMedication(token, {
          name: medName.trim(),
          dosage: dosage.trim() || undefined,
          frequency_per_day: times.split(',').filter(Boolean).length || 1,
          scheduled_times: times
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        });
      }

      await refreshProfile();
      router.replace('/dashboard');
    } catch (err: any) {
      Alert.alert('Could not finish onboarding', err.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>About you</Text>
      <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
      <TextInput
        style={styles.input}
        placeholder="Age"
        keyboardType="number-pad"
        value={age}
        onChangeText={setAge}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone (optional)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Text style={styles.section}>Add your first medication (optional)</Text>
      <TextInput style={styles.input} placeholder="Medication name" value={medName} onChangeText={setMedName} />
      <TextInput style={styles.input} placeholder="Dosage (e.g. 500mg)" value={dosage} onChangeText={setDosage} />
      <TextInput
        style={styles.input}
        placeholder="Times (comma separated, e.g. 08:00,20:00)"
        value={times}
        onChangeText={setTimes}
      />

      <Button title={submitting ? 'Saving...' : 'Finish setup'} onPress={onSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
