from fastapi import APIRouter
from supabase import create_client
import os

from config import AI_PROVIDER, AI_MODEL, GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY

router = APIRouter()

def get_supabase():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def call_llm(prompt: str, max_tokens: int = 300) -> str:
    if AI_PROVIDER == "groq":
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()

    elif AI_PROVIDER == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()

    elif AI_PROVIDER == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=AI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()

    else:
        raise ValueError(f"Unknown AI_PROVIDER: '{AI_PROVIDER}'. Use 'groq', 'openai', or 'anthropic'.")


# ─── Athlete Insights ─────────────────────────────────────────────────────────

@router.get("/insights/{athlete_name}")
def get_athlete_insight(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    q = supabase.table("checkins").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    checkins = q.order("created_at", desc=True).limit(7).execute().data

    q = supabase.table("training_logs").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    training = q.order("created_at", desc=True).limit(7).execute().data

    if not checkins and not training:
        return {"insight": "No data yet", "risk": "unknown", "score": None}

    checkin_summary = "\n".join([
        f"- Energy {c['energy']}/10, Sleep {c['sleep']}/10, Soreness {c['soreness']}/10, Mood {c['mood']}/10"
        for c in checkins
    ]) if checkins else "No wellness check-ins submitted yet by athlete"

    training_summary = "\n".join([
        f"- Intensity: {t['intensity']}, Duration: {t['duration']} mins, RPE: {t.get('rpe', 'N/A')}/10, Notes: {t.get('coach_notes','none')}"
        for t in training
    ]) if training else "No training logs yet"

    prompt = f"""You are an elite sports physiotherapist and performance coach.

Athlete: {athlete_name}
Recent wellness check-ins (most recent first):
{checkin_summary}

Recent training logs from coach (most recent first):
{training_summary}

Note: If wellness check-in data is missing, base your assessment only on training load and RPE data provided by the coach.

Respond in EXACTLY this format, nothing else:
INSIGHT: [one practical sentence for the coach about this athlete today]
RISK: [green or yellow or red]
SCORE: [readiness number 0-100]
ATHLETE_MESSAGE: [one motivating sentence sent directly to the athlete based on their data]"""

    text = call_llm(prompt, max_tokens=200)

    result = {}
    for line in text.split("\n"):
        if line.startswith("INSIGHT:"):
            result["insight"] = line.replace("INSIGHT:", "").strip()
        elif line.startswith("RISK:"):
            result["risk"] = line.replace("RISK:", "").strip().lower()
        elif line.startswith("SCORE:"):
            try:
                result["score"] = int(line.replace("SCORE:", "").strip())
            except:
                result["score"] = 50
        elif line.startswith("ATHLETE_MESSAGE:"):
            result["athlete_message"] = line.replace("ATHLETE_MESSAGE:", "").strip()

    return result


# ─── Squad Insights ───────────────────────────────────────────────────────────

@router.get("/squad-insights")
def get_squad_insights(academy_id: str = ""):
    supabase = get_supabase()

    q = supabase.table("athletes").select("*")
    if academy_id:
        q = q.eq("academy_id", academy_id)
    athletes = q.execute().data

    q = supabase.table("checkins").select("*").order("created_at", desc=True)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    checkins = q.execute().data

    q = supabase.table("training_logs").select("*").order("created_at", desc=True)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    training = q.execute().data

    squad_summary = ""
    for athlete in athletes:
        latest_checkin  = next((c for c in checkins if c["athlete_name"] == athlete["name"]), None)
        latest_training = next((t for t in training if t["athlete_name"] == athlete["name"]), None)

        if latest_checkin:
            squad_summary += f"\n{athlete['name']} ({athlete['sport']}): Energy {latest_checkin['energy']}, Sleep {latest_checkin['sleep']}, Soreness {latest_checkin['soreness']}"
            if latest_training:
                squad_summary += f", Last training: {latest_training['intensity']} intensity for {latest_training['duration']} mins, RPE: {latest_training.get('rpe', 'N/A')}/10"
        elif latest_training:
            squad_summary += f"\n{athlete['name']} ({athlete['sport']}): No check-in, Last training: {latest_training['intensity']} intensity for {latest_training['duration']} mins, RPE: {latest_training.get('rpe', 'N/A')}/10"

    if not squad_summary:
        return {"squad_insight": "No data available yet for the squad."}

    prompt = f"""You are an elite sports coach analyzing your full squad.

Squad data:
{squad_summary}

Give a coaching effectiveness insight in EXACTLY this format:
SQUAD_INSIGHT: [2 sentences — one observation about the squad's overall state, one actionable recommendation for today's session]"""

    text = call_llm(prompt, max_tokens=150)
    squad_insight = text.replace("SQUAD_INSIGHT:", "").strip()

    return {"squad_insight": squad_insight}


# ─── Weekly Summary ───────────────────────────────────────────────────────────

@router.get("/weekly-summary/{athlete_name}")
def get_weekly_summary(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    q = supabase.table("checkins").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    checkins = q.order("created_at", desc=True).limit(7).execute().data

    q = supabase.table("training_logs").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    training = q.order("created_at", desc=True).limit(7).execute().data

    if not checkins and not training:
        return {"summary": "No data available yet to generate a weekly summary."}

    checkin_summary = "\n".join([
        f"- {c['created_at'][:10]}: Energy {c['energy']}/10, Sleep {c['sleep']}/10, Soreness {c['soreness']}/10, Mood {c['mood']}/10"
        + (f", Notes: {c['notes']}" if c.get('notes') else "")
        for c in checkins
    ]) if checkins else "No wellness check-ins this week"

    training_summary = "\n".join([
        f"- {t['created_at'][:10]}: {t['intensity']} intensity, {t['duration']} mins, RPE {t.get('rpe', 'N/A')}/10"
        + (f", Coach notes: {t['coach_notes']}" if t.get('coach_notes') else "")
        for t in training
    ]) if training else "No training logs this week"

    prompt = f"""You are an elite sports performance coach writing a weekly progress report.

Athlete: {athlete_name}

Wellness check-ins this week:
{checkin_summary}

Training logs this week:
{training_summary}

Write a concise 3-4 sentence weekly summary covering:
1. Overall wellness trend this week
2. Training load assessment based on RPE and intensity
3. One specific recommendation for next week

Be direct and practical. Write as if speaking to a coach."""

    text = call_llm(prompt, max_tokens=300)
    return {"summary": text}


# ─── Injury Risk ──────────────────────────────────────────────────────────────

@router.get("/injury-risk/{athlete_name}")
def get_injury_risk(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    q = supabase.table("checkins").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    checkins = q.order("created_at", desc=True).limit(28).execute().data

    q = supabase.table("training_logs").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    training = q.order("created_at", desc=True).limit(28).execute().data

    if not checkins and not training:
        return {
            "injury_risk_score": None,
            "acwr": None,
            "signals": [],
            "verdict": "No data available yet",
            "risk_level": "unknown",
            "deception_flag": False
        }

    intensity_map = {"Low": 0.6, "Medium": 1.0, "High": 1.4}

    def session_load(log):
        duration   = log.get("duration") or 0
        rpe        = log.get("rpe") or 5
        multiplier = intensity_map.get(log.get("intensity", "Medium"), 1.0)
        return duration * rpe * multiplier

    all_loads   = [session_load(t) for t in training]
    acute_load  = sum(all_loads[:7]) if all_loads else 0

    if len(all_loads) >= 28:
        chronic_load = sum(all_loads[:28]) / 4
    elif len(all_loads) >= 7:
        chronic_load = sum(all_loads) / (len(all_loads) / 7)
    else:
        chronic_load = acute_load

    acwr = round(acute_load / chronic_load, 2) if chronic_load > 0 else None

    coach_notes_combined = " ".join([
        t.get("coach_notes", "").lower() for t in training[:7]
        if t.get("coach_notes")
    ])

    notes_score, notes_signals = 0, []
    athlete_score, athlete_signals = 0, []
    acwr_score, acwr_signals = 0, []
    deception_flag, mismatch_signals = False, []

    subtle_keywords = ["tired", "flat", "sluggish", "heavy legs", "looked off",
                       "not himself", "not herself", "seemed off", "low energy",
                       "unmotivated", "lethargic", "slow", "labored"]
    if any(w in coach_notes_combined for w in subtle_keywords):
        notes_score += 8
        notes_signals.append("Coach noted subtle fatigue or low energy signs")

    load_keywords = ["reduced load", "modified session", "light work only",
                     "kept it easy", "held back", "limited reps", "sat out drills",
                     "reduced intensity", "short session"]
    if any(w in coach_notes_combined for w in load_keywords):
        notes_score += 12
        notes_signals.append("Coach already modified or reduced training load")

    pain_keywords = ["pain", "complained", "discomfort", "sore", "aching",
                     "tight", "stiff", "tender", "hurts", "hurting", "painful"]
    if any(w in coach_notes_combined for w in pain_keywords):
        notes_score += 15
        notes_signals.append("Coach notes mention pain or discomfort")

    compensation_keywords = ["limping", "favoring", "protecting", "guarding",
                             "compensating", "altered gait", "not moving right",
                             "avoiding", "one-sided", "uneven"]
    if any(w in coach_notes_combined for w in compensation_keywords):
        notes_score += 20
        notes_signals.append("Coach observed movement compensation or altered gait")

    stoppage_keywords = ["pulled out", "stopped early", "sat out", "couldn't finish",
                         "left session", "withdrew", "pulled up", "had to stop",
                         "taken off", "subbed off"]
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
        latest_training = training[0]
        latest_checkin  = recent_checkins[0]
        coach_rpe       = latest_training.get("rpe")
        athlete_energy  = latest_checkin.get("energy")
        athlete_soreness= latest_checkin.get("soreness")

        if coach_rpe is not None and athlete_energy is not None:
            athlete_fatigue = 10 - athlete_energy
            mismatch = coach_rpe - athlete_fatigue
            if mismatch >= 5:
                athlete_score += 20
                deception_flag = True
                mismatch_signals.append(f"High deception risk — coach RPE {coach_rpe}/10 but athlete energy {athlete_energy}/10")
            elif mismatch >= 3:
                athlete_score += 10
                mismatch_signals.append(f"Moderate mismatch — coach RPE {coach_rpe}/10 vs athlete energy {athlete_energy}/10")

        if athlete_soreness is not None and athlete_soreness <= 2:
            if latest_training.get("intensity") == "High":
                athlete_score += 10
                deception_flag = True
                mismatch_signals.append("Suspicious — athlete reports near-zero soreness after a High intensity session")

    if acwr is not None:
        if acwr > 1.5:
            acwr_score += 20
            acwr_signals.append(f"Training spike — ACWR {acwr} is above danger threshold of 1.5")
        elif acwr > 1.3:
            acwr_score += 10
            acwr_signals.append(f"Elevated training load — ACWR {acwr} in caution zone")
        elif acwr < 0.8:
            acwr_score += 5
            acwr_signals.append(f"Undertraining detected — ACWR {acwr} below 0.8")

    total_score = min(notes_score + athlete_score + acwr_score, 100)
    risk_level  = "red" if total_score >= 70 else ("yellow" if total_score >= 40 else "green")
    all_signals = acwr_signals + notes_signals + mismatch_signals + athlete_signals

    deception_context = (
        "IMPORTANT: Deception risk detected. Athlete self-report appears inconsistent with coach observations. Flag this to the coach."
        if deception_flag else ""
    )

    signals_text = "\n".join([f"- {s}" for s in all_signals]) if all_signals else "No major risk signals detected"

    prompt = f"""You are a sports physiotherapist reviewing injury risk data for an athlete.

Athlete: {athlete_name}
Injury risk score: {total_score}/100
ACWR: {acwr if acwr else 'insufficient data'}
Risk level: {risk_level}

Signals detected:
{signals_text}

Coach notes from recent sessions:
{coach_notes_combined if coach_notes_combined else 'No coach notes recorded'}

{deception_context}

Write a 2-sentence verdict for the coach:
- Sentence 1: what the main risk is and why
- Sentence 2: one specific action the coach should take today
If deception risk is flagged, mention it directly in your verdict.
Be direct. Do not repeat numbers back, interpret them."""

    verdict = call_llm(prompt, max_tokens=150)

    return {
        "injury_risk_score": total_score,
        "acwr":              acwr,
        "signals":           all_signals,
        "verdict":           verdict,
        "risk_level":        risk_level,
        "deception_flag":    deception_flag
    }


# ─── Drill Suggestions ────────────────────────────────────────────────────────

@router.get("/drills/{athlete_name}")
def get_drill_suggestions(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    q = supabase.table("checkins").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    checkins = q.order("created_at", desc=True).limit(3).execute().data

    q = supabase.table("training_logs").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    training = q.order("created_at", desc=True).limit(3).execute().data

    q = supabase.table("athletes").select("*").eq("name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    athletes = q.limit(1).execute().data

    sport = athletes[0]["sport"] if athletes else "General"
    age   = athletes[0].get("age") if athletes else None

    if not checkins and not training:
        return {"drills": [], "context": "No data available yet — drills will generate after first check-in."}

    latest = checkins[0] if checkins else None
    wellness_context = (
        f"Energy: {latest['energy']}/10, Sleep: {latest['sleep']}/10, "
        f"Soreness: {latest['soreness']}/10, Mood: {latest['mood']}/10"
        if latest else "No wellness data"
    )

    training_context = "\n".join([
        f"- {t['intensity']} intensity, {t['duration']} mins, RPE {t.get('rpe','N/A')}/10"
        + (f", Notes: {t['coach_notes']}" if t.get('coach_notes') else "")
        for t in training
    ]) if training else "No recent training logs"

    age_context = f"Age: {age}" if age else ""

    prompt = f"""You are an elite {sport} coach with 20+ years of experience training competitive {sport} athletes.

Athlete: {athlete_name}
Sport: {sport}
{age_context}

Today's wellness snapshot:
{wellness_context}

Recent training load (last 3 sessions):
{training_context}

Design exactly 3 session drills for this {sport} athlete for today's training. Every single drill MUST use real {sport}-specific techniques, movements, and terminology.

Condition-based rules:
- If soreness >= 7 or energy <= 4: prescribe ONLY low-intensity {sport} skill refinement, active recovery stretches specific to {sport} muscle groups, and light technical work. NO conditioning or strength.
- If soreness is 5-6 or energy is 5-6: prescribe moderate {sport} drills mixing skill work with controlled intensity. Include one recovery element.
- If soreness <= 4 and energy >= 7: prescribe match-intensity {sport} drills, advanced skill combinations, and sport-specific conditioning.
- If mood <= 4: include at least one fun, game-based {sport} drill to boost engagement.

CRITICAL RULES:
- NEVER suggest generic exercises like "squats", "planks", "jogging", or "stretching". Every drill must be a real {sport} drill that a professional {sport} coach would recognise.
- Name drills using proper {sport} terminology.
- Each drill reason must reference the athlete's specific wellness numbers.
- Keep durations realistic: 8–20 mins per drill.

Respond in EXACTLY this format, repeat it 3 times with no extra text:
DRILL: [specific {sport} drill name using proper terminology]
CATEGORY: [one of: Warmup / Skill / Strength / Recovery / Conditioning]
DURATION: [e.g. 12 mins]
INTENSITY: [Low / Medium / High]
REASON: [one sentence referencing the athlete's current wellness data and why this drill fits]
---"""

    raw = call_llm(prompt, max_tokens=600)

    drills = []
    for block in raw.split("---"):
        block = block.strip()
        if not block:
            continue
        drill = {}
        for line in block.split("\n"):
            line = line.strip()
            if line.startswith("DRILL:"):
                drill["name"]      = line.replace("DRILL:", "").strip()
            elif line.startswith("CATEGORY:"):
                drill["category"]  = line.replace("CATEGORY:", "").strip()
            elif line.startswith("DURATION:"):
                drill["duration"]  = line.replace("DURATION:", "").strip()
            elif line.startswith("INTENSITY:"):
                drill["intensity"] = line.replace("INTENSITY:", "").strip()
            elif line.startswith("REASON:"):
                drill["reason"]    = line.replace("REASON:", "").strip()
        if drill.get("name"):
            drills.append(drill)

    return {
        "drills":  drills[:3],
        "sport":   sport,
        "context": wellness_context if latest else "No check-in data",
        "athlete": athlete_name,
    }


# ─── Parent Recovery Advice ───────────────────────────────────────────────────

@router.get("/parent-recovery/{athlete_name}")
def get_parent_recovery(athlete_name: str, academy_id: str = ""):
    supabase = get_supabase()

    q = supabase.table("athletes").select("*").eq("name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    athletes = q.limit(1).execute().data

    sport = athletes[0]["sport"] if athletes else "General"
    age   = athletes[0].get("age") if athletes else None

    q = supabase.table("checkins").select("*").eq("athlete_name", athlete_name)
    if academy_id:
        q = q.eq("academy_id", academy_id)
    checkins = q.order("created_at", desc=True).limit(7).execute().data

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
            "coach_message": f"{athlete_name.split(' ')[0]} is in good shape! Their wellness numbers look healthy. Keep encouraging regular sleep, hydration, and balanced meals.",
            "exercises":     [],
            "athlete":       athlete_name,
            "sport":         sport,
        }

    age_text = f"Age: {age}" if age else ""
    severity = "HIGH RISK" if risk_level == "red" else "MODERATE CONCERN"

    prompt = f"""You are a sports physiotherapist writing a recovery plan for a parent to help their child at home.

Athlete: {athlete_name}
Sport: {sport}
{age_text}
Risk Level: {severity}

Current wellness:
{wellness_text}

Concern signals: {', '.join(risk_signals)}

Write a parent-friendly home recovery plan. The parent has NO sports training background.

Rules:
- Suggest exactly 3 simple exercises/activities the parent can help with at home
- NO gym equipment needed — only bodyweight, towels, ice packs, foam rollers
- Use simple language a non-sports parent would understand
- Each exercise should target the specific concern
- Include one general wellness tip (sleep, nutrition, or hydration)
- Also write a short reassuring coach message (2 sentences) to the parent

Respond in EXACTLY this format:
COACH_MESSAGE: [2-sentence message to parent]
---
EXERCISE: [simple name]
HOW: [1 sentence]
DURATION: [e.g. 10 minutes]
WHY: [1 sentence]
---
EXERCISE: [simple name]
HOW: [1 sentence]
DURATION: [e.g. 10 minutes]
WHY: [1 sentence]
---
EXERCISE: [simple name]
HOW: [1 sentence]
DURATION: [e.g. 10 minutes]
WHY: [1 sentence]
---"""

    raw = call_llm(prompt, max_tokens=500)

    coach_message, exercises = "", []

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
            if line.startswith("EXERCISE:"):
                exercise["name"]     = line.replace("EXERCISE:", "").strip()
            elif line.startswith("HOW:"):
                exercise["how"]      = line.replace("HOW:", "").strip()
            elif line.startswith("DURATION:"):
                exercise["duration"] = line.replace("DURATION:", "").strip()
            elif line.startswith("WHY:"):
                exercise["why"]      = line.replace("WHY:", "").strip()
        if exercise.get("name"):
            exercises.append(exercise)

    return {
        "risk_level":    risk_level,
        "coach_message": coach_message,
        "exercises":     exercises[:3],
        "athlete":       athlete_name,
        "sport":         sport,
    }