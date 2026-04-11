import logging

from fastapi import APIRouter, HTTPException

from db import safe_query

router = APIRouter()
log = logging.getLogger(__name__)


@router.post("")
async def log_injury(payload: dict):
    try:
        data = {
            "academy_id":    payload.get("academy_id"),
            "athlete_name":  payload.get("athlete_name"),
            "body_part":     payload.get("body_part"),
            "injury_type":   payload.get("injury_type"),
            "severity":      payload.get("severity"),
            "date_occurred": payload.get("date_occurred"),
            "notes":         payload.get("notes", ""),
            "status":        payload.get("status", "active"),
        }
        res = safe_query(lambda sb: sb.table("injury_logs").insert(data).execute())
        return res.data[0] if res.data else {}
    except Exception as e:
        log.error("POST /injuries failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save injury. Try again.")


@router.get("/{athlete_name}")
async def get_injuries(athlete_name: str, academy_id: str):
    try:
        res = safe_query(
            lambda sb: sb.table("injury_logs")
            .select("*")
            .eq("academy_id", academy_id)
            .eq("athlete_name", athlete_name)
            .order("date_occurred", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        log.error("GET /injuries/%s failed: %s", athlete_name, e)
        return []


@router.patch("/{injury_id}")
async def update_injury(injury_id: str, payload: dict):
    try:
        res = safe_query(
            lambda sb: sb.table("injury_logs")
            .update({"status": payload.get("status"), "notes": payload.get("notes")})
            .eq("id", injury_id)
            .execute()
        )
        return res.data[0] if res.data else {}
    except Exception as e:
        log.error("PATCH /injuries/%s failed: %s", injury_id, e)
        raise HTTPException(status_code=500, detail="Could not update injury. Try again.")
