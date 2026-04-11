import asyncio
import json
import logging
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, HTTPException

from db import safe_query
from llm import call_llm

router = APIRouter()
log = logging.getLogger(__name__)


def get_week_start(d: date = None) -> date:
    d = d or date.today()
    return d - timedelta(days=d.weekday())



def calculate_acwr(training_logs: list) -> dict:
    if not training_logs:
        return {"acwr": 0.0, "acute_load": 0, "chronic_load": 0, "risk_tier": "No Data"}
    intensity_map = {"Low": 0.6, "Medium": 1.0, "High": 1.4}

    def session_load(log):
        duration = log.get("duration") or 0
        if duration == 0:
            return 0
        rpe = log.get("rpe") or 5
        multiplier = intensity_map.get(log.get("intensity", "Medium"), 1.0)
        return duration * rpe * multiplier

    all_loads = [session_load(l) for l in training_logs if session_load(l) > 0]
    if not all_loads:
        return {"acwr": 0.0, "acute_load": 0, "chronic_load": 0, "risk_tier": "No Data"}

    acute_count = min(3, len(all_loads))
    acute_load = sum(all_loads[:acute_count])
    chronic_load = sum(all_loads) / len(all_loads) * acute_count
    acwr = round(acute_load / chronic_load, 2) if chronic_load else 0.0

    if acwr < 0.8:
        risk_tier = "Undertraining"
    elif acwr <= 1.3:
        risk_tier = "Optimal"
    elif acwr <= 1.5:
        risk_tier = "Caution"
    else:
        risk_tier = "High Risk"

    return {
        "acwr": acwr,
        "acute_load": round(acute_load),
        "chronic_load": round(chronic_load),
        "risk_tier": risk_tier,
    }


