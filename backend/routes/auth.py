from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client
import os

router = APIRouter()

def get_supabase():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

class AcademyLoginRequest(BaseModel):
    name: str
    password: str

@router.post("/academy-login")
def academy_login(body: AcademyLoginRequest):
    supabase = get_supabase()

    result = supabase.table("academies").select("*")\
        .ilike("name", body.name.strip())\
        .execute().data

    if not result:
        raise HTTPException(status_code=401, detail="Academy not found")

    academy = result[0]

    if academy["password"] != body.password:
        raise HTTPException(status_code=401, detail="Incorrect password")

    return {
        "academy_id":   academy["id"],
        "academy_name": academy["name"],
        "plan":         academy["plan"]
    }

@router.post("/register-academy")
def register_academy(body: AcademyLoginRequest):
    supabase = get_supabase()

    # Check by name (case-insensitive)
    existing_name = supabase.table("academies").select("id")\
        .ilike("name", body.name.strip()).execute().data

    if existing_name:
        raise HTTPException(status_code=400, detail="Academy name already taken")

    # Generate slug and check that too
    slug = body.name.lower().strip().replace(" ", "-")
    existing_slug = supabase.table("academies").select("id")\
        .eq("slug", slug).execute().data

    if existing_slug:
        raise HTTPException(status_code=400, detail="Academy name already taken")

    result = supabase.table("academies").insert({
        "name":     body.name.strip(),
        "slug":     slug,
        "password": body.password,
        "plan":     "free"
    }).execute().data

    return {"message": "Academy created", "academy_id": result[0]["id"]}