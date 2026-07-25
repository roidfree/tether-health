import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';

import * as api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function MedicationForm() {
  const { token } = useAuth();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [times, setTimes] = useState('08:00');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!token) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter the medication name.');
      return;
    }

    const scheduledTimes = times
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      await api.createMedication(token, {
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        instructions: instructions.trim() || undefined,
        frequency_per_day: scheduledTimes.length || 1,
        scheduled_times: scheduledTimes,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Could not add medication', err.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New medication</Text>

      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Dosage (e.g. 500mg)" value={dosage} onChangeText={setDosage} />
      <TextInput
        style={styles.input}
        placeholder="Instructions (optional)"
        value={instructions}
        onChangeText={setInstructions}
      />
      <TextInput
        style={styles.input}
        placeholder="Times (comma separated, e.g. 08:00,20:00)"
        value={times}
        onChangeText={setTimes}
      />

      <Button title={submitting ? 'Saving...' : 'Save medication'} onPress={onSubmit} disabled={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
