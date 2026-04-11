import logging

from fastapi import APIRouter, Query, HTTPException

from db import safe_query

router = APIRouter()
log = logging.getLogger(__name__)


def require_academy(academy_id: str):
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id is required")
    return academy_id


@router.get("")
def get_athletes(academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        response = safe_query(
            lambda sb: sb.table("athletes")
            .select("*")
            .eq("academy_id", academy_id)
            .eq("is_deleted", False)
            .execute()
        )
        return response.data
    except Exception as e:
        log.error("GET /athletes failed: %s", e)
        return []


@router.post("")
def add_athlete(athlete: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        athlete["academy_id"] = academy_id
        athlete["is_deleted"] = False
        response = safe_query(lambda sb: sb.table("athletes").insert(athlete).execute())
        return response.data
    except Exception as e:
        log.error("POST /athletes failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not add athlete. Try again.")


@router.delete("/{athlete_id}")
def delete_athlete(athlete_id: str, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        safe_query(
            lambda sb: sb.table("athletes")
            .update({"is_deleted": True})
            .eq("id", athlete_id)
            .eq("academy_id", academy_id)
            .execute()
        )
        return {"message": "Athlete deleted"}
    except Exception as e:
        log.error("DELETE /athletes/%s failed: %s", athlete_id, e)
        raise HTTPException(status_code=500, detail="Could not delete athlete. Try again.")


@router.patch("/{athlete_id}")
def update_athlete(athlete_id: str, updates: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        safe_query(
            lambda sb: sb.table("athletes")
            .update(updates)
            .eq("id", athlete_id)
            .eq("academy_id", academy_id)
            .execute()
        )
        return {"status": "updated"}
    except Exception as e:
        log.error("PATCH /athletes/%s failed: %s", athlete_id, e)
        raise HTTPException(status_code=500, detail="Could not update athlete. Try again.")
