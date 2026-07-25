import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { token, profile, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<api.Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [callingId, setCallingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getDashboard(token);
      setDashboard(data);
    } catch (err: any) {
      Alert.alert('Could not load dashboard', err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onDelete = async (id: string) => {
    if (!token) return;
    try {
      await api.deleteMedication(token, id);
      load();
    } catch (err: any) {
      Alert.alert('Could not delete medication', err.message ?? 'Something went wrong');
    }
  };

  const onCallNow = async (medicationId: string) => {
    if (!token) return;
    setCallingId(medicationId);
    try {
      const call = await api.startCall(token, medicationId);
      router.push({
        pathname: '/call',
        params: {
          callId: call.call_id,
          roomName: call.room_name,
          livekitUrl: call.livekit_url,
          accessToken: call.access_token,
        },
      });
    } catch (err: any) {
      Alert.alert('Could not start call', err.message ?? 'Something went wrong');
    } finally {
      setCallingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi {profile?.full_name?.split(' ')[0] ?? 'there'} 👋</Text>
        <Button title="Log out" onPress={signOut} />
      </View>

      {loading && !dashboard ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={dashboard?.medications ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          ListHeaderComponent={<Text style={styles.section}>Your medications</Text>}
          ListEmptyComponent={<Text style={styles.empty}>No medications yet. Add one below.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.dosage ?? 'as prescribed'} • {item.frequency_per_day}x/day
                  {item.scheduled_times.length ? ` • ${item.scheduled_times.join(', ')}` : ''}
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                <Button
                  title={callingId === item.id ? 'Calling...' : 'Call me now'}
                  onPress={() => onCallNow(item.id)}
                  disabled={callingId === item.id}
                />
                <Button title="Remove" color="#dc2626" onPress={() => onDelete(item.id)} />
              </View>
            </View>
          )}
          ListFooterComponent={
            <>
              <Button title="Add medication" onPress={() => router.push('/medication-form')} />
              <Text style={styles.section}>Recent activity</Text>
              {(dashboard?.recent_logs ?? []).length === 0 ? (
                <Text style={styles.empty}>No logged doses yet.</Text>
              ) : (
                dashboard!.recent_logs.map((log) => (
                  <View key={log.id} style={styles.logRow}>
                    <Text>{new Date(log.scheduled_for).toLocaleString()}</Text>
                    <Text style={styles.logStatus}>{log.status}</Text>
                  </View>
                ))
              )}
            </>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  greeting: { fontSize: 20, fontWeight: '600' },
  section: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  empty: { color: '#666', marginBottom: 12 },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { color: '#555', marginTop: 2 },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logStatus: { textTransform: 'capitalize', fontWeight: '500' },
});
