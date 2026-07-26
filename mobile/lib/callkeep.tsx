// Shows a real native iOS/Android incoming-call screen (CallKit /
// ConnectionService) for reminder calls the backend has started, by polling
// GET /calls/active while the app is open. This only works in the
// foreground - CallKit/ConnectionService also require a real device, they
// don't work in a simulator.
import { AudioSession } from '@livekit/react-native';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

import * as api from './api';
import { useAuth } from './auth';
import { useTranslation } from './i18n';

const POLL_INTERVAL_MS = 6000;

let didSetup = false;

function setupCallKeepOnce() {
  if (didSetup) return;
  didSetup = true;
  RNCallKeep.setup({
    ios: {
      appName: 'Tether Health',
      supportsVideo: false,
      includesCallsInRecents: false,
    },
    android: {
      alertTitle: 'Permissions required',
      alertDescription: 'Tether Health needs permission to display call notifications',
      cancelButton: 'Cancel',
      okButton: 'OK',
      additionalPermissions: [],
    },
  }).catch((err: unknown) => console.warn('CallKeep setup failed', err));
}

type PendingCall = {
  callId: string;
  roomName: string;
  livekitUrl: string;
  accessToken: string;
};

export function useCallKeepReminders() {
  const { token, profile } = useAuth();
  const { t } = useTranslation();
  const seenCallIds = useRef(new Set<string>());
  const pendingCalls = useRef(new Map<string, PendingCall>());
  const seenAlertIds = useRef(new Set<string>());
  // Carers never receive calls themselves (see backend/app/routers/calls.py) -
  // only the cared-for's own device should ever display an incoming call.
  const isCarer = profile?.role === 'carer';

  useEffect(() => {
    setupCallKeepOnce();

    const onAnswer = ({ callUUID }: { callUUID: string }) => {
      const call = pendingCalls.current.get(callUUID);
      if (!call) return;
      router.push({
        pathname: '/call',
        params: {
          callId: call.callId,
          roomName: call.roomName,
          livekitUrl: call.livekitUrl,
          accessToken: call.accessToken,
          callUUID,
        },
      });
    };

    const onEndOrDecline = ({ callUUID }: { callUUID: string }) => {
      const call = pendingCalls.current.get(callUUID);
      pendingCalls.current.delete(callUUID);
      if (call && token) {
        api.updateCallOutcome(token, call.callId, 'missed').catch(() => {});
      }
    };

    const answerListener = RNCallKeep.addEventListener('answerCall', onAnswer);
    const endListener = RNCallKeep.addEventListener('endCall', onEndOrDecline);

    // CallKit owns the AVAudioSession for a call answered through its native
    // UI - starting/stopping the LiveKit audio session ourselves on screen
    // mount races CallKit's own activation and can leave the session
    // configured but not actually routed, so the room connects but no audio
    // is heard. Only (de)activate in response to CallKit's own events.
    const activateListener = RNCallKeep.addEventListener('didActivateAudioSession', () => {
      AudioSession.startAudioSession().catch((err) => console.warn('Failed to start audio session', err));
    });
    const deactivateListener = RNCallKeep.addEventListener('didDeactivateAudioSession', () => {
      AudioSession.stopAudioSession().catch(() => {});
    });

    return () => {
      answerListener.remove();
      endListener.remove();
      activateListener.remove();
      deactivateListener.remove();
    };
  }, [token]);

  useEffect(() => {
    if (!token || isCarer) return;

    const poll = async () => {
      try {
        const active = await api.getActiveCall(token);
        if (!active || seenCallIds.current.has(active.call_id)) return;

        seenCallIds.current.add(active.call_id);
        pendingCalls.current.set(active.call_id, {
          callId: active.call_id,
          roomName: active.room_name,
          livekitUrl: active.livekit_url,
          accessToken: active.access_token,
        });

        RNCallKeep.displayIncomingCall(
          active.call_id,
          active.medication_name ?? 'Tether Health',
          active.medication_name ? `${active.medication_name} reminder` : 'Medication reminder',
          'generic',
          false
        );
      } catch {
        // best-effort polling; ignore transient network errors
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, isCarer]);

  // Carers don't get calls - they get notified here instead, foreground-only
  // (no push notification setup in this app - see the carer-accounts plan).
  useEffect(() => {
    if (!token || !isCarer) return;

    const poll = async () => {
      try {
        const alerts = await api.getCarerAlerts(token);
        const unseen = alerts.filter((alert) => !seenAlertIds.current.has(alert.id));
        if (unseen.length === 0) return;
        for (const alert of unseen) seenAlertIds.current.add(alert.id);

        const first = unseen[0];
        Alert.alert(
          t('alertsSection'),
          `${first.cared_for_name} - ${first.medication_name} (${t(
            first.status === 'missed' ? 'statusMissed' : 'statusSnoozed'
          )})`
        );
      } catch {
        // best-effort polling; ignore transient network errors
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, isCarer]);
}
