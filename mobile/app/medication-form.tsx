import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '../components/AppButton';
import * as api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';
import { colors, fonts, inputStyle, radii } from '../lib/theme';

const MAX_FREQUENCY = 6;

function defaultTimeForDose(index: number): Date {
  const date = new Date();
  date.setHours(8 + index * 4, 0, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseTimeString(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function buildSignature(
  name: string,
  dosage: string,
  instructions: string,
  frequency: number,
  times: Date[],
  days: number[]
): string {
  return JSON.stringify({
    name: name.trim(),
    dosage: dosage.trim(),
    instructions: instructions.trim(),
    frequency,
    times: times.map(formatTime),
    days: [...days].sort((a, b) => a - b),
  });
}

export default function MedicationForm() {
  const { token } = useAuth();
  const { t, dayAbbrevs } = useTranslation();
  const { medication: medicationParam, caredForId } = useLocalSearchParams<{
    medication?: string;
    caredForId?: string;
  }>();
  const [existing] = useState<api.Medication | null>(() => {
    if (!medicationParam) return null;
    try {
      return JSON.parse(medicationParam) as api.Medication;
    } catch {
      return null;
    }
  });

  const [name, setName] = useState(existing?.name ?? '');
  const [dosage, setDosage] = useState(existing?.dosage ?? '');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [frequency, setFrequency] = useState(existing?.frequency_per_day ?? 1);
  const [times, setTimes] = useState<Date[]>(
    existing?.scheduled_times.length ? existing.scheduled_times.map(parseTimeString) : [defaultTimeForDose(0)]
  );
  const [days, setDays] = useState<number[]>(existing?.days_of_week ?? []);
  const [openTimeIndex, setOpenTimeIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [initialSignature] = useState(() => buildSignature(name, dosage, instructions, frequency, times, days));
  const isDirty = !existing || buildSignature(name, dosage, instructions, frequency, times, days) !== initialSignature;

  const changeFrequency = (delta: number) => {
    const next = Math.min(MAX_FREQUENCY, Math.max(1, frequency + delta));
    setFrequency(next);
    setTimes((prev) => {
      if (next > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: next - prev.length }, (_, i) => defaultTimeForDose(prev.length + i)),
        ];
      }
      return prev.slice(0, next);
    });
  };

  const updateTime = (index: number, date: Date | undefined) => {
    if (Platform.OS === 'android') setOpenTimeIndex(null);
    if (!date) return;
    setTimes((prev) => prev.map((existingTime, i) => (i === index ? date : existingTime)));
  };

  const toggleDay = (day: number) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const onSubmit = async () => {
    if (!token) return;
    if (!name.trim()) {
      Alert.alert(t('nameRequired'), t('pleaseEnterYourName'));
      return;
    }

    const payload = {
      name: name.trim(),
      dosage: dosage.trim() || null,
      instructions: instructions.trim() || null,
      frequency_per_day: frequency,
      scheduled_times: times.map(formatTime),
      days_of_week: days,
    };

    setSubmitting(true);
    try {
      if (existing) {
        await api.updateMedication(token, existing.id, payload, caredForId);
      } else {
        await api.createMedication(token, payload, caredForId);
      }
      router.back();
    } catch (err: any) {
      Alert.alert(
        existing ? t('couldNotSaveChanges') : t('couldNotAddMedication'),
        err.message ?? 'Something went wrong'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onRemove = () => {
    if (!token || !existing) return;
    Alert.alert(t('removeConfirmTitle'), t('removeConfirmMessage', { name: existing.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          try {
            await api.deleteMedication(token, existing.id, caredForId);
            router.back();
          } catch (err: any) {
            Alert.alert(t('couldNotRemoveMedication'), err.message ?? 'Something went wrong');
            setRemoving(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{existing ? t('editMedication') : t('newMedication')}</Text>

      <TextInput style={inputStyle} placeholder={t('name')} placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
      <TextInput
        style={inputStyle}
        placeholder={t('dosageExample')}
        placeholderTextColor={colors.textMuted}
        value={dosage}
        onChangeText={setDosage}
      />
      <TextInput
        style={inputStyle}
        placeholder={t('instructionsOptional')}
        placeholderTextColor={colors.textMuted}
        value={instructions}
        onChangeText={setInstructions}
      />

      <Text style={styles.label}>{t('timesPerDay')}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          style={({ pressed }) => [styles.stepperButton, frequency <= 1 && styles.stepperButtonDisabled, pressed && styles.stepperButtonPressed]}
          onPress={() => changeFrequency(-1)}
          disabled={frequency <= 1}
        >
          <Text style={styles.stepperButtonLabel}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{frequency}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.stepperButton,
            frequency >= MAX_FREQUENCY && styles.stepperButtonDisabled,
            pressed && styles.stepperButtonPressed,
          ]}
          onPress={() => changeFrequency(1)}
          disabled={frequency >= MAX_FREQUENCY}
        >
          <Text style={styles.stepperButtonLabel}>+</Text>
        </Pressable>
      </View>

      {times.map((time, index) => (
        <View key={index} style={styles.doseBlock}>
          <Text style={styles.label}>{times.length > 1 ? t('doseTimeLabel', { n: index + 1 }) : t('time')}</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={time}
              mode="time"
              display="spinner"
              onChange={(_, date) => updateTime(index, date)}
              style={styles.spinner}
            />
          ) : (
            <>
              <Pressable style={styles.timeChip} onPress={() => setOpenTimeIndex(index)}>
                <Text style={styles.timeChipLabel}>{formatTime(time)}</Text>
              </Pressable>
              {openTimeIndex === index && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="spinner"
                  onChange={(_, date) => updateTime(index, date)}
                />
              )}
            </>
          )}
        </View>
      ))}

      <Text style={styles.label}>{t('daysOfTheWeek')}</Text>
      <Text style={styles.hint}>{t('leaveNoneSelectedHint')}</Text>
      <View style={styles.dayRow}>
        {dayAbbrevs.map((label, index) => (
          <Text
            key={index}
            onPress={() => toggleDay(index)}
            style={[styles.dayChip, days.includes(index) && styles.dayChipSelected]}
          >
            {label}
          </Text>
        ))}
      </View>

      {isDirty && (
        <AppButton
          title={submitting ? t('saving') : existing ? t('saveChanges') : t('saveMedication')}
          onPress={onSubmit}
          disabled={submitting}
          loading={submitting}
          style={{ marginTop: 8 }}
        />
      )}

      {existing && (
        <AppButton
          title={removing ? t('removing') : t('removeMedication')}
          variant="danger"
          onPress={onRemove}
          disabled={removing}
          loading={removing}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 12, paddingBottom: 48 },
  title: { fontSize: 22, fontFamily: fonts.extraBold, color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.4 },
  label: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 8 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -8, fontFamily: fonts.medium },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentIce,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPressed: { opacity: 0.7 },
  stepperButtonDisabled: { opacity: 0.4 },
  stepperButtonLabel: { fontSize: 20, fontFamily: fonts.bold, color: colors.primaryDark, lineHeight: 22 },
  stepperValue: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.textPrimary, minWidth: 24, textAlign: 'center' },
  doseBlock: { gap: 4 },
  spinner: { height: 120, alignSelf: 'center' },
  timeChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentIce,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  timeChipLabel: { fontSize: 15, fontFamily: fonts.bold, color: colors.primaryDark },
  dayRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  dayChip: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 36,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.textOnPrimary,
  },
});
