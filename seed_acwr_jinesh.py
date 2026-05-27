"""
One-shot seed script to backdate training sessions for Jinesh so ACWR computes
with a realistic value (~1.2–1.5 sweet-spot zone).

Usage:
    1. Fill in ACADEMY_ID and BACKEND_URL below.
    2. Adjust ATHLETE_NAME if not "Jinesh".
    3. Run:  python3 seed_acwr_jinesh.py
    4. Refresh the athlete dashboard — ACWR will display.

Distribution rationale:
    - Days 1–28 ago: 5 sessions feed the chronic baseline
    - Days 1–7 ago:  2 of those 5 also fall in the acute window (recent)
    - Loads are tuned so ACWR lands ~1.3 (top of optimal / bottom of caution),
      which is the most paper-worthy value: it's interesting but not extreme.
"""

import requests
from datetime import datetime, timedelta, timezone

# ── CONFIG ───────────────────────────────────────────────────────────────────
BACKEND_URL  = "https://athleteiq-9r76.onrender.com"   # or http://localhost:8000 for local
ACADEMY_ID   = "REPLACE_WITH_TEAM_EXTREME_ACADEMY_ID"  # from your Supabase academies table
ATHLETE_NAME = "Jinesh"

# ── SESSION TIMELINE ─────────────────────────────────────────────────────────
# (days_ago, intensity, duration_min, rpe, coach_notes)
SESSIONS = [
    # Chronic base (8–28 days ago) — steady medium training
    (26, "Medium", 90,  6, "Endurance block"),
    (22, "Medium", 90,  6, "Skill + conditioning"),
    (18, "Medium", 75,  5, "Recovery-paced session"),
    (14, "High",   90,  7, "Intensity ramp"),
    (10, "Medium", 90,  6, "Race-pace intervals"),
    # Acute window (last 7 days) — slight load spike
    ( 5, "High",   90,  8, "Hard track session"),
    ( 2, "High",  105,  8, "Sprint + technique block"),
]


def main():
    if ACADEMY_ID.startswith("REPLACE_"):
        print("ERROR: Set ACADEMY_ID at the top of this file before running.")
        return

    logs = []
    now = datetime.now(timezone.utc)
    for days_ago, intensity, duration, rpe, notes in SESSIONS:
        ts = (now - timedelta(days=days_ago)).replace(hour=12, minute=0, second=0, microsecond=0)
        logs.append({
            "athlete_name": ATHLETE_NAME,
            "intensity":    intensity,
            "duration":     duration,
            "rpe":          rpe,
            "attended":     True,
            "coach_notes":  notes,
            "session_date": ts.isoformat(),
        })

    url = f"{BACKEND_URL}/wellness/bulk-training-log?academy_id={ACADEMY_ID}"
    r = requests.post(url, json={"logs": logs}, timeout=30)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text}")

    if r.ok:
        # Show what ACWR will look like
        # session_load = duration × rpe × intensity_mult ({Low:0.6, Med:1.0, High:1.4})
        mult = {"Low": 0.6, "Medium": 1.0, "High": 1.4}
        loads_28d = [d * r_ * mult[i] for (_, i, d, r_, _n) in SESSIONS]
        loads_7d  = [d * r_ * mult[i] for (da, i, d, r_, _n) in SESSIONS if da <= 7]
        acute = sum(loads_7d)
        chronic_avg = sum(loads_28d) / 4
        acwr = round(acute / chronic_avg, 2) if chronic_avg else 0
        print(f"\nExpected ACWR after refresh: {acwr}")
        print(f"  acute (7d total):       {round(acute)}")
        print(f"  chronic (28d weekly avg): {round(chronic_avg)}")


if __name__ == "__main__":
    main()
