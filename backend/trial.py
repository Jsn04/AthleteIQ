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
            .select("plan, trial_ends_at")
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
        return True

    trial_ends_at = academy.get("trial_ends_at")
    if not trial_ends_at:
        return False
    try:
        expiry = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) <= expiry


def require_active_trial(academy_id: str):
    """Raise 402 unless the academy is paid or still in trial."""
    if not check_trial_access(academy_id):
        raise HTTPException(
            status_code=402,
            detail="Your free trial has expired. Upgrade to keep using AthleteIQ.",
        )
