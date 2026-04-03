from fastapi import APIRouter, HTTPException
from groq import Groq
import asyncio, json, os
from datetime import datetime, timezone, date
from supabase import create_client

router = APIRouter()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")


# ─── Trial gate helper ────────────────────────────────────────────────────────

def check_trial_access(academy_id: str):
    """
    Returns (allowed: bool, reason: str)
    - paid plan → always allowed
    - free plan, trial active → allowed
    - free plan, trial expired → blocked
    """
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    result = (
        supabase.table("academies")
        .select("plan, trial_ends_at")
        .eq("id", academy_id)
        .execute()
        .data
    )

    if not result:
        return False, "Academy not found"

    academy = result[0]

    if academy["plan"] == "paid":
        return True, "ok"

    trial_ends_at = academy.get("trial_ends_at")
    if not trial_ends_at:
        return False, "Trial not configured. Contact support."

    expiry = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        return False, "Your 14-day trial has expired. Upgrade to continue."

    return True, "ok"


# ─── Hardcoded recovery plan ──────────────────────────────────────────────────

def hardcoded_recovery_plan(sport: str, squad_size: int):
    return {
        "session_title": "Full Squad Recovery Session",
        "coach_note": "Squad readiness is critically low today. "
                      "High intensity training will increase injury risk. "
                      "Focus entirely on recovery and mental work.",
        "intensity_level": "Recovery",
        "warning": "Average squad readiness below 45 — "
                   "AI plan skipped. Recovery session auto-assigned.",
        "blocks": [
            {
                "name": "Light Activation",
                "duration_min": 10,
                "objective": "Get blood flowing without taxing the body",
                "drills": [
                    {
                        "name": "Easy jog + dynamic stretching",
                        "duration_min": 10,
                        "setup": "Full squad, single file, light pace around court/field",
                        "coaching_cue": "Breathing should be fully conversational throughout"
                    }
                ]
            },
            {
                "name": "Skill Walkthrough (No Intensity)",
                "duration_min": 20,
                "objective": "Reinforce technique at low effort — muscle memory only",
                "drills": [
                    {
                        "name": "Shadow drills / slow technique repetitions",
                        "duration_min": 20,
                        "setup": "Pairs or solo, sport-specific movement patterns at 40% pace",
                        "coaching_cue": "Focus on form only. Correct movement, not speed or power today."
                    }
                ]
            },
            {
                "name": "Mental Performance",
                "duration_min": 10,
                "objective": "Reset mentally — use the AthleteIQ mental tools",
                "drills": [
                    {
                        "name": "Guided breathing + visualisation",
                        "duration_min": 10,
                        "setup": "Seated or lying, quiet space, coach leads or uses app audio",
                        "coaching_cue": "This is training too. Champions recover as hard as they compete."
                    }
                ]
            },
            {
                "name": "Cooldown",
                "duration_min": 10,
                "objective": "Full body passive stretch",
                "drills": [
                    {
                        "name": "Static stretching circuit",
                        "duration_min": 10,
                        "setup": "Coach-led, hold each stretch 30 seconds",
                        "coaching_cue": "No bouncing. Breathe into each stretch."
                    }
                ]
            }
        ],
        "modifications": []
    }


# ─── Process squad data ───────────────────────────────────────────────────────

def process_squad_data(athletes: list, recent_sessions: list, sport: str, age_group: str):
    if not athletes:
        return None

    readiness_scores = [a.get("readiness", 50) for a in athletes]
    avg_readiness = round(sum(readiness_scores) / len(readiness_scores))

    flagged = []
    for a in athletes:
        r = a.get("readiness", 50)
        acwr = a.get("acwr_status", "Optimal")
        name = a.get("name", "Unknown")

        if r < 45 or acwr == "High Risk":
            flagged.append({"athlete_name": name, "readiness": r, "acwr_status": acwr, "flag": "REST"})
        elif r < 62 or acwr == "Caution":
            flagged.append({"athlete_name": name, "readiness": r, "acwr_status": acwr, "flag": "MODIFIED"})
        elif r >= 85 and acwr == "Optimal":
            flagged.append({"athlete_name": name, "readiness": r, "acwr_status": acwr, "flag": "PUSH"})

    return {
        "sport": sport,
        "age_group": age_group,
        "squad_size": len(athletes),
        "avg_readiness": avg_readiness,
        "recent_sessions": recent_sessions,
        "flagged_athletes": flagged
    }


