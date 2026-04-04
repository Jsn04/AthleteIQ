from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client
from datetime import datetime, timezone, timedelta
import os

router = APIRouter()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

class AcademyLoginRequest(BaseModel):
    name: str
    password: str

@router.post("/academy-login")
def academy_login(body: AcademyLoginRequest):
    result = (
        supabase.table("academies")
        .select("*")
        .ilike("name", body.name.strip())
        .execute()
        .data
    )

    if not result:
        raise HTTPException(status_code=401, detail="Academy not found")

    academy = result[0]

    if academy["password"] != body.password:
        raise HTTPException(status_code=401, detail="Incorrect password")

    return {
        "academy_id":    academy["id"],
        "academy_name":  academy["name"],
        "plan":          academy["plan"],
        "trial_ends_at": academy.get("trial_ends_at")   # ← send to frontend
    }

@router.post("/register-academy")
def register_academy(body: AcademyLoginRequest):
    existing_name = (
        supabase.table("academies")
        .select("id")
        .ilike("name", body.name.strip())
        .execute()
        .data
    )

    if existing_name:
        raise HTTPException(status_code=400, detail="Academy name already taken")

    slug = body.name.lower().strip().replace(" ", "-")
    existing_slug = (
        supabase.table("academies")
        .select("id")
        .eq("slug", slug)
        .execute()
        .data
    )

    if existing_slug:
        raise HTTPException(status_code=400, detail="Academy name already taken")

    # ← Set 14-day trial from the moment they register
    trial_ends_at = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()

    result = supabase.table("academies").insert({
        "name":          body.name.strip(),
        "slug":          slug,
        "password":      body.password,
        "plan":          "free",
        "trial_ends_at": trial_ends_at        # ← stamp trial expiry
    }).execute().data

    return {
        "message":       "Academy created",
        "academy_id":    result[0]["id"],
        "trial_ends_at": trial_ends_at        # ← send to frontend
    }