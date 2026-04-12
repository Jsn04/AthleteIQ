import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query, HTTPException

from db import safe_query

router = APIRouter()
log = logging.getLogger(__name__)


def require_academy(academy_id: str):
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id is required")
    return academy_id


def _today_range_ist():
    """Return (start, end) ISO strings for today in IST."""
    now = datetime.now(timezone.utc)
    ist = now + timedelta(hours=5, minutes=30)
    today_str = ist.strftime("%Y-%m-%d")
    return f"{today_str}T00:00:00+05:30", f"{today_str}T23:59:59+05:30"


@router.post("")
def submit_vitals(data: dict, academy_id: str = Query(...)):
    """
    Save a single vitals reading (HR + HRV) for an athlete.
    Only one reading per athlete per day is allowed.
    """
    require_academy(academy_id)
    athlete_name = (data.get("athlete_name") or "").strip()
    if not athlete_name:
        raise HTTPException(status_code=400, detail="athlete_name is required")

    heart_rate = data.get("heart_rate")
    hrv = data.get("hrv")
    signal_quality = data.get("signal_quality", 0)

    if heart_rate is None or hrv is None:
        raise HTTPException(status_code=400, detail="heart_rate and hrv are required")

    # Once-per-day gate
    try:
        today_start, today_end = _today_range_ist()
        existing = safe_query(
            lambda sb: sb.table("vitals")
            .select("id")
            .eq("athlete_name", athlete_name)
            .eq("academy_id", academy_id)
            .gte("created_at", today_start)
            .lte("created_at", today_end)
            .limit(1)
            .execute()
        )
        if existing.data:
            return {"message": "Vitals already submitted today", "duplicate": True}
    except Exception:
        pass  # If check fails, allow submission anyway

    try:
        result = safe_query(
            lambda sb: sb.table("vitals").insert({
                "athlete_name": athlete_name,
                "academy_id": academy_id,
                "heart_rate": int(heart_rate),
                "hrv": round(float(hrv), 1),
                "signal_quality": round(float(signal_quality), 2),
            }).execute()
        )
        return {"message": "Vitals saved", "data": result.data}
    except Exception as e:
        log.error("POST /vitals failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save vitals.")


@router.get("/{athlete_name}")
def get_vitals(athlete_name: str, academy_id: str = Query(...), days: int = 14):
    """Fetch recent vitals for an athlete (default last 14 days)."""
    require_academy(academy_id)
    try:
        limit_count = min(days, 90)
        result = safe_query(
            lambda sb: sb.table("vitals")
            .select("*")
            .eq("athlete_name", athlete_name.strip())
            .eq("academy_id", academy_id)
            .order("created_at", desc=True)
            .limit(limit_count)
            .execute()
        )
        return {"vitals": result.data}
    except Exception as e:
        log.error("GET /vitals/%s failed: %s", athlete_name, e)
        return {"vitals": []}


@router.get("/today/{athlete_name}")
def get_vitals_today(athlete_name: str, academy_id: str = Query(...)):
    """Check if athlete already submitted vitals today."""
    require_academy(academy_id)
    try:
        today_start, today_end = _today_range_ist()
        result = safe_query(
            lambda sb: sb.table("vitals")
            .select("*")
            .eq("athlete_name", athlete_name.strip())
            .eq("academy_id", academy_id)
            .gte("created_at", today_start)
            .lte("created_at", today_end)
            .limit(1)
            .execute()
        )
        if result.data:
            return {"submitted": True, "data": result.data[0]}
        return {"submitted": False}
    except Exception as e:
        log.error("GET /vitals/today/%s failed: %s", athlete_name, e)
        return {"submitted": False}
