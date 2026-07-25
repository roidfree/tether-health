// Shows a real native iOS/Android incoming-call screen (CallKit /
// ConnectionService) for reminder calls the backend has started, by polling
// GET /calls/active while the app is open. This only works in the
// foreground - CallKit/ConnectionService also require a real device, they
// don't work in a simulator.
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import RNCallKeep from 'react-native-callkeep';

import * as api from './api';
import { useAuth } from './auth';

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
  const { token } = useAuth();
  const seenCallIds = useRef(new Set<string>());
  const pendingCalls = useRef(new Map<string, PendingCall>());

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

    return () => {
      answerListener.remove();
      endListener.remove();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

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
  }, [token]);
}
