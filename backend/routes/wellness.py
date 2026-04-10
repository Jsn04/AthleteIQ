from fastapi import APIRouter, Query, HTTPException
from supabase import create_client
from datetime import datetime, timezone
import os

router = APIRouter()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

def require_academy(academy_id: str):
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id is required")
    return academy_id

@router.get("")
def get_checkins(academy_id: str = Query(...)):
    require_academy(academy_id)
    now         = datetime.now(timezone.utc)
    today_start = now.replace(hour=0,  minute=0,  second=0,  microsecond=0).isoformat()
    today_end   = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
    response = supabase.table("checkins")\
        .select("*")\
        .eq("academy_id", academy_id)\
        .gte("created_at", today_start)\
        .lte("created_at", today_end)\
        .order("created_at", desc=True)\
        .execute()
    return response.data

@router.post("")
def submit_checkin(checkin: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    if "athlete_name" in checkin:
        checkin["athlete_name"] = checkin["athlete_name"].strip()
    checkin["academy_id"] = academy_id          # stamp academy on every check-in
    response = supabase.table("checkins").insert(checkin).execute()
    return response.data

@router.post("/training-log")
def log_training(data: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    result = supabase.table("training_logs").insert({
        "athlete_name": data["athlete_name"].strip(),
        "intensity":    data["intensity"],
        "duration":     data["duration"],
        "attended":     data.get("attended", True),
        "coach_notes":  data.get("coach_notes", ""),
        "rpe":          data.get("rpe", None),
        "academy_id":   academy_id              # stamp academy
    }).execute()
    return {"message": "Training log saved", "data": result.data}

@router.post("/bulk-training-log")
def bulk_log_training(data: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    logs = data.get("logs", [])

    if not logs:
        return {"message": "No logs provided", "count": 0}

    rows = []
    for log in logs:
        rows.append({
            "athlete_name": log["athlete_name"].strip(),
            "intensity":    log.get("intensity", "Medium"),
            "duration":     log.get("duration", 0),
            "attended":     log.get("attended", True),
            "coach_notes":  log.get("coach_notes", "").strip(),
            "rpe":          log.get("rpe", 0),
            "academy_id":   academy_id          # stamp on every row
        })

    result = supabase.table("training_logs").insert(rows).execute()
    return {
        "message": f"{len(rows)} training logs saved",
        "count":   len(rows),
        "data":    result.data
    }

@router.get("/training-log/{athlete_name}")
def get_training_logs(athlete_name: str, academy_id: str = Query(...)):
    require_academy(academy_id)
    logs = supabase.table("training_logs")\
        .select("*")\
        .eq("athlete_name", athlete_name.strip())\
        .eq("academy_id", academy_id)\
        .order("created_at", desc=True)\
        .limit(7)\
        .execute()
    return {"logs": logs.data}

@router.get("/history/{athlete_name}")
def get_athlete_history(athlete_name: str, academy_id: str = Query(...), days: int = 7):
    require_academy(academy_id)
    limit_count = min(days, 90) if days > 0 else 500
    logs = supabase.table("checkins")\
        .select("*")\
        .eq("athlete_name", athlete_name.strip())\
        .eq("academy_id", academy_id)\
        .order("created_at", desc=True)\
        .limit(limit_count)\
        .execute()
    return {"history": logs.data}