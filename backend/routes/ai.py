import asyncio
import os
from datetime import datetime, timezone

from fastapi import APIRouter
from supabase import create_client

from config import AI_PROVIDER, AI_MODEL, GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY

router = APIRouter()


def get_supabase():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def _call_llm_sync(prompt: str, max_tokens: int = 250) -> str:
    max_tokens = min(max_tokens, 250)

    if AI_PROVIDER == "groq":
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()

    elif AI_PROVIDER == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()

    elif AI_PROVIDER == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    else:
        raise ValueError(f"Unknown AI_PROVIDER: '{AI_PROVIDER}'.")


async def call_llm(prompt: str, max_tokens: int = 250) -> str:
    return await asyncio.to_thread(_call_llm_sync, prompt, max_tokens)


def calculate_acwr(training_logs: list) -> dict:
    if not training_logs:
        return {"acwr": 0.0, "acute_load": 0, "chronic_load": 0, "risk_tier": "No Data", "readiness": 50}

    intensity_map = {"Low": 0.6, "Medium": 1.0, "High": 1.4}

    def session_load(log):
        duration = log.get("duration") or 0
        if duration == 0:
            return 0
        rpe = log.get("rpe") or 5
        multiplier = intensity_map.get(log.get("intensity", "Medium"), 1.0)
        return duration * rpe * multiplier

    all_loads = [session_load(l) for l in training_logs]
    all_loads = [l for l in all_loads if l > 0]  # remove sat-out sessions

    if not all_loads:
        return {"acwr": 0.0, "acute_load": 0, "chronic_load": 0, "risk_tier": "No Data", "readiness": 50}

    # Acute = last 3 sessions (most recent load)
    # Chronic = average session load across all available data
    acute_count  = min(3, len(all_loads))
    acute_load   = sum(all_loads[:acute_count])
    chronic_load = sum(all_loads) / len(all_loads) * acute_count

    acwr = round(acute_load / chronic_load, 2) if chronic_load else 0.0

    if acwr < 0.8:
        risk_tier, readiness = "Undertraining", 65
    elif acwr <= 1.3:
        risk_tier, readiness = "Optimal", 88
    elif acwr <= 1.5:
        risk_tier, readiness = "Caution", 55
    else:
        risk_tier, readiness = "High Risk", 25

    return {
        "acwr": acwr,
        "acute_load": round(acute_load),
        "chronic_load": round(chronic_load),
        "risk_tier": risk_tier,
        "readiness": readiness,
    }


async def _get_cached_insight(supabase, athlete_name: str, academy_id: str):
    try:
        result = await asyncio.to_thread(
            lambda: supabase.table("ai_insights_cache")
            .select("insight, metrics, created_at")
            .eq("athlete_name", athlete_name)
            .eq("academy_id", academy_id)
            .execute()
        )
        if not result.data:
            return None
        cached    = result.data[0]
        cached_at = datetime.fromisoformat(cached["created_at"].replace("Z", "+00:00"))
        age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600
        if age_hours < 12:
            return {"insight": cached["insight"], "metrics": cached["metrics"],
                    "cached": True, "cache_age_mins": round(age_hours * 60)}
        return None
    except Exception:
        return None


async def _save_insight_cache(supabase, athlete_name: str, academy_id: str, insight: str, metrics: dict):
    try:
        await asyncio.to_thread(
            lambda: supabase.table("ai_insights_cache")
            .upsert(
                {"athlete_name": athlete_name, "academy_id": academy_id,
                 "insight": insight, "metrics": metrics,
                 "created_at": datetime.now(timezone.utc).isoformat()},
                on_conflict="athlete_name,academy_id",
            )
            .execute()
        )
    except Exception:
        pass


