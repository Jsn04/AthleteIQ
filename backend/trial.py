"""Trial / paid-plan gate.

Lives outside routes/ so every router can import it without pulling in ai.py.
The frontend also checks the trial from localStorage, but that is a convenience
for the UI only — it can be edited in devtools, so the real gate is here.
"""
import logging
from datetime import datetime, timezone

from fastapi import HTTPException

from db import safe_query

log = logging.getLogger(__name__)


def check_trial_access(academy_id: str) -> bool:
    """True if the academy is paid or still inside its trial window."""
    if not academy_id:
        return False
    if academy_id.startswith("solo_"):
        return True
    try:
        result = safe_query(
            lambda sb: sb.table("academies")
            .select("plan, trial_ends_at, paid_until")
            .eq("id", academy_id)
            .execute().data
        )
    except Exception as e:
        # Never lock a paying academy out because Supabase blipped.
        log.error("trial check failed for %s, allowing through: %s", academy_id, e)
        return True

    if not result:
        return False
    academy = result[0]
    if academy.get("plan") == "paid":
        paid_until = academy.get("paid_until")
        # A paid row with no paid_until predates expiry tracking — grandfather it.
        if not paid_until:
            return True
        return datetime.now(timezone.utc) <= _parse_ts(paid_until)

    trial_ends_at = academy.get("trial_ends_at")
    if not trial_ends_at:
        return False
    return datetime.now(timezone.utc) <= _parse_ts(trial_ends_at)


def _parse_ts(raw: str) -> datetime:
    """Parse a Supabase timestamp; an unparseable one counts as long expired."""
    try:
        ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return datetime.min.replace(tzinfo=timezone.utc)
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def require_active_trial(academy_id: str):
    """Raise 402 unless the academy is paid or still in trial."""
    if not check_trial_access(academy_id):
        raise HTTPException(
            status_code=402,
            detail="Your free trial has expired. Upgrade to keep using AthleteIQ.",
        )


def enforce_athlete_cap(academy_id: str):
    """Raise 402 if adding one more athlete would exceed the plan's cap.

    Trial academies get the entry-tier cap; an unrecognised or missing tier
    falls back to the same. Institution has no cap.
    """
    from plans import athlete_cap, TRIAL_CAP

    try:
        rows = safe_query(
            lambda sb: sb.table("academies")
            .select("plan, plan_tier")
            .eq("id", academy_id)
            .execute().data
        )
        academy = (rows or [{}])[0]
        cap = athlete_cap(academy.get("plan_tier")) if academy.get("plan") == "paid" else TRIAL_CAP
        if cap is None:
            return

        current = safe_query(
            lambda sb: sb.table("athletes")
            .select("id", count="exact")
            .eq("academy_id", academy_id)
            .eq("is_deleted", False)
            .execute()
        ).count or 0
    except Exception as e:
        # A counting failure must not block a legitimate add.
        log.error("athlete cap check failed for %s, allowing through: %s", academy_id, e)
        return

    if current >= cap:
        raise HTTPException(
            status_code=402,
            detail=f"You have reached your plan limit of {cap} athletes. Upgrade to add more.",
        )
