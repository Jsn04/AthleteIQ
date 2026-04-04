from fastapi import APIRouter, Query, HTTPException
from supabase import create_client
import os

router = APIRouter()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

def require_academy(academy_id: str):
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id is required")
    return academy_id

@router.get("/")
def get_athletes(academy_id: str = Query(...)):
    require_academy(academy_id)
    response = (
        supabase.table("athletes")
        .select("*")
        .eq("academy_id", academy_id)
        .eq("is_deleted", False)
        .execute()
    )
    return response.data

@router.post("/")
def add_athlete(athlete: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    athlete["academy_id"] = academy_id
    athlete["is_deleted"] = False
    response = supabase.table("athletes").insert(athlete).execute()
    return response.data

@router.delete("/{athlete_id}")
def delete_athlete(athlete_id: str, academy_id: str = Query(...)):
    require_academy(academy_id)
    (
        supabase.table("athletes")
        .update({"is_deleted": True})
        .eq("id", athlete_id)
        .eq("academy_id", academy_id)
        .execute()
    )
    return {"message": "Athlete deleted"}

@router.patch("/{athlete_id}")
def update_athlete(athlete_id: str, updates: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    supabase.table("athletes").update(updates)\
        .eq("id", athlete_id)\
        .eq("academy_id", academy_id)\
        .execute()
    return {"status": "updated"}