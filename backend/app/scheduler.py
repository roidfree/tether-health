"""Background loop that fires a reminder call when a medication's
scheduled_times matches the current time.

Polls rather than using precise per-medication timers - simple and reliable
enough for a hackathon scope. Runs inside the FastAPI process.

scheduled_times are entered on the phone as plain local wall-clock strings
(no timezone info collected at onboarding), so comparisons here use the
backend server's local timezone rather than UTC - correct as long as the
backend runs in the same timezone as the user, which holds for this
single-location hackathon setup.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.db.supabase_client import get_service_client
from app.services.call_service import create_room_and_dispatch

logger = logging.getLogger("tether.scheduler")

POLL_INTERVAL_SECONDS = 20


async def check_and_trigger_reminders() -> None:
    settings = get_settings()
    client = get_service_client()

    now = datetime.now().astimezone()
    current_hhmm = now.strftime("%H:%M")
    # schema convention: days_of_week is 0=Sunday..6=Saturday, but Python's
    # weekday() is 0=Monday..6=Sunday - convert.
    current_dow = (now.weekday() + 1) % 7

    medications = client.table("medications").select("*").eq("active", True).execute()

    for medication in medications.data:
        scheduled_times = medication.get("scheduled_times") or []
        if current_hhmm not in scheduled_times:
            continue

        days_of_week = medication.get("days_of_week") or []
        if days_of_week and current_dow not in days_of_week:
            continue

        hour, minute = int(current_hhmm[:2]), int(current_hhmm[3:])
        scheduled_for = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        window_end = scheduled_for + timedelta(minutes=1)

        already_triggered = (
            client.table("medication_logs")
            .select("id")
            .eq("medication_id", medication["id"])
            .gte("scheduled_for", scheduled_for.isoformat())
            .lt("scheduled_for", window_end.isoformat())
            .execute()
        )
        if already_triggered.data:
            continue

        log_row = (
            client.table("medication_logs")
            .insert(
                {
                    "user_id": medication["user_id"],
                    "medication_id": medication["id"],
                    "scheduled_for": scheduled_for.isoformat(),
                    "status": "pending",
                }
            )
            .execute()
        )
        medication_log_id = log_row.data[0]["id"]

        profile = (
            client.table("profiles")
            .select("*")
            .eq("id", medication["user_id"])
            .single()
            .execute()
        )

        try:
            await create_room_and_dispatch(
                client,
                settings,
                user_id=medication["user_id"],
                medication=medication,
                profile=profile.data,
                medication_log_id=medication_log_id,
            )
            logger.info(
                "Triggered scheduled reminder call: medication=%s (%s) user=%s time=%s",
                medication["name"],
                medication["id"],
                medication["user_id"],
                current_hhmm,
            )
        except Exception:
            logger.exception(
                "Failed to trigger scheduled reminder for medication %s", medication["id"]
            )


async def check_and_trigger_snoozed_callbacks() -> None:
    """Fires the actual callback call once a "call me back in N minutes"
    snooze has come due. snoozed_until is a real instant (timestamptz), so
    unlike the wall-clock HH:MM matching above this compares fine in UTC.
    """
    settings = get_settings()
    client = get_service_client()
    now = datetime.now(timezone.utc)

    due = (
        client.table("medication_logs")
        .select("*")
        .eq("status", "snoozed")
        .lte("snoozed_until", now.isoformat())
        .execute()
    )

    for log in due.data:
        # Flip out of 'snoozed' immediately so a slow call dispatch can't
        # cause the next tick to pick up and fire this same log twice.
        client.table("medication_logs").update(
            {"status": "pending", "snoozed_until": None}
        ).eq("id", log["id"]).execute()

        medication = (
            client.table("medications").select("*").eq("id", log["medication_id"]).single().execute()
        )
        if not medication.data:
            continue

        profile = (
            client.table("profiles").select("*").eq("id", log["user_id"]).single().execute()
        )

        try:
            await create_room_and_dispatch(
                client,
                settings,
                user_id=log["user_id"],
                medication=medication.data,
                profile=profile.data,
                medication_log_id=log["id"],
            )
            logger.info(
                "Triggered snoozed callback: medication=%s medication_log=%s user=%s",
                medication.data["name"],
                log["id"],
                log["user_id"],
            )
        except Exception:
            logger.exception("Failed to trigger snoozed callback for medication_log %s", log["id"])


async def run_scheduler_loop() -> None:
    while True:
        try:
            await check_and_trigger_reminders()
            await check_and_trigger_snoozed_callbacks()
        except Exception:
            logger.exception("Scheduler tick failed")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
