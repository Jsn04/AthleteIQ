import os

import httpx
from fastapi import APIRouter, Query, HTTPException
from supabase import create_client

router = APIRouter()


def get_supabase():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


supabase = get_supabase()


def safe_supabase_query(query_fn):
    """Run a Supabase query with one reconnect + retry on stale HTTP/2 connections.

    Render's free tier keeps processes warm for long periods, and the module-level
    Supabase client's underlying httpx pool can go stale, throwing ReadError/
    ConnectError on the first hit after an idle window. Without this wrapper the
    dashboard flashes "No athletes found" on back-navigation while the first
    request silently fails — see project_bug_fixes_apr8.md.
    """
    global supabase
    try:
        return query_fn()
    except (httpx.ReadError, httpx.ConnectError):
        supabase = get_supabase()
        return query_fn()


def require_academy(academy_id: str):
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id is required")
    return academy_id


@router.get("")
def get_athletes(academy_id: str = Query(...)):
    require_academy(academy_id)
    response = safe_supabase_query(
        lambda: supabase.table("athletes")
        .select("*")
        .eq("academy_id", academy_id)
        .eq("is_deleted", False)
        .execute()
    )
    return response.data


@router.post("")
def add_athlete(athlete: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    athlete["academy_id"] = academy_id
    athlete["is_deleted"] = False
    response = safe_supabase_query(
        lambda: supabase.table("athletes").insert(athlete).execute()
    )
    return response.data


@router.delete("/{athlete_id}")
def delete_athlete(athlete_id: str, academy_id: str = Query(...)):
    require_academy(academy_id)
    safe_supabase_query(
        lambda: supabase.table("athletes")
        .update({"is_deleted": True})
        .eq("id", athlete_id)
        .eq("academy_id", academy_id)
        .execute()
    )
    return {"message": "Athlete deleted"}


@router.patch("/{athlete_id}")
def update_athlete(athlete_id: str, updates: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    safe_supabase_query(
        lambda: supabase.table("athletes")
        .update(updates)
        .eq("id", athlete_id)
        .eq("academy_id", academy_id)
        .execute()
    )
    return {"status": "updated"}
