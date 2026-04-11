import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Query, HTTPException

from db import safe_query

router = APIRouter()
log = logging.getLogger(__name__)


def require_academy(academy_id: str):
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id is required")
    return academy_id


@router.get("")
def get_checkins(academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        now         = datetime.now(timezone.utc)
        today_start = now.replace(hour=0,  minute=0,  second=0,  microsecond=0).isoformat()
        today_end   = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
        response = safe_query(
            lambda sb: sb.table("checkins")
            .select("*")
            .eq("academy_id", academy_id)
            .gte("created_at", today_start)
            .lte("created_at", today_end)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
    except Exception as e:
        log.error("GET /wellness failed: %s", e)
        return []


@router.post("")
def submit_checkin(checkin: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        if "athlete_name" in checkin:
            checkin["athlete_name"] = checkin["athlete_name"].strip()
        checkin["academy_id"] = academy_id
        response = safe_query(lambda sb: sb.table("checkins").insert(checkin).execute())
        return response.data
    except Exception as e:
        log.error("POST /wellness failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save check-in. Try again.")


@router.post("/training-log")
def log_training(data: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        result = safe_query(lambda sb: sb.table("training_logs").insert({
            "athlete_name": data["athlete_name"].strip(),
            "intensity":    data["intensity"],
            "duration":     data["duration"],
            "attended":     data.get("attended", True),
            "coach_notes":  data.get("coach_notes", ""),
            "rpe":          data.get("rpe", None),
            "academy_id":   academy_id,
        }).execute())
        return {"message": "Training log saved", "data": result.data}
    except Exception as e:
        log.error("POST /wellness/training-log failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save training log. Try again.")


@router.post("/bulk-training-log")
def bulk_log_training(data: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    logs = data.get("logs", [])
    if not logs:
        return {"message": "No logs provided", "count": 0}
    try:
        rows = []
        for entry in logs:
            rows.append({
                "athlete_name": entry["athlete_name"].strip(),
                "intensity":    entry.get("intensity", "Medium"),
                "duration":     entry.get("duration", 0),
                "attended":     entry.get("attended", True),
                "coach_notes":  entry.get("coach_notes", "").strip(),
                "rpe":          entry.get("rpe", 0),
                "academy_id":   academy_id,
            })
        result = safe_query(lambda sb: sb.table("training_logs").insert(rows).execute())
        return {"message": f"{len(rows)} training logs saved", "count": len(rows), "data": result.data}
    except Exception as e:
        log.error("POST /wellness/bulk-training-log failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save training logs. Try again.")


@router.get("/training-log/{athlete_name}")
def get_training_logs(athlete_name: str, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        result = safe_query(
            lambda sb: sb.table("training_logs")
            .select("*")
            .eq("athlete_name", athlete_name.strip())
            .eq("academy_id", academy_id)
            .order("created_at", desc=True)
            .limit(7)
            .execute()
        )
        return {"logs": result.data}
    except Exception as e:
        log.error("GET /wellness/training-log/%s failed: %s", athlete_name, e)
        return {"logs": []}


@router.get("/history/{athlete_name}")
def get_athlete_history(athlete_name: str, academy_id: str = Query(...), days: int = 7):
    require_academy(academy_id)
    try:
        limit_count = min(days, 90) if days > 0 else 500
        result = safe_query(
            lambda sb: sb.table("checkins")
            .select("*")
            .eq("athlete_name", athlete_name.strip())
            .eq("academy_id", academy_id)
            .order("created_at", desc=True)
            .limit(limit_count)
            .execute()
        )
        return {"history": result.data}
    except Exception as e:
        log.error("GET /wellness/history/%s failed: %s", athlete_name, e)
        return {"history": []}
