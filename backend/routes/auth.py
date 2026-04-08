from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client
from datetime import datetime, timezone, timedelta
import os

router = APIRouter()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


class AcademyRegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class AcademyLoginRequest(BaseModel):
    email: str      # accepts email OR academy name
    password: str


@router.post("/register-academy")
def register_academy(body: AcademyRegisterRequest):
    # Email uniqueness
    existing_email = (
        supabase.table("academies")
        .select("id")
        .eq("email", body.email.strip().lower())
        .execute().data
    )
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")

    # Name uniqueness
    existing_name = (
        supabase.table("academies")
        .select("id")
        .ilike("name", body.name.strip())
        .execute().data
    )
    if existing_name:
        raise HTTPException(status_code=400, detail="Academy name already taken.")

    slug = body.name.lower().strip().replace(" ", "-")
    trial_ends_at = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()

    result = supabase.table("academies").insert({
        "name":          body.name.strip(),
        "email":         body.email.strip().lower(),
        "slug":          slug,
        "password":      body.password,
        "plan":          "free",
        "trial_ends_at": trial_ends_at,
    }).execute().data

    return {
        "message":       "Academy created",
        "academy_id":    result[0]["id"],
        "academy_name":  result[0]["name"],
        "plan":          "free",
        "trial_ends_at": trial_ends_at,
    }


@router.post("/academy-login")
def academy_login(body: AcademyLoginRequest):
    identifier = body.email.strip()
    academy = None

    # 1️⃣ Try email match first (new academies)
    if "@" in identifier:
        result = (
            supabase.table("academies")
            .select("*")
            .eq("email", identifier.lower())
            .execute().data
        )
        if result:
            academy = result[0]

    # 2️⃣ Fall back to name match (old academies with no email)
    if not academy:
        result = (
            supabase.table("academies")
            .select("*")
            .ilike("name", identifier)
            .execute().data
        )
        if result:
            academy = result[0]

    if not academy:
        raise HTTPException(
            status_code=401,
            detail="No account found. Try your academy name or register."
        )

    if academy["password"] != body.password:
        raise HTTPException(status_code=401, detail="Incorrect password.")

    return {
        "academy_id":    academy["id"],
        "academy_name":  academy["name"],
        "plan":          academy["plan"],
        "trial_ends_at": academy.get("trial_ends_at"),
    }