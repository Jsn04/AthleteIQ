from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
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
    email: str
    password: str


@router.post("/register-academy")
def register_academy(body: AcademyRegisterRequest):
    existing_email = (
        supabase.table("academies")
        .select("id")
        .eq("email", body.email.strip().lower())
        .execute()
        .data
    )
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")

    existing_name = (
        supabase.table("academies")
        .select("id")
        .ilike("name", body.name.strip())
        .execute()
        .data
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
    # Try email first
    result = (
        supabase.table("academies")
        .select("*")
        .eq("email", body.email.strip().lower())
        .execute()
        .data
    )

    # Fall back to academy name (for existing academies with no email set)
    if not result:
        result = (
            supabase.table("academies")
            .select("*")
            .ilike("name", body.email.strip())
            .execute()
            .data
        )

    if not result:
        raise HTTPException(status_code=401, detail="Account not found. Please register first.")

    academy = result[0]

    if academy["password"] != body.password:
        raise HTTPException(status_code=401, detail="Incorrect password.")

    return {
        "academy_id":    academy["id"],
        "academy_name":  academy["name"],
        "plan":          academy["plan"],
        "trial_ends_at": academy.get("trial_ends_at"),
    }