from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.db.supabase_client import get_service_client
from app.deps import CurrentUser, get_current_user
from app.models.schemas import CallOutcomeUpdate, CallStartRequest, CallStartResponse
from app.services.call_service import create_room_and_dispatch, mint_access_token

router = APIRouter(prefix="/calls", tags=["calls"])

# A call is only worth resuming from the app's perspective for a short window
# after creation - older "ringing" rows are stale (missed) calls.
ACTIVE_CALL_WINDOW = timedelta(minutes=5)


@router.post("/start", response_model=CallStartResponse, status_code=status.HTTP_201_CREATED)
async def start_call(
    payload: CallStartRequest, current_user: CurrentUser = Depends(get_current_user)
):
    settings = get_settings()
    client = get_service_client()

    medication = (
        client.table("medications").select("*").eq("id", payload.medication_id).single().execute()
    )
    if not medication.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

    # The call always rings the medication owner's phone, whoever starts it -
    # a linked carer can trigger it for their cared-for, but never joins the
    # room themselves (the access token below is minted for the owner).
    owner_id = medication.data["user_id"]
    if owner_id != current_user.id:
        link = (
            client.table("carer_links")
            .select("id")
            .eq("carer_id", current_user.id)
            .eq("cared_for_id", owner_id)
            .execute()
        )
        if not link.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

    profile = client.table("profiles").select("*").eq("id", owner_id).single().execute()

    result = await create_room_and_dispatch(
        client,
        settings,
        user_id=owner_id,
        medication=medication.data,
        profile=profile.data,
        medication_log_id=payload.medication_log_id,
    )

    token = mint_access_token(
        settings,
        user_id=owner_id,
        name=profile.data.get("full_name", "Patient") if profile.data else "Patient",
        room_name=result["room_name"],
    )

    return CallStartResponse(
        call_id=result["call_id"],
        room_name=result["room_name"],
        livekit_url=settings.livekit_url,
        access_token=token,
        medication_name=medication.data["name"],
    )


@router.get("/active", response_model=CallStartResponse | None)
def get_active_call(current_user: CurrentUser = Depends(get_current_user)):
    """Lets the app notice a scheduler-triggered call and join it.

    Polled by the mobile dashboard; returns the most recent call still worth
    joining (created/ringing/in_progress, within ACTIVE_CALL_WINDOW), or null.
    """
    settings = get_settings()
    client = get_service_client()

    cutoff = (datetime.now(timezone.utc) - ACTIVE_CALL_WINDOW).isoformat()
    result = (
        client.table("calls")
        .select("*")
        .eq("user_id", current_user.id)
        .in_("status", ["created", "ringing", "in_progress"])
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None

    call = result.data[0]
    profile = (
        client.table("profiles").select("*").eq("id", current_user.id).single().execute()
    )

    medication_name = None
    if call.get("medication_id"):
        medication = (
            client.table("medications").select("name").eq("id", call["medication_id"]).single().execute()
        )
        medication_name = medication.data["name"] if medication.data else None

    token = mint_access_token(
        settings,
        user_id=current_user.id,
        name=profile.data.get("full_name", "Patient") if profile.data else "Patient",
        room_name=call["room_name"],
    )

    return CallStartResponse(
        call_id=call["id"],
        room_name=call["room_name"],
        livekit_url=settings.livekit_url,
        access_token=token,
        medication_name=medication_name,
    )


@router.put("/{call_id}/outcome")
def update_call_outcome(
    call_id: str, payload: CallOutcomeUpdate, current_user: CurrentUser = Depends(get_current_user)
):
    client = get_service_client()
    updates = {"status": payload.status, "outcome": payload.outcome}
    if payload.status == "in_progress":
        updates["started_at"] = datetime.now(timezone.utc).isoformat()
    if payload.status in ("completed", "missed", "failed"):
        updates["ended_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        client.table("calls")
        .update(updates)
        .eq("id", call_id)
        .eq("user_id", current_user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return result.data[0]
