import logging
from datetime import date

from fastapi import APIRouter, Query

from db import safe_query

router = APIRouter()
log = logging.getLogger(__name__)


@router.post("")
async def mark_attendance(payload: dict):
    try:
        academy_id   = payload.get("academy_id")
        athlete_name = payload.get("athlete_name")
        status       = payload.get("status", "present")
        date_str     = payload.get("date", date.today().isoformat())

        res = safe_query(
            lambda sb: sb.table("attendance_logs").upsert({
                "academy_id":   academy_id,
                "athlete_name": athlete_name,
                "date":         date_str,
                "status":       status,
            }, on_conflict="academy_id,athlete_name,date").execute()
        )
        return res.data[0] if res.data else {}
    except Exception as e:
        log.error("POST /attendance failed: %s", e)
        return {}


@router.get("/today")
async def get_today_attendance(academy_id: str = Query(...)):
    try:
        today = date.today().isoformat()
        res = safe_query(
            lambda sb: sb.table("attendance_logs")
            .select("*")
            .eq("academy_id", academy_id)
            .eq("date", today)
            .execute()
        )
        return res.data or []
    except Exception as e:
        log.error("GET /attendance/today failed: %s", e)
        return []


@router.get("/{athlete_name}")
async def get_athlete_attendance(athlete_name: str, academy_id: str = Query(...)):
    try:
        res = safe_query(
            lambda sb: sb.table("attendance_logs")
            .select("*")
            .eq("academy_id", academy_id)
            .eq("athlete_name", athlete_name)
            .order("date", desc=True)
            .limit(30)
            .execute()
        )
        return res.data or []
    except Exception as e:
        log.error("GET /attendance/%s failed: %s", athlete_name, e)
        return []
