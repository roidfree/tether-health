from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase_client import get_service_client
from app.deps import CurrentUser, get_current_user
from app.models.schemas import (
    DashboardResponse,
    MedicationLogCreate,
    MedicationLogResponse,
    MedicationLogUpdate,
)

router = APIRouter(tags=["logs"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(current_user: CurrentUser = Depends(get_current_user)):
    client = get_service_client()

    medications = (
        client.table("medications")
        .select("*")
        .eq("user_id", current_user.id)
        .eq("active", True)
        .order("created_at", desc=True)
        .execute()
    )
    recent_logs = (
        client.table("medication_logs")
        .select("*")
        .eq("user_id", current_user.id)
        .order("scheduled_for", desc=True)
        .limit(50)
        .execute()
    )

    return DashboardResponse(medications=medications.data, recent_logs=recent_logs.data)


@router.post("/logs", response_model=MedicationLogResponse, status_code=status.HTTP_201_CREATED)
def create_log(payload: MedicationLogCreate, current_user: CurrentUser = Depends(get_current_user)):
    client = get_service_client()
    row = payload.model_dump(mode="json")
    row["user_id"] = current_user.id
    result = client.table("medication_logs").insert(row).execute()
    return result.data[0]


@router.put("/logs/{log_id}", response_model=MedicationLogResponse)
def update_log(
    log_id: str, payload: MedicationLogUpdate, current_user: CurrentUser = Depends(get_current_user)
):
    client = get_service_client()
    updates = payload.model_dump(mode="json", exclude_unset=True)
    updates["responded_at"] = (
        datetime.now(timezone.utc).isoformat() if payload.status != "pending" else None
    )

    result = (
        client.table("medication_logs")
        .update(updates)
        .eq("id", log_id)
        .eq("user_id", current_user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    return result.data[0]
