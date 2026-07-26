from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase_client import get_service_client
from app.deps import TargetUser, require_write, resolve_target_user
from app.models.schemas import (
    DashboardResponse,
    MedicationLogCreate,
    MedicationLogResponse,
    MedicationLogUpdate,
)

router = APIRouter(tags=["logs"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(target: TargetUser = Depends(resolve_target_user)):
    client = get_service_client()

    medications = (
        client.table("medications")
        .select("*")
        .eq("user_id", target.id)
        .eq("active", True)
        .order("created_at", desc=True)
        .execute()
    )
    recent_logs = (
        client.table("medication_logs")
        .select("*")
        .eq("user_id", target.id)
        .order("scheduled_for", desc=True)
        .limit(50)
        .execute()
    )

    # Joined in Python rather than via a DB-level join (same pattern as
    # GET /carer/alerts) - covers logs for medications that have since been
    # paused (active=False) or removed, not just the ones in `medications`
    # above.
    medication_ids = list({log["medication_id"] for log in recent_logs.data})
    medication_names: dict[str, str] = {}
    if medication_ids:
        medication_rows = (
            client.table("medications").select("id, name").in_("id", medication_ids).execute()
        )
        medication_names = {m["id"]: m["name"] for m in medication_rows.data}

    logs_with_names = [
        {**log, "medication_name": medication_names.get(log["medication_id"], "Unknown")}
        for log in recent_logs.data
    ]

    return DashboardResponse(medications=medications.data, recent_logs=logs_with_names)


@router.post("/logs", response_model=MedicationLogResponse, status_code=status.HTTP_201_CREATED)
def create_log(payload: MedicationLogCreate, target: TargetUser = Depends(resolve_target_user)):
    require_write(target)
    client = get_service_client()
    row = payload.model_dump(mode="json")
    row["user_id"] = target.id
    result = client.table("medication_logs").insert(row).execute()
    return result.data[0]


@router.put("/logs/{log_id}", response_model=MedicationLogResponse)
def update_log(
    log_id: str, payload: MedicationLogUpdate, target: TargetUser = Depends(resolve_target_user)
):
    require_write(target)
    client = get_service_client()
    updates = payload.model_dump(mode="json", exclude_unset=True)
    updates["responded_at"] = (
        datetime.now(timezone.utc).isoformat() if payload.status != "pending" else None
    )

    result = (
        client.table("medication_logs")
        .update(updates)
        .eq("id", log_id)
        .eq("user_id", target.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    return result.data[0]
