"""LiveKit voice agent that places encouraging medication reminder calls.

Dispatched per-call by the backend (see backend/app/routers/calls.py) with
job metadata describing which user, which medication, and the current time.
Run with:  python -m agent.main dev
"""

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
from livekit.plugins import deepgram, elevenlabs, google, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from agent.supabase_sink import log_call_outcome, update_medication_log

load_dotenv()
logger = logging.getLogger("medication-reminder-agent")

AGENT_NAME = "medication-reminder-agent"


def build_instructions(metadata: dict) -> str:
    medication = metadata.get("medication", {})
    user_name = metadata.get("user_name") or "there"
    current_time = metadata.get("current_time_iso")
    time_str = current_time
    try:
        time_str = datetime.fromisoformat(current_time).strftime("%-I:%M %p")
    except Exception:
        pass

    return f"""You are a warm, encouraging voice companion calling {user_name} to help them
stay on top of their medication. This is NOT a robotic reminder line - talk like a
supportive friend checking in, not a compliance system.

Context for this call:
- Medication: {medication.get('name')}
- Dosage: {medication.get('dosage') or 'as prescribed'}
- Instructions: {medication.get('instructions') or 'none specified'}
- Usual frequency: {medication.get('frequency_per_day')} time(s) per day, scheduled around {medication.get('scheduled_times')}
- Current time: {time_str}

Conversation goals:
1. Greet {user_name} warmly and briefly mention it's time for their {medication.get('name')}.
2. Ask if they've taken it or are about to.
3. If yes -> celebrate briefly and use the `mark_medication_taken` tool, then wrap up.
4. If not yet but they will soon -> encourage them, ask if they want a call back in 5
   minutes, and use the `snooze_reminder` tool if so.
5. If they say they're skipping it or missed it -> be supportive and non-judgmental,
   never scold. Use the `mark_medication_missed` tool, and gently suggest they take it
   as soon as it's safe to do so, without being pushy.
6. Keep the call short and natural. When the conversation reaches a natural close, use
   the `end_call` tool.

Tone: encouraging, warm, brief. Never lecture or guilt-trip. Adherence should feel
like support, not policing."""


class MedicationReminderAgent(Agent):
    def __init__(self, metadata: dict):
        super().__init__(instructions=build_instructions(metadata))
        self.metadata = metadata

    @function_tool
    async def mark_medication_taken(self, context: RunContext) -> str:
        """Call when the user confirms they have taken (or are immediately taking) their medication."""
        await update_medication_log(self.metadata, status="taken")
        return "Logged as taken."

    @function_tool
    async def mark_medication_missed(self, context: RunContext) -> str:
        """Call when the user indicates they are skipping or missing this dose."""
        await update_medication_log(self.metadata, status="missed")
        return "Logged as missed."

    @function_tool
    async def snooze_reminder(self, context: RunContext, minutes: int = 5) -> str:
        """Call when the user asks to be called back later instead of taking it right now."""
        await update_medication_log(self.metadata, status="snoozed", snooze_minutes=minutes)
        return f"Okay, I'll follow up in {minutes} minutes."

    @function_tool
    async def end_call(self, context: RunContext) -> str:
        """Call to end the conversation once the reminder is resolved."""
        await log_call_outcome(self.metadata, status="completed")
        return "Ending the call now."


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

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(),
        llm=google.LLM(model="gemini-flash-latest", api_key=os.environ["GEMINI_API_KEY"]),
        tts=elevenlabs.TTS(
            api_key=os.environ["ELEVENLABS_API_KEY"],
            voice_id=os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
        ),
        turn_detection=MultilingualModel(),
    )

    await session.start(agent=MedicationReminderAgent(metadata), room=ctx.room)

    greeting_name = metadata.get("user_name") or "there"
    await session.generate_reply(
        instructions=f"Greet {greeting_name} warmly and bring up their medication reminder."
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm, agent_name=AGENT_NAME)
    )
