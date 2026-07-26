"""LiveKit voice agent that places encouraging medication reminder calls.

Dispatched per-call by the backend (see backend/app/routers/calls.py) with
job metadata describing which user, which medication, and the current time.
Run with:  python -m agent.main dev
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import deepgram, elevenlabs, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from agent.supabase_sink import log_call_outcome, update_medication_log

load_dotenv()
logger = logging.getLogger("medication-reminder-agent")

AGENT_NAME = "medication-reminder-agent"

# Kept small and matched to what both Deepgram STT and ElevenLabs TTS support
# well - not an exhaustive list of every language either service technically
# supports. Mirrors mobile/lib/languages.ts.
LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "hi": "Hindi",
    "zh": "Mandarin Chinese",
    "ja": "Japanese",
}


def build_instructions(metadata: dict) -> str:
    medication = metadata.get("medication", {})
    user_name = metadata.get("user_name") or "there"
    current_time = metadata.get("current_time_iso")
    attempt_number = metadata.get("attempt_number", 1)
    language_name = LANGUAGE_NAMES.get(metadata.get("preferred_language", "en"), "English")
    time_str = current_time
    try:
        time_str = datetime.fromisoformat(current_time).strftime("%-I:%M %p")
    except Exception:
        pass

    if attempt_number <= 1:
        urgency_note = "This is the first call about this dose - stay light, easygoing, no pressure."
    elif attempt_number == 2:
        urgency_note = (
            "This is a follow-up call - they already asked to be called back once about this same "
            "dose. Acknowledge that briefly ('following up like you asked') and be a little more direct "
            "about getting a real answer this time, while staying warm."
        )
    else:
        urgency_note = (
            f"This is call attempt #{attempt_number} about this same dose - there have been multiple "
            "callbacks already. Be noticeably more persistent and direct: acknowledge this is a repeat "
            "check-in, gently make clear it's important to stop pushing it back further, but stay "
            "supportive and never scold or guilt-trip."
        )

    return f"""You are a warm, encouraging voice companion calling {user_name} to help them
stay on top of their medication. This is NOT a robotic reminder line - talk like a
supportive friend checking in, not a compliance system.

Speak entirely in {language_name} - every reply, starting with your first greeting, must be in
{language_name}, not English, unless {user_name} responds in a different language themselves, in
which case switch to match them.

Context for this call:
- Medication: {medication.get('name')}
- Dosage: {medication.get('dosage') or 'as prescribed'}
- Instructions: {medication.get('instructions') or 'none specified'}
- Usual frequency: {medication.get('frequency_per_day')} time(s) per day, scheduled around {medication.get('scheduled_times')}
- Current time: {time_str}
- Call attempt: #{attempt_number} for this dose. {urgency_note}

