import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query, HTTPException

from db import safe_query

router = APIRouter()
log = logging.getLogger(__name__)


def require_academy(academy_id: str):
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id is required")
    return academy_id


@router.get("")
def get_checkins(academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        now         = datetime.now(timezone.utc)
        today_start = now.replace(hour=0,  minute=0,  second=0,  microsecond=0).isoformat()
        today_end   = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
        response = safe_query(
            lambda sb: sb.table("checkins")
            .select("*")
            .eq("academy_id", academy_id)
            .gte("created_at", today_start)
            .lte("created_at", today_end)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
    except Exception as e:
        log.error("GET /wellness failed: %s", e)
        return []


@router.post("")
def submit_checkin(checkin: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        if "athlete_name" in checkin:
            checkin["athlete_name"] = checkin["athlete_name"].strip()
        checkin["academy_id"] = academy_id
        response = safe_query(lambda sb: sb.table("checkins").insert(checkin).execute())
        return response.data
    except Exception as e:
        log.error("POST /wellness failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save check-in. Try again.")


@router.post("/training-log")
def log_training(data: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        result = safe_query(lambda sb: sb.table("training_logs").insert({
            "athlete_name": data["athlete_name"].strip(),
            "intensity":    data["intensity"],
            "duration":     data["duration"],
            "attended":     data.get("attended", True),
            "coach_notes":  data.get("coach_notes", ""),
            "rpe":          data.get("rpe", None),
            "academy_id":   academy_id,
        }).execute())
        return {"message": "Training log saved", "data": result.data}
    except Exception as e:
        log.error("POST /wellness/training-log failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save training log. Try again.")


@router.post("/bulk-training-log")
def bulk_log_training(data: dict, academy_id: str = Query(...)):
    require_academy(academy_id)
    logs = data.get("logs", [])
    if not logs:
        return {"message": "No logs provided", "count": 0}
    try:
        rows = []
        for entry in logs:
            rows.append({
                "athlete_name": entry["athlete_name"].strip(),
                "intensity":    entry.get("intensity", "Medium"),
                "duration":     entry.get("duration", 0),
                "attended":     entry.get("attended", True),
                "coach_notes":  entry.get("coach_notes", "").strip(),
                "rpe":          entry.get("rpe", 0),
                "academy_id":   academy_id,
            })
        result = safe_query(lambda sb: sb.table("training_logs").insert(rows).execute())
        return {"message": f"{len(rows)} training logs saved", "count": len(rows), "data": result.data}
    except Exception as e:
        log.error("POST /wellness/bulk-training-log failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save training logs. Try again.")


@router.get("/training-log/{athlete_name}")
def get_training_logs(athlete_name: str, academy_id: str = Query(...)):
    require_academy(academy_id)
    try:
        result = safe_query(
            lambda sb: sb.table("training_logs")
            .select("*")
            .eq("athlete_name", athlete_name.strip())
            .eq("academy_id", academy_id)
            .order("created_at", desc=True)
            .limit(7)
            .execute()
        )
        return {"logs": result.data}
    except Exception as e:
        log.error("GET /wellness/training-log/%s failed: %s", athlete_name, e)
        return {"logs": []}


@router.get("/history/{athlete_name}")
def get_athlete_history(athlete_name: str, academy_id: str = Query(...), days: int = 7):
    require_academy(academy_id)
    try:
        limit_count = min(days, 90) if days > 0 else 500
        result = safe_query(
            lambda sb: sb.table("checkins")
            .select("*")
            .eq("athlete_name", athlete_name.strip())
            .eq("academy_id", academy_id)
            .order("created_at", desc=True)
            .limit(limit_count)
            .execute()
        )
        return {"history": result.data}
    except Exception as e:
        log.error("GET /wellness/history/%s failed: %s", athlete_name, e)
        return {"history": []}


@router.post("/session-time")
def save_session_time(data: dict, academy_id: str = Query(...)):
    """Save the academy's daily session timing (start/end in HH:MM)."""
    require_academy(academy_id)
    try:
        session_time = {
            "start": data.get("start", "17:00"),
            "end": data.get("end", "19:00"),
        }
        safe_query(
            lambda sb: sb.table("academies")
            .update({"session_time": session_time})
            .eq("id", academy_id)
            .execute()
        )
        return {"message": "Session time saved", "session_time": session_time}
    except Exception as e:
        log.error("POST /wellness/session-time failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not save session time.")


@router.get("/session-time")
def get_session_time(academy_id: str = Query(...)):
    """Get the academy's saved session timing."""
    require_academy(academy_id)
    try:
        result = safe_query(
            lambda sb: sb.table("academies")
            .select("session_time")
            .eq("id", academy_id)
            .execute()
        )
        if result.data and result.data[0].get("session_time"):
            return {"session_time": result.data[0]["session_time"]}
        return {"session_time": None}
    except Exception as e:
        log.error("GET /wellness/session-time failed: %s", e)
        return {"session_time": None}


@router.get("/session-status")
def get_session_status(academy_id: str = Query(...)):
    """
    Check if today's session has been logged, and count recent unlogged sessions.

    Returns:
      - session_time: the saved start/end times
      - logged_today: whether any training logs exist for today
      - reminder_level: "none" | "soft" | "urgent"
        - none:   session logged OR not past deadline yet
        - soft:   past session_end + 3 hrs but before next session start
        - urgent: past next session start, still not logged
      - sessions_not_logged: count of recent days with no training log
    """
    require_academy(academy_id)
    try:
        # Get session time config
        academy_result = safe_query(
            lambda sb: sb.table("academies")
            .select("session_time")
            .eq("id", academy_id)
            .execute()
        )
        session_time = None
        if academy_result.data:
            session_time = academy_result.data[0].get("session_time")
        if not session_time:
            return {
                "session_time": None,
                "logged_today": True,
                "reminder_level": "none",
                "sessions_not_logged": 0,
            }

        # Check today's training logs
        now = datetime.now(timezone.utc)
        # Adjust for IST (UTC+5:30) since target market is India
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now + ist_offset
        today_str = now_ist.strftime("%Y-%m-%d")
        today_start = f"{today_str}T00:00:00+05:30"
        today_end = f"{today_str}T23:59:59+05:30"

        logs_today = safe_query(
            lambda sb: sb.table("training_logs")
            .select("id")
            .eq("academy_id", academy_id)
            .gte("created_at", today_start)
            .lte("created_at", today_end)
            .limit(1)
            .execute()
        )
        logged_today = bool(logs_today.data)

        # Determine reminder level based on current time vs session schedule
        reminder_level = "none"
        if not logged_today:
            try:
                end_h, end_m = map(int, session_time["end"].split(":"))
                start_h, start_m = map(int, session_time["start"].split(":"))
                current_hour = now_ist.hour
                current_min = now_ist.minute
                current_minutes = current_hour * 60 + current_min
                end_minutes = end_h * 60 + end_m
                start_minutes = start_h * 60 + start_m
                deadline_minutes = end_minutes + 180  # 3 hours after session end

                if current_minutes >= deadline_minutes:
                    # Past 3 hours after session end — check if next session started
                    # If deadline bleeds past midnight or next day's session start
                    next_day_start = start_minutes + 1440  # next day's start
                    if current_minutes >= next_day_start or current_minutes >= start_minutes:
                        reminder_level = "urgent"
                    else:
                        reminder_level = "soft"
                elif current_minutes >= end_minutes:
                    # Session ended but still within 3-hour grace — no reminder yet
                    reminder_level = "none"
            except (ValueError, KeyError):
                pass

        # Count sessions not logged in last 7 days (excluding today)
        sessions_not_logged = 0
        try:
            for days_ago in range(1, 8):
                check_date = now_ist - timedelta(days=days_ago)
                check_str = check_date.strftime("%Y-%m-%d")
                day_start = f"{check_str}T00:00:00+05:30"
                day_end = f"{check_str}T23:59:59+05:30"
                day_logs = safe_query(
                    lambda sb: sb.table("training_logs")
                    .select("id")
                    .eq("academy_id", academy_id)
                    .gte("created_at", day_start)
                    .lte("created_at", day_end)
                    .limit(1)
                    .execute()
                )
                if not day_logs.data:
                    sessions_not_logged += 1
        except Exception:
            pass

        return {
            "session_time": session_time,
            "logged_today": logged_today,
            "reminder_level": reminder_level,
            "sessions_not_logged": sessions_not_logged,
        }
    except Exception as e:
        log.error("GET /wellness/session-status failed: %s", e)
        return {
            "session_time": None,
            "logged_today": True,
            "reminder_level": "none",
            "sessions_not_logged": 0,
        }