async def build_report(athlete_name: str, academy_id: str, week_start: date) -> dict:
    week_end = week_start + timedelta(days=6)
    week_start_str = week_start.isoformat()
    week_end_str = week_end.isoformat()

    # fetch last week dates for delta
    last_week_start = (week_start - timedelta(days=7)).isoformat()
    last_week_end = (week_start - timedelta(days=1)).isoformat()

    # --- fetch all data in parallel ---
    (
        checkins_res, training_res, injuries_res,
        attendance_res, last_checkins_res
    ) = await asyncio.gather(
        asyncio.to_thread(lambda: safe_query(lambda sb: sb.table("checkins").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .gte("created_at", week_start_str).lte("created_at", week_end_str + "T23:59:59")
            .order("created_at", desc=False).execute())),
        asyncio.to_thread(lambda: safe_query(lambda sb: sb.table("training_logs").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .gte("created_at", week_start_str).lte("created_at", week_end_str + "T23:59:59")
            .order("created_at", desc=False).execute())),
        asyncio.to_thread(lambda: safe_query(lambda sb: sb.table("injury_logs").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .in_("status", ["active", "recovering"]).execute())),
        asyncio.to_thread(lambda: safe_query(lambda sb: sb.table("attendance_logs").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .gte("date", week_start_str).lte("date", week_end_str)
            .order("date", desc=False).execute())),
        asyncio.to_thread(lambda: safe_query(lambda sb: sb.table("checkins").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .gte("created_at", last_week_start).lte("created_at", last_week_end + "T23:59:59")
            .execute())),
    )

    checkins = checkins_res.data or []
    training = training_res.data or []
    injuries = injuries_res.data or []
    attendance = attendance_res.data or []
    last_checkins = last_checkins_res.data or []

    # --- compute numbers ---
    acwr_data = calculate_acwr(training)

    readiness_scores = []
    for c in checkins:
        r = round((c["energy"] + c["sleep"] + (10 - c["soreness"]) + c["mood"]) / 4, 1)
        readiness_scores.append({
            "date": c["created_at"][:10],
            "score": r,
            "energy": c["energy"],
            "sleep": c["sleep"],
            "soreness": c["soreness"],
            "mood": c["mood"],
        })

    avg_readiness = round(sum(r["score"] for r in readiness_scores) / len(readiness_scores), 1) if readiness_scores else 0

    last_avg = 0
    if last_checkins:
        last_scores = [(c["energy"] + c["sleep"] + (10 - c["soreness"]) + c["mood"]) / 4 for c in last_checkins]
        last_avg = round(sum(last_scores) / len(last_scores), 1)

    delta = round(avg_readiness - last_avg, 1)

    # attendance
    sessions_total = len(attendance) if attendance else len(training)
    sessions_present = len([a for a in attendance if a["status"] == "present"]) if attendance else len(training)
    attendance_pct = round((sessions_present / sessions_total * 100)) if sessions_total else 0

    attendance_by_day = {}
    for a in attendance:
        attendance_by_day[a["date"]] = a["status"]

    # sudden drop detection (20+ point single-day drop)
    flags = []
    for i in range(1, len(readiness_scores)):
        drop = readiness_scores[i - 1]["score"] - readiness_scores[i]["score"]
        if drop >= 2.0:  # on 10-point scale, 2 points = 20 points on 100-point scale
            flags.append({
                "type": "energy_drop",
                "date": readiness_scores[i]["date"],
                "from": round(readiness_scores[i - 1]["score"] * 10),
                "to": round(readiness_scores[i]["score"] * 10),
                "drop": round(drop * 10),
            })

    # deception flags
    deception_count = 0
    for t in training:
        matching_checkin = next((c for c in checkins if c["created_at"][:10] == t["created_at"][:10]), None)
        if matching_checkin:
            rpe = t.get("rpe") or 0
            energy = matching_checkin.get("energy") or 5
            if rpe - (10 - energy) >= 4:
                deception_count += 1

    # verdict
    if delta >= 5:
        verdict = "Much better than last week"
    elif delta >= 1:
        verdict = "Doing better than last week"
    elif delta >= -1:
        verdict = "About the same as last week"
    elif delta >= -5:
        verdict = "Slightly below last week"
    else:
        verdict = "Needs attention this week"

    # --- build AI prompt ---
    readiness_text = "\n".join([
        f"- {r['date']}: Energy {r['energy']}, Sleep {r['sleep']}, Soreness {r['soreness']}, Mood {r['mood']} → Score {r['score']}/10"
        for r in readiness_scores
    ]) or "No check-in data this week"

    training_text = "\n".join([
        f"- {t['created_at'][:10]}: {t['intensity']} intensity, {t['duration']} mins, RPE {t.get('rpe','N/A')}/10"
        + (f" — Coach note: {t['coach_notes']}" if t.get("coach_notes") else "")
        for t in training
    ]) or "No training sessions logged"

    injury_text = "\n".join([
        f"- {inj['body_part']} {inj['injury_type']} ({inj['severity']}) — Status: {inj['status']}, Logged: {inj['date_occurred']}"
        for inj in injuries
    ]) or "No active injuries"

    flag_text = "\n".join([
        f"- Energy dropped from {f['from']} to {f['to']} on {f['date']} (drop of {f['drop']} points)"
        for f in flags
    ]) or "No sudden drops"

    prompt = f"""You are a friendly sports coach writing a weekly report for both a coach and a parent. Use simple, clear language — no jargon. Parents should understand every word.

Athlete: {athlete_name}
Week: {week_start_str} to {week_end_str}
Average energy score this week: {avg_readiness}/10 (last week: {last_avg}/10, change: {delta:+})
Sessions attended: {sessions_present}/{sessions_total} ({attendance_pct}%)
Training load: {acwr_data['risk_tier']} (ACWR: {acwr_data['acwr']})

Daily energy data:
{readiness_text}

Training sessions:
{training_text}

Injuries on record:
{injury_text}

Sudden energy drops this week:
{flag_text}

Deception flags this week: {deception_count}

Write your response in EXACTLY this JSON format and nothing else:
{{
  "trend_summary": "2 plain-English sentences explaining how the athlete's energy changed this week and why. Write as if explaining to a parent.",
  "next_steps": [
    {{
      "title": "short action title (max 8 words)",
      "description": "1-2 sentences. Simple language. Say WHO should do it — coach or parent or both.",
      "tag": "coach"
    }},
    {{
      "title": "short action title (max 8 words)",
      "description": "1-2 sentences. Simple language. Say WHO should do it — coach or parent or both.",
      "tag": "home"
    }},
    {{
      "title": "short action title (max 8 words)",
      "description": "1-2 sentences. Simple language. Say WHO should do it — coach or parent or both.",
      "tag": "both"
    }}
  ],
  "flag_descriptions": [
    "plain English explanation of the most important thing to watch next week (1 sentence)"
  ]
}}

Rules:
- next_steps must have exactly 3 items
- tags must be exactly: coach, home, both
- No markdown, no backticks, only valid JSON
- Language must be simple enough for a non-sports parent to understand
- If there are active injuries, one next_step must address them
- If deception_count > 1, one next_step must mention checking in honestly"""

    raw = await call_llm(prompt, max_tokens=600)

    # parse AI response
    try:
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        ai_data = json.loads(clean.strip())
    except Exception:
        ai_data = {
            "trend_summary": "Energy data collected for this week. See numbers above for details.",
            "next_steps": [
                {"title": "Review this week's training load", "description": "Coach to check if sessions were too hard or too easy based on the numbers.", "tag": "coach"},
                {"title": "Ensure good sleep before sessions", "description": "Parent to make sure the athlete sleeps 8+ hours before training days.", "tag": "home"},
                {"title": "Keep monitoring energy levels", "description": "Both coach and parent to watch for sudden drops in energy next week.", "tag": "both"},
            ],
            "flag_descriptions": ["Monitor energy levels closely next week."],
        }

    report_data = {
        "athlete_name": athlete_name,
        "academy_id": academy_id,
        "week_start": week_start_str,
        "week_end": week_end_str,
        "avg_readiness": avg_readiness,
        "last_avg_readiness": last_avg,
        "delta": delta,
        "verdict": verdict,
        "sessions_present": sessions_present,
        "sessions_total": sessions_total,
        "attendance_pct": attendance_pct,
        "attendance_by_day": attendance_by_day,
        "acwr": acwr_data["acwr"],
        "acwr_risk_tier": acwr_data["risk_tier"],
        "acute_load": acwr_data["acute_load"],
        "chronic_load": acwr_data["chronic_load"],
        "readiness_scores": readiness_scores,
        "injuries": injuries,
        "flags": flags,
        "deception_count": deception_count,
        "trend_summary": ai_data.get("trend_summary", ""),
        "next_steps": ai_data.get("next_steps", []),
        "flag_descriptions": ai_data.get("flag_descriptions", []),
    }

    return report_data


