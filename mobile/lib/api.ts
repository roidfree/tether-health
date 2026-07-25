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

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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

export type Dashboard = {
  medications: Medication[];
  recent_logs: MedicationLog[];
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
  dosage?: string;
  instructions?: string;
  frequency_per_day?: number;
  scheduled_times?: string[];
  days_of_week?: number[];
};

export function listMedications(token: string) {
  return request<Medication[]>('/medications', { token });
}

export function createMedication(token: string, input: MedicationInput) {
  return request<Medication>('/medications', { method: 'POST', body: input, token });
}

export function updateMedication(token: string, id: string, updates: Partial<MedicationInput> & { active?: boolean }) {
  return request<Medication>(`/medications/${id}`, { method: 'PUT', body: updates, token });
}

export function deleteMedication(token: string, id: string) {
  return request<void>(`/medications/${id}`, { method: 'DELETE', token });
}

// --- Dashboard / logs -------------------------------------------------------

export function getDashboard(token: string) {
  return request<Dashboard>('/dashboard', { token });
}

export function updateLog(token: string, logId: string, status: MedicationLog['status']) {
  return request<MedicationLog>(`/logs/${logId}`, { method: 'PUT', body: { status }, token });
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
