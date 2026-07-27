// Thin wrapper around the Tether Health FastAPI backend.
// Set EXPO_PUBLIC_API_URL to the backend's LAN address when testing on a
// physical device (localhost only works in a simulator on the same machine).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Access tokens expire after an hour (Supabase default) - lib/auth.tsx
// registers these so a 401 here can transparently refresh and retry once,
// instead of every screen surfacing "Invalid or expired token" whenever a
// session outlives that hour.
type SessionHandlers = {
  getRefreshToken: () => string | null;
  onRefreshed: (tokens: { accessToken: string; refreshToken: string | null }) => void;
  onSessionExpired: () => void;
};

let sessionHandlers: SessionHandlers | null = null;

export function configureSession(handlers: SessionHandlers) {
  sessionHandlers = handlers;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!sessionHandlers) return null;
  const refreshToken = sessionHandlers.getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const session = await refreshSession(refreshToken);
        sessionHandlers!.onRefreshed({ accessToken: session.access_token, refreshToken: session.refresh_token });
        return session.access_token;
      } catch {
        sessionHandlers!.onSessionExpired();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  if (entries.length === 0) return path;
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${path}?${qs}`;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const exec = async (authToken: string | null | undefined) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await exec(token);

  // login/signup/refresh itself never pass a token, so they're naturally
  // excluded here without needing a path check (which would otherwise also
  // wrongly exclude /auth/me - exactly the call that most needs this retry,
  // since that's what validates a possibly-stale stored token on startup).
  if (res.status === 401 && token) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) res = await exec(refreshedToken);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = data?.detail ? String(data.detail) : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

// --- Types mirroring backend/app/models/schemas.py --------------------

export type AuthResponse = {
  access_token: string;
  refresh_token: string | null;
  user_id: string;
  email: string | null;
};

export type Profile = {
  id: string;
  full_name: string;
  age: number | null;
  phone: string | null;
  preferred_language: string;
  accountability_partner_name: string | null;
  accountability_partner_relationship: string | null;
  onboarding_completed: boolean;
  role: 'independent' | 'carer';
  is_managed: boolean;
};

export type Medication = {
  id: string;
  user_id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  frequency_per_day: number;
  scheduled_times: string[];
  days_of_week: number[];
  active: boolean;
  created_at: string;
};

export type MedicationLog = {
  id: string;
  medication_id: string;
  scheduled_for: string;
  status: 'taken' | 'missed' | 'snoozed' | 'pending';
  responded_at: string | null;
  snoozed_until: string | null;
};

// The /dashboard endpoint additionally joins in the medication's name
// (backend/app/routers/logs.py) so screens can show it without a second
// round trip - PUT /logs/{id} returns the bare row, hence the split type.
export type DashboardLog = MedicationLog & { medication_name: string };

export type Dashboard = {
  medications: Medication[];
  recent_logs: DashboardLog[];
};

export type CallStartResponse = {
  call_id: string;
  room_name: string;
  livekit_url: string;
  access_token: string;
  medication_name: string | null;
};

// --- Auth ---------------------------------------------------------------

export function signUp(email: string, password: string, fullName: string) {
  return request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: { email, password, full_name: fullName },
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
}

export function getMe(token: string) {
  return request<Profile>('/auth/me', { token });
}

export function refreshSession(refreshToken: string) {
  return request<AuthResponse>('/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken } });
}

// --- Profile --------------------------------------------------------------

export function getProfile(token: string) {
  return request<Profile>('/profile', { token });
}

export function updateProfile(token: string, updates: Partial<Profile>) {
  return request<Profile>('/profile', { method: 'PUT', body: updates, token });
}

// --- Medications ----------------------------------------------------------

export type MedicationInput = {
  name: string;
  dosage?: string | null;
  instructions?: string | null;
  frequency_per_day?: number;
  scheduled_times?: string[];
  days_of_week?: number[];
};

export function listMedications(token: string, caredForId?: string) {
  return request<Medication[]>(withQuery('/medications', { cared_for_id: caredForId }), { token });
}

export function createMedication(token: string, input: MedicationInput, caredForId?: string) {
  return request<Medication>(withQuery('/medications', { cared_for_id: caredForId }), {
    method: 'POST',
    body: input,
    token,
  });
}

export function updateMedication(
  token: string,
  id: string,
  updates: Partial<MedicationInput> & { active?: boolean },
  caredForId?: string
) {
  return request<Medication>(withQuery(`/medications/${id}`, { cared_for_id: caredForId }), {
    method: 'PUT',
    body: updates,
    token,
  });
}

export function deleteMedication(token: string, id: string, caredForId?: string) {
  return request<void>(withQuery(`/medications/${id}`, { cared_for_id: caredForId }), {
    method: 'DELETE',
    token,
  });
}

// --- Dashboard / logs -------------------------------------------------------

export function getDashboard(token: string, caredForId?: string) {
  return request<Dashboard>(withQuery('/dashboard', { cared_for_id: caredForId }), { token });
}

export function updateLog(token: string, logId: string, status: MedicationLog['status'], caredForId?: string) {
  return request<MedicationLog>(withQuery(`/logs/${logId}`, { cared_for_id: caredForId }), {
    method: 'PUT',
    body: { status },
    token,
  });
}

// --- Calls (LiveKit) --------------------------------------------------------

export function startCall(token: string, medicationId: string, medicationLogId?: string) {
  return request<CallStartResponse>('/calls/start', {
    method: 'POST',
    body: { medication_id: medicationId, medication_log_id: medicationLogId },
    token,
  });
}

export function getActiveCall(token: string) {
  return request<CallStartResponse | null>('/calls/active', { token });
}

export function updateCallOutcome(
  token: string,
  callId: string,
  status: 'ringing' | 'in_progress' | 'completed' | 'missed' | 'failed',
  outcome?: string
) {
  return request<void>(`/calls/${callId}/outcome`, { method: 'PUT', body: { status, outcome }, token });
}

// --- Carer accounts ---------------------------------------------------------

export type CaredForSummary = {
  id: string;
  full_name: string;
};

export type CarerAlert = {
  id: string;
  cared_for_id: string;
  cared_for_name: string;
  medication_id: string;
  medication_name: string;
  scheduled_for: string;
  status: 'missed' | 'snoozed';
  attempt_count: number;
};

export type CarerInviteCode = {
  code: string;
  expires_at: string;
};

export function generateInviteCode(token: string) {
  return request<CarerInviteCode>('/carer/invite-code', { method: 'POST', token });
}

export function linkCarer(token: string, code: string) {
  return request<CaredForSummary>('/carer/link', { method: 'POST', body: { code }, token });
}

export function listCaredFor(token: string) {
  return request<CaredForSummary[]>('/carer/cared-for', { token });
}

export function getCarerAlerts(token: string, caredForId?: string) {
  return request<CarerAlert[]>(withQuery('/carer/alerts', { cared_for_id: caredForId }), { token });
}

export function unlinkCaredFor(token: string, caredForId: string) {
  return request<void>(`/carer/cared-for/${caredForId}`, { method: 'DELETE', token });
}
