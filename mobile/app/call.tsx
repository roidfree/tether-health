import {
  BarVisualizer,
  LiveKitRoom,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ConnectionState, Track } from 'livekit-client';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

import AuthBackground from '../components/AuthBackground';
import CallControlButton from '../components/CallControlButton';
import PulseDot from '../components/PulseDot';
import * as api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';
import { colors, fonts } from '../lib/theme';

export default function Call() {
  const { callId, livekitUrl, accessToken, callUUID } = useLocalSearchParams<{
    callId: string;
    livekitUrl: string;
    accessToken: string;
    callUUID?: string;
  }>();

  // The audio session is owned by CallKit for calls answered through its
  // native UI (which is every call now - see lib/callkeep.tsx) - it's
  // started/stopped there in response to CallKit's own activation events,
  // not here on screen mount.

  return (
    <LiveKitRoom serverUrl={livekitUrl} token={accessToken} connect audio video={false}>
      <CallScreen callId={callId} callUUID={callUUID} />
    </LiveKitRoom>
  );
}

function CallScreen({ callId, callUUID }: { callId: string; callUUID?: string }) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  // The agent's own microphone track (its TTS voice) - passed to
  // BarVisualizer below so the waveform reacts to the AI's actual audio
  // rather than just animating decoratively. Excludes our own mic track, of
  // which there's also one in this list.
  const microphoneTracks = useTracks([Track.Source.Microphone]);
  const agentAudioTrack = microphoneTracks.find((ref) => !ref.participant.isLocal);

  const agentConnected = remoteParticipants.length > 0;
  const hasConnectedRef = useRef(false);
  const hasLeftRef = useRef(false);

  let statusLabel: string;
  switch (connectionState) {
    case ConnectionState.Connecting:
      statusLabel = t('connecting');
      break;
    case ConnectionState.Connected:
      statusLabel = agentConnected ? t('connected') : t('waitingForAgent');
      break;
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      statusLabel = t('reconnecting');
      break;
    default:
      statusLabel = t('disconnected');
  }

  const endCall = async () => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
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

  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      hasConnectedRef.current = true;
      return;
    }
    // The agent ends the call by closing the LiveKit room server-side, which
    // drops us to Disconnected - leave the call screen automatically instead
    // of leaving the user stuck looking at "Disconnected".
    if (connectionState === ConnectionState.Disconnected && hasConnectedRef.current) {
      endCall();
    }
  }, [connectionState]);

  return (
    <AuthBackground>
      <View style={styles.container}>
        <View style={styles.liveBadge}>
          <PulseDot />
          <Text style={styles.liveBadgeText}>TETHER · LIVE</Text>
        </View>

        <BarVisualizer
          trackRef={agentAudioTrack}
          barCount={26}
          options={{ barColor: colors.accent, barWidth: 4, barBorderRadius: 2, minHeight: 0.12, maxHeight: 1 }}
          style={styles.waveform}
        />

        <Text style={styles.status}>{statusLabel}</Text>

        <View style={styles.controls}>
          <CallControlButton
            icon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
            label={isMicrophoneEnabled ? t('mute') : t('unmute')}
            active={!isMicrophoneEnabled}
            onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          />
          <CallControlButton
            icon="call"
            rotateIcon={135}
            label={t('endCall')}
            variant="danger"
            onPress={endCall}
          />
        </View>
      </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 13,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  liveBadgeText: { color: colors.accent, fontSize: 12, fontFamily: fonts.bold, letterSpacing: 0.8 },
  waveform: { height: 56, width: '100%' },
  status: { color: colors.textOnPrimary, fontSize: 24, fontFamily: fonts.extraBold, letterSpacing: -0.4 },
  controls: { flexDirection: 'row', gap: 64, marginTop: 64 },
});
