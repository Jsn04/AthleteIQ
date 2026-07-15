import logging
from datetime import datetime, timezone, timedelta

import bcrypt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import safe_query

router = APIRouter()
log = logging.getLogger(__name__)


class AcademyRegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class AcademyLoginRequest(BaseModel):
    email: str
    password: str


FOUNDING_CAP = 15


@router.get("/founding-status")
def founding_status():
    """Public — real academy/athlete counts for the landing page.
    Never raises: the landing page must render even if the DB is unreachable."""
    try:
        academies = safe_query(
            lambda sb: sb.table("academies").select("id").execute().data
        )
        athletes = safe_query(
            lambda sb: sb.table("athletes").select("id").eq("is_deleted", False).execute().data
        )
        total_academies = len(academies or [])
        total_athletes = len(athletes or [])
        return {
            "total_academies": total_academies,
            "total_athletes":  total_athletes,
            "spots_left":      max(FOUNDING_CAP - total_academies, 0),
            "founding_cap":    FOUNDING_CAP,
        }
    except Exception as e:
        log.error("GET /auth/founding-status failed: %s", e)
        return {"total_academies": 0, "total_athletes": 0, "spots_left": FOUNDING_CAP, "founding_cap": FOUNDING_CAP}


@router.post("/register-academy")
def register_academy(body: AcademyRegisterRequest):
    try:
        existing_email = safe_query(
            lambda sb: sb.table("academies")
            .select("id")
            .eq("email", body.email.strip().lower())
            .execute().data
        )
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")

        existing_name = safe_query(
            lambda sb: sb.table("academies")
            .select("id")
            .ilike("name", body.name.strip())
            .execute().data
        )
        if existing_name:
            raise HTTPException(status_code=400, detail="Academy name already taken.")

        slug = body.name.lower().strip().replace(" ", "-")
        trial_ends_at = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()

        pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

        result = safe_query(
            lambda sb: sb.table("academies").insert({
                "name":          body.name.strip(),
                "email":         body.email.strip().lower(),
                "slug":          slug,
                "password":      pw_hash,
                "plan":          "free",
                "trial_ends_at": trial_ends_at,
            }).execute().data
        )

        return {
            "message":       "Academy created",
            "academy_id":    result[0]["id"],
            "academy_name":  result[0]["name"],
            "plan":          "free",
            "trial_ends_at": trial_ends_at,
            "session_time":  None,
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("POST /auth/register-academy failed: %s", e)
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")


@router.post("/academy-login")
def academy_login(body: AcademyLoginRequest):
    try:
        result = safe_query(
            lambda sb: sb.table("academies")
            .select("*")
            .eq("email", body.email.strip().lower())
            .execute().data
        )

        if not result:
            result = safe_query(
                lambda sb: sb.table("academies")
                .select("*")
                .ilike("name", body.email.strip())
                .execute().data
            )

        if not result:
            raise HTTPException(status_code=401, detail="Account not found. Please register first.")

        academy = result[0]

        stored = academy["password"]
        # support both bcrypt hashes and legacy plaintext passwords
        try:
            valid = bcrypt.checkpw(body.password.encode(), stored.encode())
        except Exception:
            valid = (stored == body.password)
        if not valid:
            raise HTTPException(status_code=401, detail="Incorrect password.")

        return {
            "academy_id":    academy["id"],
            "academy_name":  academy["name"],
            "plan":          academy["plan"],
            "trial_ends_at": academy.get("trial_ends_at"),
            "session_time":  academy.get("session_time"),
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("POST /auth/academy-login failed: %s", e)
        raise HTTPException(status_code=500, detail="Login failed. Please try again.")
