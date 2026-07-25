import {
  AudioSession,
  LiveKitRoom,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ConnectionState } from 'livekit-client';
import { useEffect } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

import * as api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Call() {
  const { callId, roomName, livekitUrl, accessToken, callUUID } = useLocalSearchParams<{
    callId: string;
    roomName: string;
    livekitUrl: string;
    accessToken: string;
    callUUID?: string;
  }>();

  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  return (
    <LiveKitRoom serverUrl={livekitUrl} token={accessToken} connect audio video={false}>
      <CallScreen callId={callId} roomName={roomName} callUUID={callUUID} />
    </LiveKitRoom>
  );
}

function CallScreen({
  callId,
  roomName,
  callUUID,
}: {
  callId: string;
  roomName: string;
  callUUID?: string;
}) {
  const { token } = useAuth();
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  const agentConnected = remoteParticipants.length > 0;

  let statusLabel: string;
  switch (connectionState) {
    case ConnectionState.Connecting:
      statusLabel = 'Connecting...';
      break;
    case ConnectionState.Connected:
      statusLabel = agentConnected ? 'Connected' : 'Waiting for agent...';
      break;
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      statusLabel = 'Reconnecting...';
      break;
    default:
      statusLabel = 'Disconnected';
  }

  const endCall = async () => {
    if (token) {
      try {
        await api.updateCallOutcome(token, callId, 'completed');
      } catch {
        // best-effort; the agent also writes call status server-side
      }
    }
    if (callUUID) {
      RNCallKeep.endCall(callUUID);
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.roomName}>{roomName}</Text>
      <Text style={styles.status}>{statusLabel}</Text>

      <View style={styles.controls}>
        <Button
          title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        />
        <Button title="End call" color="#dc2626" onPress={endCall} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#111' },
  roomName: { color: '#aaa', fontSize: 12 },
  status: { color: 'white', fontSize: 22, fontWeight: '600' },
  controls: { flexDirection: 'row', gap: 16, marginTop: 32 },
});