@router.get("/insights/{athlete_name}")
async def get_athlete_insight(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    cached = await _get_cached_insight(supabase, athlete_name, academy_id)
    if cached:
        return cached

    checkins_result = await asyncio.to_thread(
        lambda: supabase.table("checkins").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(7).execute()
    )
    training_result = await asyncio.to_thread(
        lambda: supabase.table("training_logs").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(28).execute()
    )

    checkins = checkins_result.data or []
    training = training_result.data or []

    if not checkins and not training:
        return {"insight": "No data yet", "risk": "unknown", "score": None, "cached": False}

    metrics        = calculate_acwr(training)
    latest_checkin = checkins[0] if checkins else {}

    checkin_summary = (
        "\n".join([
            f"- Energy {c['energy']}/10, Sleep {c['sleep']}/10, Soreness {c['soreness']}/10, Mood {c['mood']}/10"
            for c in checkins
        ]) if checkins else "No wellness check-ins submitted yet"
    )

    prompt = f"""You are an elite sports physiotherapist and performance coach.

Athlete: {athlete_name}
Readiness Score: {metrics['readiness']}/100
Workload Status: {metrics['risk_tier']} (ACWR: {metrics['acwr']})
Today — Energy: {latest_checkin.get('energy', 'N/A')}/10, Sleep: {latest_checkin.get('sleep', 'N/A')}/10, Soreness: {latest_checkin.get('soreness', 'N/A')}/10

Recent wellness check-ins:
{checkin_summary}

Respond in EXACTLY this format:
INSIGHT: [one practical sentence for the coach]
RISK: [green or yellow or red]
SCORE: [readiness number 0-100]
ATHLETE_MESSAGE: [one motivating sentence for the athlete]"""

    text   = await call_llm(prompt, max_tokens=200)
    result = {"cached": False, "cache_age_mins": 0}

    for line in text.split("\n"):
        if line.startswith("INSIGHT:"):
            result["insight"] = line.replace("INSIGHT:", "").strip()
        elif line.startswith("RISK:"):
            result["risk"] = line.replace("RISK:", "").strip().lower()
        elif line.startswith("SCORE:"):
            try:
                result["score"] = int(line.replace("SCORE:", "").strip())
            except Exception:
                result["score"] = metrics["readiness"]
        elif line.startswith("ATHLETE_MESSAGE:"):
            result["athlete_message"] = line.replace("ATHLETE_MESSAGE:", "").strip()

    result["metrics"] = metrics
    await _save_insight_cache(supabase, athlete_name, academy_id, result.get("insight", ""), metrics)
    return result


@router.get("/squad-insights")
async def get_squad_insights(academy_id: str = ""):
    supabase = get_supabase()

    athletes_result = await asyncio.to_thread(
        lambda: supabase.table("athletes").select("*").eq("academy_id", academy_id).execute()
    )
    checkins_result = await asyncio.to_thread(
        lambda: supabase.table("checkins").select("*").eq("academy_id", academy_id)
        .order("created_at", desc=True).execute()
    )
    training_result = await asyncio.to_thread(
        lambda: supabase.table("training_logs").select("*").eq("academy_id", academy_id)
        .order("created_at", desc=True).execute()
    )

    athletes_data = athletes_result.data or []
    checkins      = checkins_result.data or []
    training      = training_result.data or []

    squad_summary = ""
    for athlete in athletes_data:
        latest_checkin  = next((c for c in checkins if c["athlete_name"] == athlete["name"]), None)
        latest_training = next((t for t in training if t["athlete_name"] == athlete["name"]), None)

        if latest_checkin:
            squad_summary += (
                f"\n{athlete['name']} ({athlete['sport']}): "
                f"Energy {latest_checkin['energy']}, Sleep {latest_checkin['sleep']}, Soreness {latest_checkin['soreness']}"
            )
            if latest_training:
                squad_summary += (
                    f", Last training: {latest_training['intensity']} for {latest_training['duration']} mins"
                    f", RPE: {latest_training.get('rpe', 'N/A')}/10"
                )
        elif latest_training:
            squad_summary += (
                f"\n{athlete['name']} ({athlete['sport']}): No check-in, "
                f"Last training: {latest_training['intensity']} for {latest_training['duration']} mins"
                f", RPE: {latest_training.get('rpe', 'N/A')}/10"
            )

    if not squad_summary:
        return {"squad_insight": "No data available yet for the squad."}

    prompt = f"""You are an elite sports coach analyzing your full squad.

Squad data:
{squad_summary}

Respond in EXACTLY this format:
SQUAD_INSIGHT: [2 sentences — one observation about squad state, one actionable recommendation for today]"""

    text = await call_llm(prompt, max_tokens=150)
    return {"squad_insight": text.replace("SQUAD_INSIGHT:", "").strip()}


@router.get("/weekly-summary/{athlete_name}")
async def get_weekly_summary(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    checkins_result = await asyncio.to_thread(
        lambda: supabase.table("checkins").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(7).execute()
    )
    training_result = await asyncio.to_thread(
        lambda: supabase.table("training_logs").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(7).execute()
    )

    checkins = checkins_result.data or []
    training = training_result.data or []

    if not checkins and not training:
        return {"summary": "No data available yet to generate a weekly summary."}

    metrics = calculate_acwr(training)

    checkin_summary = (
        "\n".join([
            f"- {c['created_at'][:10]}: Energy {c['energy']}/10, Sleep {c['sleep']}/10, "
            f"Soreness {c['soreness']}/10, Mood {c['mood']}/10"
            + (f", Notes: {c['notes']}" if c.get("notes") else "")
            for c in checkins
        ]) if checkins else "No wellness check-ins this week"
    )

    training_summary = (
        "\n".join([
            f"- {t['created_at'][:10]}: {t['intensity']} intensity, {t['duration']} mins, RPE {t.get('rpe', 'N/A')}/10"
            + (f", Notes: {t['coach_notes']}" if t.get("coach_notes") else "")
            for t in training
        ]) if training else "No training logs this week"
    )

    prompt = f"""You are an elite sports performance coach writing a weekly progress report.

Athlete: {athlete_name}
Workload: {metrics['risk_tier']} (ACWR {metrics['acwr']}) — Readiness {metrics['readiness']}/100

Wellness this week:
{checkin_summary}

Training this week:
{training_summary}

Write a concise 3-sentence summary: wellness trend, training load assessment, one recommendation for next week. Speak directly to a coach."""

    text = await call_llm(prompt, max_tokens=250)
    return {"summary": text}


@router.get("/injury-risk/{athlete_name}")
async def get_injury_risk(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    checkins_result = await asyncio.to_thread(
        lambda: supabase.table("checkins").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(28).execute()
    )
    training_result = await asyncio.to_thread(
        lambda: supabase.table("training_logs").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(28).execute()
    )

    checkins = checkins_result.data or []
    training = training_result.data or []

    if not checkins and not training:
        return {"injury_risk_score": None, "acwr": None, "signals": [],
                "verdict": "No data available yet", "risk_level": "unknown", "deception_flag": False}

    metrics = calculate_acwr(training)
    acwr    = metrics["acwr"]

    coach_notes_combined = " ".join([
        t.get("coach_notes", "").lower() for t in training[:7] if t.get("coach_notes")
    ])

    notes_score, notes_signals       = 0, []
    athlete_score, athlete_signals   = 0, []
    acwr_score, acwr_signals         = 0, []
    deception_flag, mismatch_signals = False, []

    subtle_keywords = ["tired", "flat", "sluggish", "heavy legs", "looked off",
                       "not himself", "not herself", "seemed off", "low energy",
                       "unmotivated", "lethargic", "slow", "labored"]
    if any(w in coach_notes_combined for w in subtle_keywords):
        notes_score += 8
        notes_signals.append("Coach noted subtle fatigue or low energy signs")

    load_keywords = ["reduced load", "modified session", "light work only", "kept it easy",
                     "held back", "limited reps", "sat out drills", "reduced intensity", "short session"]
    if any(w in coach_notes_combined for w in load_keywords):
        notes_score += 12
        notes_signals.append("Coach already modified or reduced training load")

    pain_keywords = ["pain", "complained", "discomfort", "sore", "aching",
                     "tight", "stiff", "tender", "hurts", "hurting", "painful"]
    if any(w in coach_notes_combined for w in pain_keywords):
        notes_score += 15
        notes_signals.append("Coach notes mention pain or discomfort")

    compensation_keywords = ["limping", "favoring", "protecting", "guarding", "compensating",
                              "altered gait", "not moving right", "avoiding", "one-sided", "uneven"]
    if any(w in coach_notes_combined for w in compensation_keywords):
        notes_score += 20
        notes_signals.append("Coach observed movement compensation or altered gait")

    stoppage_keywords = ["pulled out", "stopped early", "sat out", "couldn't finish",
                         "left session", "withdrew", "pulled up", "had to stop", "taken off", "subbed off"]
    if any(w in coach_notes_combined for w in stoppage_keywords):
        notes_score += 25
        notes_signals.append("Athlete stopped session early or was withdrawn")

    notes_score = min(notes_score, 25)

    recent_checkins = checkins[:7]

    if recent_checkins:
        soreness_vals = [c["soreness"] for c in recent_checkins if c.get("soreness") is not None]
        if soreness_vals:
            avg_soreness = sum(soreness_vals) / len(soreness_vals)
            last3 = soreness_vals[:3]
            if len(last3) >= 3 and all(s >= 7 for s in last3):
                athlete_score += 20
                athlete_signals.append(f"3 consecutive days of high soreness: {last3}")
            elif avg_soreness >= 7:
                athlete_score += 13
                athlete_signals.append(f"High average soreness: {round(avg_soreness, 1)}/10")
            elif avg_soreness >= 5:
                athlete_score += 6
                athlete_signals.append(f"Moderate soreness trend: {round(avg_soreness, 1)}/10")

        sleep_vals = [c["sleep"] for c in recent_checkins if c.get("sleep") is not None]
        if sleep_vals:
            avg_sleep = sum(sleep_vals) / len(sleep_vals)
            last3_sleep = sleep_vals[:3]
            if len(last3_sleep) >= 3 and all(s <= 5 for s in last3_sleep):
                athlete_score += 15
                athlete_signals.append(f"3 consecutive nights of poor sleep: {last3_sleep}")
            elif avg_sleep <= 5:
                athlete_score += 10
                athlete_signals.append(f"Chronic sleep deficit: avg {round(avg_sleep, 1)}/10")
            elif avg_sleep <= 6:
                athlete_score += 5
                athlete_signals.append(f"Below average sleep: avg {round(avg_sleep, 1)}/10")

    if training and recent_checkins:
        latest_training  = training[0]
        latest_checkin   = recent_checkins[0]
        coach_rpe        = latest_training.get("rpe")
        athlete_energy   = latest_checkin.get("energy")
        athlete_soreness = latest_checkin.get("soreness")

        if coach_rpe is not None and athlete_energy is not None:
            mismatch = coach_rpe - (10 - athlete_energy)
            if mismatch >= 5:
                athlete_score += 20
                deception_flag = True
                mismatch_signals.append(f"High deception risk — coach RPE {coach_rpe}/10 but athlete energy {athlete_energy}/10")
            elif mismatch >= 3:
                athlete_score += 10
                mismatch_signals.append(f"Moderate mismatch — coach RPE {coach_rpe}/10 vs athlete energy {athlete_energy}/10")

        if athlete_soreness is not None and athlete_soreness <= 2 and latest_training.get("intensity") == "High":
            athlete_score += 10
            deception_flag = True
            mismatch_signals.append("Suspicious — near-zero soreness reported after High intensity session")

    if acwr:
        if acwr > 1.5:
            acwr_score += 20
            acwr_signals.append(f"Training spike — ACWR {acwr} above danger threshold of 1.5")
        elif acwr > 1.3:
            acwr_score += 10
            acwr_signals.append(f"Elevated training load — ACWR {acwr} in caution zone")
        elif acwr < 0.8:
            acwr_score += 5
            acwr_signals.append(f"Undertraining — ACWR {acwr} below 0.8")

    total_score = min(notes_score + athlete_score + acwr_score, 100)
    risk_level  = "red" if total_score >= 70 else ("yellow" if total_score >= 40 else "green")
    all_signals = acwr_signals + notes_signals + mismatch_signals + athlete_signals

    deception_context = (
        "IMPORTANT: Deception risk detected. Athlete self-report inconsistent with coach data. Flag to coach."
        if deception_flag else ""
    )

    signals_text = "\n".join([f"- {s}" for s in all_signals]) if all_signals else "No major risk signals detected"

    prompt = f"""You are a sports physiotherapist reviewing injury risk data.

Athlete: {athlete_name}
Risk score: {total_score}/100 | ACWR: {acwr} | Risk level: {risk_level}
Workload: {metrics['risk_tier']}

Signals:
{signals_text}

{deception_context}

Write a 2-sentence verdict: sentence 1 is the main risk and why, sentence 2 is one specific action for today. If deception is flagged, mention it directly."""

    verdict = await call_llm(prompt, max_tokens=150)

    return {
        "injury_risk_score": total_score,
        "acwr":              acwr,
        "signals":           all_signals,
        "verdict":           verdict,
        "risk_level":        risk_level,
        "deception_flag":    deception_flag,
        "metrics":           metrics,
    }


@router.get("/drills/{athlete_name}")
async def get_drill_suggestions(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    checkins_result = await asyncio.to_thread(
        lambda: supabase.table("checkins").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(3).execute()
    )
    training_result = await asyncio.to_thread(
        lambda: supabase.table("training_logs").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(3).execute()
    )
    athletes_result = await asyncio.to_thread(
        lambda: supabase.table("athletes").select("*")
        .eq("name", athlete_name).eq("academy_id", academy_id).limit(1).execute()
    )

    checkins      = checkins_result.data or []
    training      = training_result.data or []
    athletes_data = athletes_result.data or []

    sport = athletes_data[0]["sport"] if athletes_data else "General"
    age   = athletes_data[0].get("age") if athletes_data else None

    if not checkins and not training:
        return {"drills": [], "context": "No data available yet — drills will generate after first check-in."}

    latest = checkins[0] if checkins else None
    wellness_context = (
        f"Energy: {latest['energy']}/10, Sleep: {latest['sleep']}/10, "
        f"Soreness: {latest['soreness']}/10, Mood: {latest['mood']}/10"
        if latest else "No wellness data"
    )

    training_context = (
        "\n".join([
            f"- {t['intensity']} intensity, {t['duration']} mins, RPE {t.get('rpe', 'N/A')}/10"
            + (f", Notes: {t['coach_notes']}" if t.get("coach_notes") else "")
            for t in training
        ]) if training else "No recent training logs"
    )

    age_context = f"Age: {age}" if age else ""

    prompt = f"""You are an elite {sport} coach with 20+ years experience.

Athlete: {athlete_name} | Sport: {sport} | {age_context}
Wellness today: {wellness_context}
Recent training (last 3): {training_context}

Design exactly 3 {sport}-specific drills for today. Real {sport} terminology only. No generic exercises.

Rules:
- Soreness >= 7 or energy <= 4: low-intensity skill refinement and active recovery only
- Soreness 5-6 or energy 5-6: moderate drills, one recovery element
- Soreness <= 4 and energy >= 7: match-intensity, advanced combinations
- Mood <= 4: include one fun game-based drill

Format (repeat 3 times):
DRILL: [name]
CATEGORY: [Warmup/Skill/Strength/Recovery/Conditioning]
DURATION: [mins]
INTENSITY: [Low/Medium/High]
REASON: [one sentence referencing today's wellness numbers]
---"""

    raw    = await call_llm(prompt, max_tokens=250)
    drills = []

    for block in raw.split("---"):
        block = block.strip()
        if not block:
            continue
        drill = {}
        for line in block.split("\n"):
            line = line.strip()
            if line.startswith("DRILL:"):      drill["name"]      = line.replace("DRILL:", "").strip()
            elif line.startswith("CATEGORY:"): drill["category"]  = line.replace("CATEGORY:", "").strip()
            elif line.startswith("DURATION:"): drill["duration"]  = line.replace("DURATION:", "").strip()
            elif line.startswith("INTENSITY:"): drill["intensity"] = line.replace("INTENSITY:", "").strip()
            elif line.startswith("REASON:"):   drill["reason"]    = line.replace("REASON:", "").strip()
        if drill.get("name"):
            drills.append(drill)

    return {
        "drills":  drills[:3],
        "sport":   sport,
        "context": wellness_context if latest else "No check-in data",
        "athlete": athlete_name,
    }


@router.get("/parent-recovery/{athlete_name}")
async def get_parent_recovery(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    athletes_result = await asyncio.to_thread(
        lambda: supabase.table("athletes").select("*")
        .eq("name", athlete_name).eq("academy_id", academy_id).limit(1).execute()
    )
    checkins_result = await asyncio.to_thread(
        lambda: supabase.table("checkins").select("*")
        .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
        .order("created_at", desc=True).limit(7).execute()
    )

    athletes_data = athletes_result.data or []
    checkins      = checkins_result.data or []

    sport  = athletes_data[0]["sport"] if athletes_data else "General"
    age    = athletes_data[0].get("age") if athletes_data else None
    latest = checkins[0] if checkins else None

    risk_level, risk_signals = "green", []

    if latest:
        soreness = latest.get("soreness", 5)
        energy   = latest.get("energy", 5)
        sleep    = latest.get("sleep", 5)
        mood     = latest.get("mood", 5)

        if soreness >= 7 or energy <= 3:
            risk_level = "red"
            if soreness >= 7: risk_signals.append(f"high soreness ({soreness}/10)")
            if energy <= 3:   risk_signals.append(f"very low energy ({energy}/10)")
        elif soreness >= 5 or energy <= 5 or sleep <= 4:
            risk_level = "yellow"
            if soreness >= 5: risk_signals.append(f"moderate soreness ({soreness}/10)")
            if energy <= 5:   risk_signals.append(f"below average energy ({energy}/10)")
            if sleep <= 4:    risk_signals.append(f"poor sleep ({sleep}/10)")

        wellness_text = f"Energy: {energy}/10, Sleep: {sleep}/10, Soreness: {soreness}/10, Mood: {mood}/10"
    else:
        wellness_text = "No recent check-in data available"

    if risk_level == "green":
        return {
            "risk_level":    "green",
            "coach_message": (
                f"{athlete_name.split(' ')[0]} is in good shape! "
                "Wellness numbers look healthy. Keep encouraging regular sleep, hydration, and balanced meals."
            ),
            "exercises": [],
            "athlete":   athlete_name,
            "sport":     sport,
        }

    age_text = f"Age: {age}" if age else ""
    severity = "HIGH RISK" if risk_level == "red" else "MODERATE CONCERN"

    prompt = f"""You are a sports physiotherapist writing a home recovery plan for a parent. The parent has no sports background.

Athlete: {athlete_name} | Sport: {sport} | {age_text}
Risk: {severity}
Wellness: {wellness_text}
Concerns: {', '.join(risk_signals)}

Rules:
- Exactly 3 exercises, no gym equipment needed
- Simple language a non-sports parent understands
- One general wellness tip (sleep, nutrition, or hydration)
- 2-sentence reassuring coach message to parent

Format:
COACH_MESSAGE: [2 sentences]
---
EXERCISE: [name]
HOW: [1 sentence]
DURATION: [e.g. 10 minutes]
WHY: [1 sentence]
---
EXERCISE: [name]
HOW: [1 sentence]
DURATION: [e.g. 10 minutes]
WHY: [1 sentence]
---
EXERCISE: [name]
HOW: [1 sentence]
DURATION: [e.g. 10 minutes]
WHY: [1 sentence]
---"""

    raw           = await call_llm(prompt, max_tokens=250)
    coach_message = ""
    exercises     = []

    for block in raw.split("---"):
        block = block.strip()
        if not block:
            continue
        if block.startswith("COACH_MESSAGE:"):
            coach_message = block.replace("COACH_MESSAGE:", "").strip()
            continue
        exercise = {}
        for line in block.split("\n"):
            line = line.strip()
            if line.startswith("EXERCISE:"):  exercise["name"]     = line.replace("EXERCISE:", "").strip()
            elif line.startswith("HOW:"):     exercise["how"]      = line.replace("HOW:", "").strip()
            elif line.startswith("DURATION:"): exercise["duration"] = line.replace("DURATION:", "").strip()
            elif line.startswith("WHY:"):     exercise["why"]      = line.replace("WHY:", "").strip()
        if exercise.get("name"):
            exercises.append(exercise)

    return {
        "risk_level":    risk_level,
        "coach_message": coach_message,
        "exercises":     exercises[:3],
        "athlete":       athlete_name,
        "sport":         sport,
    }