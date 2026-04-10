from fastapi import APIRouter, Query
from supabase import create_client
from datetime import date
import os

router = APIRouter()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

@router.post("")
async def mark_attendance(payload: dict):
    academy_id   = payload.get("academy_id")
    athlete_name = payload.get("athlete_name")
    status       = payload.get("status", "present")
    date_str     = payload.get("date", date.today().isoformat())

    # Upsert — one record per athlete per day
    res = supabase.table("attendance_logs").upsert({
        "academy_id":   academy_id,
        "athlete_name": athlete_name,
        "date":         date_str,
        "status":       status,
    }, on_conflict="academy_id,athlete_name,date").execute()
    return res.data[0] if res.data else {}

@router.get("/today")
async def get_today_attendance(academy_id: str = Query(...)):
    today = date.today().isoformat()
    res = supabase.table("attendance_logs")\
        .select("*")\
        .eq("academy_id", academy_id)\
        .eq("date", today)\
        .execute()
    return res.data or []

@router.get("/{athlete_name}")
async def get_athlete_attendance(athlete_name: str, academy_id: str = Query(...)):
    res = supabase.table("attendance_logs")\
        .select("*")\
        .eq("academy_id", academy_id)\
        .eq("athlete_name", athlete_name)\
        .order("date", desc=True)\
        .limit(30)\
        .execute()
    return res.data or []