Conversation goals:
1. Greet {user_name} warmly and briefly mention it's time for their {medication.get('name')}.
2. Ask if they've taken it or are about to.
3. If yes -> celebrate briefly and use the `mark_medication_taken` tool, then wrap up.
4. If not yet -> ask specifically what the earliest time is that they could take it (e.g. "in 10
   minutes", "in about an hour", "tonight around 8"). Work out exactly how many minutes from now that
   is, and call `snooze_reminder` with that exact number - never default to a flat 5 minutes unless
   that's genuinely what they said.
5. If they say they're skipping it or missed it entirely -> be supportive and non-judgmental, never
   scold. Use the `mark_medication_missed` tool.
6. Keep the call short and natural. `mark_medication_taken`, `mark_medication_missed`, and
   `snooze_reminder` each end the call automatically right after you use them - say your goodbye in
   the same reply as using the tool, don't wait for a separate turn. Only use the separate `end_call`
   tool if the conversation needs to end without any of those three ever being confirmed.

CRITICAL: saying in {language_name} that you're logging or marking something (e.g. "I'll mark that
down", "noting that now") is NOT the same as actually doing it, and does nothing on its own - nothing
is recorded unless you actually call the real tool. Every single time {user_name} confirms taken,
missed, or a callback time, you must invoke the matching tool (mark_medication_taken,
mark_medication_missed, or snooze_reminder) as a real function call in that same turn - never just
describe it in words. This applies no matter which language you're speaking.

Tone: encouraging, warm, brief. Never lecture or guilt-trip. Adherence should feel
like support, not policing. {urgency_note}"""


class MedicationReminderAgent(Agent):
    def __init__(self, metadata: dict, job_ctx: JobContext):
        super().__init__(instructions=build_instructions(metadata))
        self.metadata = metadata
        self.job_ctx = job_ctx
        # Set by mark_medication_taken/mark_medication_missed/snooze_reminder
        # once the user has given a real answer - NOT by end_call, which is
        # used precisely for the case where the call ends without one. Lets
        # the shutdown callback below tell "resolved" hangups apart from the
        # user just dropping the call (or never answering at all).
        self.outcome_resolved = False

    def _hangup_after_reply(self, context: RunContext) -> None:
        """Ends the call once the current reply finishes playing.

        Called directly from every outcome tool (taken/missed/snoozed) so the
        call ends automatically the moment that outcome is confirmed, rather
        than relying on the model separately remembering to call `end_call`
        as a second step afterward.
        """

        async def hangup():
            # Let the farewell reply (generated from this tool's result)
            # finish playing before actually closing the room - deleting it
            # immediately would cut the agent off mid-sentence and drop the
            # user's call with no goodbye.
            await context.speech_handle.wait_for_playout()
            await self.job_ctx.delete_room()

        asyncio.create_task(hangup())

    @function_tool
    async def mark_medication_taken(self, context: RunContext) -> str:
        """Call when the user confirms they have taken (or are immediately taking) their medication.
        This ends the call automatically right after - just give a brief warm goodbye in the same
        reply, don't call end_call separately."""
        self.outcome_resolved = True
        await update_medication_log(self.metadata, status="taken")
        await log_call_outcome(self.metadata, status="completed")
        self._hangup_after_reply(context)
        return "Logged as taken. Say a brief warm goodbye now - the call will end automatically after."

    @function_tool
    async def mark_medication_missed(self, context: RunContext) -> str:
        """Call when the user indicates they are skipping or missing this dose. This ends the call
        automatically right after - just give a brief warm goodbye in the same reply, don't call
        end_call separately."""
        self.outcome_resolved = True
        await update_medication_log(self.metadata, status="missed")
        await log_call_outcome(self.metadata, status="completed")
        self._hangup_after_reply(context)
        return "Logged as missed. Say a brief warm goodbye now - the call will end automatically after."

    @function_tool
    async def snooze_reminder(self, context: RunContext, minutes: int) -> str:
        """Call once the user has given a specific earliest time they could take it instead of right
        now. Convert whatever they said into whole minutes from now yourself before calling this -
        e.g. "in 10 minutes" -> 10, "in about an hour" -> 60, "tonight around 8" -> the minutes until
        then. Always pass the real number they implied, not a default. This ends the call
        automatically right after - just give a brief warm goodbye in the same reply, don't call
        end_call separately."""
        self.outcome_resolved = True
        await update_medication_log(self.metadata, status="snoozed", snooze_minutes=minutes)
        await log_call_outcome(self.metadata, status="completed")
        self._hangup_after_reply(context)
        return f"Okay, I'll follow up in {minutes} minutes. Say a brief warm goodbye now - the call will end automatically after."

    @function_tool
    async def end_call(self, context: RunContext) -> str:
        """Call to end the conversation if it needs to end for some other reason without any of the
        outcome tools (taken/missed/snoozed) being used - e.g. the user hangs up the conversation
        without giving a clear answer. Not needed after mark_medication_taken, mark_medication_missed,
        or snooze_reminder - those already end the call on their own."""
        await log_call_outcome(self.metadata, status="completed")
        self._hangup_after_reply(context)
        return "Ending the call now."

    async def handle_unresolved_shutdown(self, reason: str) -> None:
        """Registered as a job shutdown callback - fires however the call
        ends (user hangs up mid-conversation, they never pick up at all, the
        room times out, etc). If none of the outcome tools ever fired, the
        dose is still unresolved - treat it exactly like a user-requested
        5 minute callback so the existing snoozed-callback scheduler
        (backend/app/scheduler.py) automatically retries, and the existing
        carer alert rule (2+ attempts on the same dose) kicks in on its own
        once retries stack up."""
        if self.outcome_resolved:
            return
        logger.info("Call ended without a resolved outcome (reason=%s) - scheduling a 5 minute callback", reason)
        await update_medication_log(self.metadata, status="snoozed", snooze_minutes=5)
        await log_call_outcome(self.metadata, status="completed", outcome="no_response")


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    raw_metadata = ctx.job.metadata or ctx.room.metadata or "{}"
    try:
        metadata = json.loads(raw_metadata)
    except json.JSONDecodeError:
        logger.warning("Could not parse job metadata, falling back to empty context")
        metadata = {}

    await log_call_outcome(metadata, status="in_progress")

    preferred_language = metadata.get("preferred_language", "en")
    language_name = LANGUAGE_NAMES.get(preferred_language, "English")

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        # nova-2 covers this language set more reliably than the newer
        # default model, which launched English-first.
        stt=deepgram.STT(model="nova-2", language=preferred_language),
        llm=openai.LLM(model="gpt-4o-mini", api_key=os.environ["OPENAI_API_KEY"]),
        tts=elevenlabs.TTS(
            api_key=os.environ["ELEVENLABS_API_KEY"],
            voice_id=os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
            language=preferred_language,
        ),
        # Explicit local model - AgentSession's default otherwise silently
        # uses a cloud-hosted turn detector (agent-gateway.livekit.cloud),
        # which has been intermittently hanging for minutes with zero
        # progress (confirmed in logs: STT connects fine, then nothing until
        # a "session closed due to agent inactivity" timeout kills the job) -
        # the agent picks up but never speaks. Running fully locally removes
        # that remote dependency entirely.
        turn_detection=MultilingualModel(),
    )

    agent = MedicationReminderAgent(metadata, ctx)
    ctx.add_shutdown_callback(agent.handle_unresolved_shutdown)

    await session.start(agent=agent, room=ctx.room)

    greeting_name = metadata.get("user_name") or "there"
    await session.generate_reply(
        instructions=f"Greet {greeting_name} warmly in {language_name} and bring up their medication reminder."
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm, agent_name=AGENT_NAME)
    )
