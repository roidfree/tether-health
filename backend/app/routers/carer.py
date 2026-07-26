"""Carer accounts: linking a carer to one or more cared-for people via a
short-lived invite code, and surfacing missed/delayed doses to the carer.
"""

import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db.supabase_client import get_service_client
from app.deps import CurrentUser, get_current_user
from app.models.schemas import (
    CaredForSummary,
    CarerAlert,
    CarerInviteCodeResponse,
    CarerLinkRequest,
)

router = APIRouter(prefix="/carer", tags=["carer"])

INVITE_CODE_ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1I")
INVITE_CODE_LENGTH = 6
INVITE_CODE_TTL = timedelta(hours=24)
ALERT_LOOKBACK = timedelta(days=7)


def _generate_code() -> str:
    return "".join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))


@router.post("/invite-code", response_model=CarerInviteCodeResponse)
def create_invite_code(current_user: CurrentUser = Depends(get_current_user)):
    client = get_service_client()
    now = datetime.now(timezone.utc)

    existing = (
        client.table("carer_invite_codes")
        .select("*")
        .eq("cared_for_id", current_user.id)
        .is_("used_at", "null")
        .gt("expires_at", now.isoformat())
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    for _ in range(5):
        code = _generate_code()
        try:
            row = (
                client.table("carer_invite_codes")
                .insert(
                    {
                        "code": code,
                        "cared_for_id": current_user.id,
                        "expires_at": (now + INVITE_CODE_TTL).isoformat(),
                    }
                )
                .execute()
            )
            return row.data[0]
        except Exception:
            continue

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate a unique code"
    )


@router.post("/link", response_model=CaredForSummary)
def link_carer(payload: CarerLinkRequest, current_user: CurrentUser = Depends(get_current_user)):
    code = payload.code.strip().upper()
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code is required")

    client = get_service_client()
    now = datetime.now(timezone.utc)

    invite = client.table("carer_invite_codes").select("*").eq("code", code).execute()
    if not invite.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid code")

    row = invite.data[0]
    if row["used_at"]:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Code already used")
    if datetime.fromisoformat(row["expires_at"]) < now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Code has expired")
    if row["cared_for_id"] == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot link to your own code")

    try:
        client.table("carer_links").insert(
            {"carer_id": current_user.id, "cared_for_id": row["cared_for_id"]}
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="That person already has a carer"
        ) from exc

    client.table("carer_invite_codes").update(
        {"used_at": now.isoformat(), "used_by": current_user.id}
    ).eq("code", code).execute()
    client.table("profiles").update({"role": "carer"}).eq("id", current_user.id).execute()

    cared_for = (
        client.table("profiles").select("id, full_name").eq("id", row["cared_for_id"]).single().execute()
    )
    return cared_for.data


@router.get("/cared-for", response_model=list[CaredForSummary])
def list_cared_for(current_user: CurrentUser = Depends(get_current_user)):
    client = get_service_client()
    links = client.table("carer_links").select("cared_for_id").eq("carer_id", current_user.id).execute()
    cared_for_ids = [link["cared_for_id"] for link in links.data]
    if not cared_for_ids:
        return []

    profiles = client.table("profiles").select("id, full_name").in_("id", cared_for_ids).execute()
    return profiles.data


@router.get("/alerts", response_model=list[CarerAlert])
def get_alerts(
    cared_for_id: str | None = Query(None), current_user: CurrentUser = Depends(get_current_user)
):
    client = get_service_client()

    links = client.table("carer_links").select("cared_for_id").eq("carer_id", current_user.id).execute()
    linked_ids = [link["cared_for_id"] for link in links.data]

    if cared_for_id is not None:
        if cared_for_id not in linked_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not linked to this cared-for account"
            )
        target_ids = [cared_for_id]
    else:
        target_ids = linked_ids

    if not target_ids:
        return []

    since = (datetime.now(timezone.utc) - ALERT_LOOKBACK).isoformat()
    logs = (
        client.table("medication_logs")
        .select("*")
        .in_("user_id", target_ids)
        .in_("status", ["missed", "snoozed"])
        .gte("scheduled_for", since)
        .order("scheduled_for", desc=True)
        .execute()
    )
    if not logs.data:
        return []

    # A snoozed dose only counts as an alert once it's been called back on
    # more than once without ever landing on "taken" - the same attempt-count
    # signal already computed at dispatch time in call_service.py, reused
    # here as a read instead.
    snoozed_log_ids = [log["id"] for log in logs.data if log["status"] == "snoozed"]
    attempt_counts: dict[str, int] = {}
    if snoozed_log_ids:
        calls = (
            client.table("calls")
            .select("medication_log_id")
            .in_("medication_log_id", snoozed_log_ids)
            .execute()
        )
        for call in calls.data:
            log_id = call["medication_log_id"]
            attempt_counts[log_id] = attempt_counts.get(log_id, 0) + 1

    alert_logs = [
        log
        for log in logs.data
        if log["status"] == "missed" or attempt_counts.get(log["id"], 0) > 1
    ]
    if not alert_logs:
        return []

    profiles = client.table("profiles").select("id, full_name").in_("id", target_ids).execute()
    profile_names = {p["id"]: p["full_name"] for p in profiles.data}

    medication_ids = list({log["medication_id"] for log in alert_logs})
    medications = client.table("medications").select("id, name").in_("id", medication_ids).execute()
    medication_names = {m["id"]: m["name"] for m in medications.data}

    return [
        {
            "id": log["id"],
            "cared_for_id": log["user_id"],
            "cared_for_name": profile_names.get(log["user_id"], "Unknown"),
            "medication_id": log["medication_id"],
            "medication_name": medication_names.get(log["medication_id"], "Unknown"),
            "scheduled_for": log["scheduled_for"],
            "status": log["status"],
            "attempt_count": attempt_counts.get(log["id"], 1 if log["status"] == "missed" else 0),
        }
        for log in alert_logs
    ]
