# Tether Health

Voice-first AI application for medication reminders and adherence.

## Structure

- `backend/` - FastAPI app: auth, onboarding, medications, adherence logs, and
  call orchestration (creates LiveKit rooms + dispatches the reminder agent).
- `agent/` - LiveKit Python voice agent (Anthropic Claude + ElevenLabs TTS +
  Deepgram STT + Silero VAD + turn-detector) that runs the actual reminder call.
- `backend/sql/schema.sql` - Supabase schema (profiles, medications,
  medication_logs, calls) with RLS policies.
- `mobile/` - Expo app (auth, onboarding, dashboard, medication CRUD, in-app
  LiveKit call screen). Deliberately unstyled/basic - a functional skeleton
  meant to be redesigned on top of.

## Backend setup

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # or source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Supabase + LiveKit + Anthropic + ElevenLabs keys
```

1. In the Supabase SQL editor, run `backend/sql/schema.sql`.
2. Enable email/password auth in Supabase Auth settings.
3. Run the API:

```bash
uvicorn app.main:app --reload --app-dir backend
```

API is now at `http://localhost:8000` (`/health` for a liveness check).

## Voice agent setup

```bash
cd agent
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # same LiveKit project + provider keys as backend
python -m agent.main dev
```

The agent registers itself under the name `medication-reminder-agent` and
waits for explicit dispatches. `POST /calls/start` on the backend creates a
LiveKit room, dispatches this agent into it with the medication/user context
as job metadata, and returns a client access token so the mobile app can join
the same room as an in-app call (no PSTN/telephony involved).

`agent/test_join.py` is a manual test client - joins a room with a given
LiveKit URL + access token (e.g. the values returned by `/calls/start`) and
prints track/participant events, useful for verifying the agent is publishing
audio before the mobile app exists: `python agent/test_join.py <url> <token>`.

## Mobile app setup

```bash
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your backend's LAN IP
```

LiveKit's React Native SDK (`@livekit/react-native` / `-webrtc`) needs custom
native modules, so this **cannot run in Expo Go** - it needs a development
build. On the Mac connected to the iPhone:

```bash
npx expo prebuild        # generates ios/ and android/ native projects
npx expo run:ios         # builds and installs the dev client on the device
```

Once the dev client is installed, subsequent iteration is just:

```bash
npx expo start
```

Screens implemented: login/signup, onboarding (profile + first medication),
dashboard (medication list, recent adherence log, add/remove medication,
"Call me now"), and an active-call screen that joins the LiveKit room the
backend created and renders connection state + mute/end-call controls. All of
it is intentionally plain (`StyleSheet.create` with default components, no
theme) so it can be redesigned without fighting existing styling.

## Call flow

1. Mobile app calls `POST /calls/start` with a `medication_id`.
2. Backend creates a `calls` row, a LiveKit room, and dispatches the agent
   with metadata: user name, medication name/dosage/frequency, current time.
3. Backend returns a LiveKit access token; the app joins the room, the agent
   is already there and greets the user.
4. During the call the agent uses tools (`mark_medication_taken`,
   `mark_medication_missed`, `snooze_reminder`, `end_call`) that write
   directly to `medication_logs` / `calls` in Supabase.
