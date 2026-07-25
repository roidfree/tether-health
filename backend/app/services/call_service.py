"""Shared logic for starting a reminder call - used by both the on-demand
/calls/start endpoint and the scheduler that fires calls at a medication's
scheduled time.
"""

import json
import uuid
from datetime import datetime, timezone

from livekit import api

from app.config import Settings


async def create_room_and_dispatch(
    client,
    settings: Settings,
    *,
    user_id: str,
    medication: dict,
    profile: dict | None,
    medication_log_id: str | None = None,
) -> dict:
    room_name = f"reminder-{uuid.uuid4().hex[:12]}"

    call_row = (
        client.table("calls")
        .insert(
            {
                "user_id": user_id,
                "medication_id": medication["id"],
                "medication_log_id": medication_log_id,
                "room_name": room_name,
                "status": "created",
            }
        )
        .execute()
    )
    call = call_row.data[0]

    # Context the agent needs to run the reminder call: which medication,
    # its dosage/frequency, the current time, and who it's calling.
    metadata = {
        "call_id": call["id"],
        "user_id": user_id,
        "user_name": profile.get("full_name") if profile else None,
        "preferred_language": profile.get("preferred_language", "en") if profile else "en",
        "medication": {
            "id": medication["id"],
            "name": medication["name"],
            "dosage": medication.get("dosage"),
            "instructions": medication.get("instructions"),
            "frequency_per_day": medication.get("frequency_per_day"),
            "scheduled_times": medication.get("scheduled_times", []),
        },
        "current_time_iso": datetime.now(timezone.utc).isoformat(),
    }

    lkapi = api.LiveKitAPI(
        url=settings.livekit_url,
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )
    try:
        await lkapi.room.create_room(
            api.CreateRoomRequest(name=room_name, metadata=json.dumps(metadata))
        )
        # Dispatch the reminder agent into the room so it's waiting when the
        # user's client connects.
        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name="medication-reminder-agent",
                room=room_name,
                metadata=json.dumps(metadata),
            )
        )
    finally:
        await lkapi.aclose()

    client.table("calls").update({"status": "ringing"}).eq("id", call["id"]).execute()

    return {"call_id": call["id"], "room_name": room_name}


def mint_access_token(settings: Settings, *, user_id: str, name: str, room_name: str) -> str:
    return (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(user_id)
        .with_name(name)
        .with_grants(api.VideoGrants(room_join=True, room=room_name))
        .to_jwt()
    )
