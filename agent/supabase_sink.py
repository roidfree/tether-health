"""Server-side Supabase writes made by the voice agent while a call is live.

Uses the service role key (same trust boundary as the FastAPI backend) since
the agent process isn't acting on behalf of an authenticated HTTP request.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from supabase import create_client

logger = logging.getLogger("medication-reminder-agent.supabase")

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        )
    return _client


async def update_medication_log(metadata: dict, status: str, snooze_minutes: int | None = None):
    log_id = metadata.get("medication_log_id")
    if not log_id:
        logger.info("No medication_log_id in metadata, skipping log update (status=%s)", status)
        return

    updates = {"status": status, "responded_at": datetime.now(timezone.utc).isoformat()}
    if status == "snoozed" and snooze_minutes:
        updates["snoozed_until"] = (
            datetime.now(timezone.utc) + timedelta(minutes=snooze_minutes)
        ).isoformat()

    def _write():
        _get_client().table("medication_logs").update(updates).eq("id", log_id).execute()

    await asyncio.to_thread(_write)


async def log_call_outcome(metadata: dict, status: str, outcome: str | None = None):
    call_id = metadata.get("call_id")
    if not call_id:
        return

    updates = {"status": status}
    if outcome:
        updates["outcome"] = outcome
    if status == "in_progress":
        updates["started_at"] = datetime.now(timezone.utc).isoformat()
    if status in ("completed", "missed", "failed"):
        updates["ended_at"] = datetime.now(timezone.utc).isoformat()

    def _write():
        _get_client().table("calls").update(updates).eq("id", call_id).execute()

    await asyncio.to_thread(_write)
