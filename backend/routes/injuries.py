from fastapi import APIRouter
from supabase import create_client
import os

router = APIRouter()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

@router.post("/")
async def log_injury(payload: dict):
    data = {
        "academy_id": payload.get("academy_id"),
        "athlete_name": payload.get("athlete_name"),
        "body_part": payload.get("body_part"),
        "injury_type": payload.get("injury_type"),
        "severity": payload.get("severity"),
        "date_occurred": payload.get("date_occurred"),
        "notes": payload.get("notes", ""),
        "status": payload.get("status", "active"),
    }
    res = supabase.table("injury_logs").insert(data).execute()
    return res.data[0] if res.data else {}

@router.get("/{athlete_name}")
async def get_injuries(athlete_name: str, academy_id: str):
    res = (
        supabase.table("injury_logs")
        .select("*")
        .eq("academy_id", academy_id)
        .eq("athlete_name", athlete_name)
        .order("date_occurred", desc=True)
        .execute()
    )
    return res.data or []

@router.patch("/{injury_id}")
async def update_injury(injury_id: str, payload: dict):
    res = (
        supabase.table("injury_logs")
        .update({"status": payload.get("status"), "notes": payload.get("notes")})
        .eq("id", injury_id)
        .execute()
    )
    return res.data[0] if res.data else {}