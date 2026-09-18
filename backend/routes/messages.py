import logging

from fastapi import APIRouter, HTTPException, Query

from db import safe_query
from trial import require_active_trial

router = APIRouter()
log = logging.getLogger(__name__)


@router.post("")
def send_message(payload: dict, academy_id: str = Query(...)):
    require_active_trial(academy_id)
    try:
        athlete_name = (payload.get("athlete_name") or "").strip()
        sender = payload.get("sender")
        text = (payload.get("text") or "").strip()
        if not athlete_name or sender not in ("coach", "athlete") or not text:
            raise HTTPException(status_code=400, detail="athlete_name, sender, and text are required")

        res = safe_query(
            lambda sb: sb.table("messages").insert({
                "academy_id":   academy_id,
                "athlete_name": athlete_name,
                "sender":       sender,
                "text":         text[:2000],
            }).execute()
        )
        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        log.error("POST /messages failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not send message")


@router.get("/threads")
def list_threads(academy_id: str = Query(...)):
    """Coach inbox: one row per athlete with their last message and unread count."""
    try:
        res = safe_query(
            lambda sb: sb.table("messages")
            .select("*")
            .eq("academy_id", academy_id)
            .order("created_at", desc=True)
            .limit(1000)
            .execute()
        )
        rows = res.data or []
        threads = {}
        for m in rows:
            name = m["athlete_name"]
            if name not in threads:
                threads[name] = {
                    "athlete_name": name,
                    "last_text": m["text"],
                    "last_sender": m["sender"],
                    "last_at": m["created_at"],
                    "unread_count": 0,
                }
            if m["sender"] == "athlete" and not m["read"]:
                threads[name]["unread_count"] += 1
        return {"threads": sorted(threads.values(), key=lambda t: t["last_at"], reverse=True)}
    except Exception as e:
        log.error("GET /messages/threads failed: %s", e)
        return {"threads": []}


@router.get("/{athlete_name}")
def get_thread(athlete_name: str, academy_id: str = Query(...)):
    try:
        res = safe_query(
            lambda sb: sb.table("messages")
            .select("*")
            .eq("academy_id", academy_id)
            .eq("athlete_name", athlete_name.strip())
            .order("created_at", desc=False)
            .limit(500)
            .execute()
        )
        return {"messages": res.data or []}
    except Exception as e:
        log.error("GET /messages/%s failed: %s", athlete_name, e)
        return {"messages": []}


@router.post("/read")
def mark_read(payload: dict, academy_id: str = Query(...)):
    """Mark all messages from the other side of a thread as read."""
    try:
        athlete_name = (payload.get("athlete_name") or "").strip()
        reader = payload.get("reader")  # who is reading: 'coach' or 'athlete'
        if not athlete_name or reader not in ("coach", "athlete"):
            return {"error": "athlete_name and reader are required"}
        other_sender = "athlete" if reader == "coach" else "coach"
        safe_query(
            lambda sb: sb.table("messages")
            .update({"read": True})
            .eq("academy_id", academy_id)
            .eq("athlete_name", athlete_name)
            .eq("sender", other_sender)
            .eq("read", False)
            .execute()
        )
        return {"ok": True}
    except Exception as e:
        log.error("POST /messages/read failed: %s", e)
        return {"error": "Could not mark as read"}