# ─── Build Groq prompt ────────────────────────────────────────────────────────

def build_session_prompt(coach_input: dict, squad: dict) -> str:
    if squad["flagged_athletes"]:
        lines = []
        for f in squad["flagged_athletes"]:
            lines.append(
                f"- {f['athlete_name']}: readiness {f['readiness']}, "
                f"ACWR {f['acwr_status']}, flag {f['flag']}"
            )
        flagged_text = "\n".join(lines)
    else:
        flagged_text = "None — full squad cleared for normal training"

    recent = "\n".join(f"  - {s}" for s in squad["recent_sessions"]) if squad["recent_sessions"] else "  - No recent sessions logged"

    return f"""You are a professional sports performance coach.
Generate a complete structured training session plan.

SQUAD:
- Sport: {squad['sport']}
- Age Group: {squad['age_group']}
- Squad Size: {squad['squad_size']}
- Avg Readiness Today: {squad['avg_readiness']}/100
- Recent Sessions:
{recent}

COACH INPUT:
- Focus: {coach_input['focus']}
- Duration: {coach_input['duration']} minutes
- Specific Area: {coach_input.get('specific_area') or 'None'}
- Match Proximity: {coach_input['match_proximity']}

FLAGGED ATHLETES:
{flagged_text}

RULES:
- match_today: activation + walkthrough only, zero high intensity
- match_tomorrow: reduce intensity 40%, no contact drills
- match_3plus: normal plan
- no_match: normal plan
- REST athletes: assign sideline only (video review or mental work)
- MODIFIED athletes: lighter version of each block
- PUSH athletes: note they can handle extra load
- Keep total block durations equal to session duration exactly

Return ONLY raw JSON. No markdown. No explanation. This exact structure:
{{
  "session_title": "",
  "coach_note": "",
  "intensity_level": "",
  "warning": "",
  "blocks": [
    {{
      "name": "",
      "duration_min": 0,
      "objective": "",
      "drills": [
        {{
          "name": "",
          "duration_min": 0,
          "setup": "",
          "coaching_cue": ""
        }}
      ]
    }}
  ],
  "modifications": [
    {{
      "athlete_name": "",
      "flag": "",
      "modification": ""
    }}
  ]
}}"""


# ─── Fetch squad data ─────────────────────────────────────────────────────────

def fetch_squad_data(academy_id: str):
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    athletes_res = (
        supabase.table("athletes")
        .select("id, name, sport")
        .eq("academy_id", academy_id)
        .eq("is_deleted", False)
        .execute()
    )

    athletes = athletes_res.data
    sports = [a.get("sport") for a in athletes if a.get("sport")]
    sport = max(set(sports), key=sports.count) if sports else "General"

    today = date.today().isoformat()
    try:
        checkins_res = (
            supabase.table("checkins")
            .select("athlete_name, energy, sleep, soreness, mood")
            .eq("academy_id", academy_id)
            .gte("created_at", today)
            .execute()
        )

        checkin_map = {}
        for c in checkins_res.data:
            name = (c.get("athlete_name") or "").lower().strip()
            energy   = c.get("energy", 5) or 5
            sleep    = c.get("sleep", 5) or 5
            soreness = c.get("soreness", 5) or 5
            mood     = c.get("mood", 5) or 5
            score = round(((energy + sleep + (10 - soreness) + mood) / 40) * 100)
            checkin_map[name] = score
    except Exception:
        checkin_map = {}

    for a in athletes:
        key = (a.get("name") or "").lower().strip()
        a["readiness"] = checkin_map.get(key, 50)
        a["acwr_status"] = "Optimal"

    try:
        sessions_res = supabase.table("training_logs")\
            .select("*")\
            .eq("academy_id", academy_id)\
            .order("created_at", desc=True)\
            .limit(3)\
            .execute()

        recent = []
        for s in sessions_res.data:
            recent.append(
                f"{s.get('session_type') or s.get('type') or 'Session'}, "
                f"{s.get('duration', 0)}min, "
                f"intensity {s.get('intensity') or s.get('avg_intensity') or 0}"
            )
    except Exception:
        recent = []

    return {"sport": sport, "age_group": "Senior", "athletes": athletes, "recent_sessions": recent}