@router.get("/weekly/{athlete_name}")
async def get_weekly_report(athlete_name: str, academy_id: str = ""):
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id required")

    today = date.today()
    week_start = get_week_start(today)
    week_end = week_start + timedelta(days=6)

    # Mon–Fri (weekday 0–4): week is still in progress.
    # Return a lightweight signal so the frontend can show the "check back" screen.
    # We never generate or cache a partial-week report — that data is incomplete
    # and would just sit stale until overwritten, burning tokens for nothing.
    if today.weekday() < 5:  # 5 = Saturday, 6 = Sunday
        days_remaining = week_end.weekday() - today.weekday() + 1  # days until Sunday incl.
        # quick data counts so the frontend can show "X sessions logged so far"
        checkins_count_res = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("checkins").select("id", count="exact")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .gte("created_at", week_start.isoformat())
            .execute())
        )
        training_count_res = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("training_logs").select("id", count="exact")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .gte("created_at", week_start.isoformat())
            .execute())
        )
        return {
            "week_in_progress": True,
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "days_remaining": days_remaining,
            "checkins_so_far": checkins_count_res.count or 0,
            "sessions_so_far": training_count_res.count or 0,
        }

    # Saturday or Sunday — generate/return the full week report.
    week_start_str = week_start.isoformat()

    existing = await asyncio.to_thread(
        lambda: safe_query(lambda sb: sb.table("weekly_reports").select("*")
        .eq("academy_id", academy_id)
        .eq("athlete_name", athlete_name)
        .eq("week_start", week_start_str)
        .execute())
    )

    if existing.data:
        rec = existing.data[0]
        return {
            "report_id": rec["id"],
            "coach_note": rec["coach_note"],
            "generated_at": rec["generated_at"],
            "already_existed": True,
            "week_in_progress": False,
            **rec["report_data"],
        }

    # Generate fresh (first time hitting on weekend)
    report_data = await build_report(athlete_name, academy_id, week_start)

    saved = await asyncio.to_thread(
        lambda: safe_query(lambda sb: sb.table("weekly_reports").insert({
            "academy_id": academy_id,
            "athlete_name": athlete_name,
            "week_start": week_start_str,
            "report_data": report_data,
            "coach_note": "",
        }).execute())
    )

    rec = saved.data[0]
    return {
        "report_id": rec["id"],
        "coach_note": "",
        "generated_at": rec["generated_at"],
        "already_existed": False,
        "week_in_progress": False,
        **report_data,
    }


@router.patch("/weekly/{report_id}/note")
async def update_coach_note(report_id: str, payload: dict):
    note = payload.get("coach_note", "")
    try:
        res = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("weekly_reports")
            .update({"coach_note": note})
            .eq("id", report_id)
            .execute())
        )
        return res.data[0] if res.data else {}
    except Exception as e:
        log.error("PATCH /reports/weekly/%s/note failed: %s", report_id, e)
        raise HTTPException(status_code=500, detail="Could not save note.")