# ─── Rate limit check ─────────────────────────────────────────────────────────

def check_rate_limit(coach_id: str):
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    now = datetime.now(timezone.utc)

    result = (
        supabase.table("session_plans")
        .select("created_at")
        .eq("coach_id", coach_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if result.data:
        last = datetime.fromisoformat(result.data[0]["created_at"].replace("Z", "+00:00"))
        diff = (now - last).total_seconds()
        if diff < 120:
            return False, int(120 - diff)

    return True, 0


# ─── Save plan ────────────────────────────────────────────────────────────────

def save_plan(coach_id: str, academy_id: str, coach_input: dict, plan: dict):
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    supabase.table("session_plans").insert({
        "coach_id":      coach_id,
        "academy_id":    academy_id,
        "coach_input":   coach_input,
        "generated_plan": plan,
        "created_at":    datetime.now(timezone.utc).isoformat()
    }).execute()


# ─── Main route ───────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_session_plan(payload: dict):

    academy_id  = payload.get("academy_id")
    coach_input = payload.get("coach_input")
    coach_id    = payload.get("coach_id") or f"coach_{academy_id}"

    if not all([academy_id, coach_input]):
        return {"status": "error", "message": "Missing required fields"}

    for f in ["focus", "duration", "match_proximity"]:
        if f not in coach_input:
            return {"status": "error", "message": f"Missing coach_input field: {f}"}

    # ← Trial gate — checked before anything else
    allowed, reason = await asyncio.to_thread(check_trial_access, academy_id)
    if not allowed:
        return {"status": "trial_expired", "message": reason}

    # Rate limit
    allowed, wait_seconds = await asyncio.to_thread(check_rate_limit, coach_id)
    if not allowed:
        return {"status": "rate_limited", "message": f"Please wait {wait_seconds} seconds before generating again"}

    raw = await asyncio.to_thread(fetch_squad_data, academy_id)
    squad = process_squad_data(raw["athletes"], raw["recent_sessions"], raw["sport"], raw["age_group"])

    if not squad:
        return {"status": "error", "message": "No athletes found for this academy"}

    if squad["avg_readiness"] < 45:
        plan = hardcoded_recovery_plan(squad["sport"], squad["squad_size"])
        await asyncio.to_thread(save_plan, coach_id, academy_id, coach_input, plan)
        return {"status": "success", "plan": plan, "source": "hardcoded"}

    prompt = build_session_prompt(coach_input, squad)
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    response = await asyncio.to_thread(
        lambda: client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.3
        )
    )

    raw_text = response.choices[0].message.content
    clean = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        plan = json.loads(clean)
    except json.JSONDecodeError:
        try:
            start = clean.index("{")
            end = clean.rindex("}") + 1
            plan = json.loads(clean[start:end])
        except (ValueError, json.JSONDecodeError):
            return {"status": "error", "message": "AI returned malformed response. Please try again."}

    await asyncio.to_thread(save_plan, coach_id, academy_id, coach_input, plan)
    return {"status": "success", "plan": plan, "source": "groq"}