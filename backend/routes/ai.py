import asyncio
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter

from db import safe_query, get_client
from llm import call_llm

router = APIRouter()
log = logging.getLogger(__name__)


# ── In-memory TTL cache (bounded) ────────────────────────────────────────────
_AI_CACHE = {}
_AI_CACHE_TTL = 12 * 60 * 60   # 12 hours
_AI_CACHE_MAX = 2000            # cap to prevent OOM on 512 MB


def _ai_cache_key(endpoint: str, athlete_name: str, academy_id: str) -> str:
    return f"{endpoint}::{athlete_name}::{academy_id}"


def _ai_cache_get(endpoint: str, athlete_name: str, academy_id: str):
    key = _ai_cache_key(endpoint, athlete_name, academy_id)
    entry = _AI_CACHE.get(key)
    if not entry:
        return None
    created_at, value = entry
    if time.time() - created_at > _AI_CACHE_TTL:
        _AI_CACHE.pop(key, None)
        return None
    age_mins = round((time.time() - created_at) / 60)
    return {**value, "cached": True, "cache_age_mins": age_mins}


def _ai_cache_set(endpoint: str, athlete_name: str, academy_id: str, value: dict):
    if len(_AI_CACHE) >= _AI_CACHE_MAX:
        oldest_key = min(_AI_CACHE, key=lambda k: _AI_CACHE[k][0])
        _AI_CACHE.pop(oldest_key, None)
    key = _ai_cache_key(endpoint, athlete_name, academy_id)
    _AI_CACHE[key] = (time.time(), value)


# ── Trial gate ────────────────────────────────────────────────────────────────
def check_trial_access(academy_id: str):
    if academy_id.startswith("solo_"):
        return True
    result = safe_query(
        lambda sb: sb.table("academies")
        .select("plan, trial_ends_at")
        .eq("id", academy_id)
        .execute().data
    )
    if not result:
        return False
    academy = result[0]
    if academy["plan"] == "paid":
        return True
    trial_ends_at = academy.get("trial_ends_at")
    if not trial_ends_at:
        return False
    expiry = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
    return datetime.now(timezone.utc) <= expiry


def _session_load(log: dict) -> float:
    """RPE × duration × intensity multiplier for one training session."""
    duration = log.get("duration") or 0
    if duration == 0:
        return 0.0
    rpe = log.get("rpe") or 5
    multiplier = {"Low": 0.6, "Medium": 1.0, "High": 1.4}.get(
        log.get("intensity", "Medium"), 1.0
    )
    return duration * rpe * multiplier


def _days_ago(log: dict, now: datetime) -> float:
    try:
        created = datetime.fromisoformat(log["created_at"].replace("Z", "+00:00"))
        return (now - created).total_seconds() / 86400
    except Exception:
        return 999.0


def _compute_baseline(checkins: list) -> dict:
    """
    Build personal baseline from check-in history.
    Requires 14+ check-ins. Returns per-metric mean + std dev, or None if
    insufficient data.
    """
    if len(checkins) < 14:
        return None

    baseline_data = checkins[:28]  # use up to 28 most recent
    metrics_config = ["energy", "sleep", "soreness", "mood"]
    result = {}

    for metric in metrics_config:
        vals = [c.get(metric) for c in baseline_data if c.get(metric) is not None]
        if len(vals) < 10:
            continue
        mean = sum(vals) / len(vals)
        variance = sum((v - mean) ** 2 for v in vals) / len(vals)
        std = max(variance ** 0.5, 0.5)  # floor at 0.5 to prevent division issues
        result[metric] = {"mean": round(mean, 2), "std": round(std, 2)}

    if len(result) < 4:
        return None

    return {"metrics": result, "sample_size": len(baseline_data)}


def _z_score(value, mean, std):
    """How many standard deviations value is from mean."""
    return round((value - mean) / std, 2)


def calculate_confidence(checkins: list, training_logs=None) -> dict:
    """
    Data reliability score (0-100). Detects auto-filling, cross-metric
    contradictions, and missing check-ins. Designed to NOT false-flag
    genuine bad days — only flags sustained suspicious patterns.

    Rules (from founder spec):
    - Same values 3+ consecutive days across 2+ metrics = suspicious
    - Cross-metric contradictions (high soreness + high energy) for 3+ days
    - Missing check-ins: first 2 free, then -5% per miss after the 2nd
    - Single outlier days (10,10,0,10) are NEVER penalized
    - Max penalty from any single factor: -25%
    """
    training_logs = training_logs or []
    score = 100
    flags = []

    if len(checkins) < 5:
        return {"score": 100, "flags": [], "label": "New", "enough_data": False}

    recent_14 = checkins[:14]

    # ── 1. REPETITION DETECTION ──────────────────────────────────────────────
    # Check last 7 days for consecutive identical values per metric
    recent_7 = checkins[:7]
    metrics_with_repeats = 0
    repeat_details = []

    for metric in ["energy", "sleep", "soreness", "mood"]:
        vals = [c.get(metric) for c in recent_7 if c.get(metric) is not None]
        if len(vals) < 3:
            continue

        # Find longest consecutive run of identical values
        max_run = 1
        current_run = 1
        for i in range(1, len(vals)):
            if vals[i] == vals[i - 1]:
                current_run += 1
                max_run = max(max_run, current_run)
            else:
                current_run = 1

        if max_run >= 3:
            metrics_with_repeats += 1
            repeat_details.append(f"{metric} ({vals[0]} for {max_run} days)")

    # Only flag if 2+ metrics show repetition (single metric being stable is normal)
    if metrics_with_repeats >= 2:
        penalty = min(25, metrics_with_repeats * 10)
        score -= penalty
        flags.append(f"Repeated identical values: {', '.join(repeat_details)}")

    # ── 2. CROSS-METRIC CONTRADICTION ────────────────────────────────────────
    # High soreness should correlate with lower energy/mood
    # Only flag if contradiction persists 3+ consecutive days
    contradiction_streak = 0
    for c in recent_7:
        soreness = c.get("soreness", 5)
        energy = c.get("energy", 5)
        mood = c.get("mood", 5)
        sleep_val = c.get("sleep", 5)

        is_contradictory = (
            (soreness >= 7 and energy >= 8 and mood >= 8) or
            (energy <= 3 and mood >= 8) or
            (sleep_val <= 4 and energy >= 9)
        )

        if is_contradictory:
            contradiction_streak += 1
        else:
            contradiction_streak = 0

    if contradiction_streak >= 3:
        penalty = min(25, contradiction_streak * 8)
        score -= penalty
        flags.append(f"Contradictory metrics for {contradiction_streak} consecutive days (e.g., high soreness + high energy)")

    # ── 3. MISSING CHECK-INS ─────────────────────────────────────────────────
    # Only penalize days where the athlete was PRESENT (has a training log)
    # but did NOT submit a check-in. Absent days don't count against them.
    now = datetime.now(timezone.utc)
    checkin_dates = set()
    for c in recent_14:
        try:
            dt = datetime.fromisoformat(c["created_at"].replace("Z", "+00:00"))
            if (now - dt).days <= 14:
                checkin_dates.add(dt.strftime("%Y-%m-%d"))
        except Exception:
            pass

    training_dates = set()
    for t in training_logs:
        try:
            dt = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
            if (now - dt).days <= 14:
                training_dates.add(dt.strftime("%Y-%m-%d"))
        except Exception:
            pass

    # Missed = days with training but no check-in
    missed = len(training_dates - checkin_dates)
    # First 2 misses are free, then -5% per miss
    if missed > 2:
        penalty = min(25, (missed - 2) * 5)
        score -= penalty
        flags.append(f"Missed check-in on {missed} training days (last 14 days)")

    # ── 4. COACH-ATHLETE MISMATCH (if training data available) ───────────────
    # Only flag when pattern persists 3+ sessions
    if training_logs and len(checkins) >= 3:
        mismatch_count = 0
        for i in range(min(5, len(training_logs), len(checkins))):
            t = training_logs[i]
            c = checkins[i]
            coach_rpe = t.get("rpe")
            athlete_soreness = c.get("soreness")

            if coach_rpe is not None and athlete_soreness is not None:
                # Coach says hard session (RPE 8+) but athlete says no soreness (<= 2)
                if coach_rpe >= 8 and athlete_soreness <= 2:
                    mismatch_count += 1

        if mismatch_count >= 3:
            penalty = min(25, mismatch_count * 7)
            score -= penalty
            flags.append(f"Coach RPE contradicts athlete soreness in {mismatch_count} recent sessions")

    # ── FINAL ────────────────────────────────────────────────────────────────
    score = max(0, min(100, score))

    if score >= 85:
        label = "Strong"
    elif score >= 70:
        label = "Good"
    elif score >= 50:
        label = "Low"
    else:
        label = "Unreliable"

    return {
        "score": score,
        "flags": flags,
        "label": label,
        "enough_data": True,
    }


def calculate_readiness(training_logs: list, checkins=None, vitals=None) -> dict:
    """
    Multi-factor readiness score with personal baseline system.

    When baseline is available (14+ check-ins):
      - Athlete pillar uses z-scores from personal baseline instead of
        generic thresholds. This eliminates false alerts for athletes
        whose "normal" differs from the population average.

    Weight split: 60% coach / 40% athlete (default)
      - If confidence < 70%: shifts to 80% coach / 20% athlete

    Coach pillar:
      - Load trend: last session vs 3-session baseline (always available)
      - ACWR:       proper 7-day / 28-day date windows (only when enough data)
      - Coach notes: keyword sentiment on last 5 sessions

    Athlete pillar (without vitals):
      - Energy 30%, Sleep 30%, Soreness 25% (inverted), Mood 15%
    Athlete pillar (with HRV from vitals scan):
      - Energy 25%, Sleep 25%, Soreness 20%, Mood 10%, HRV 20%
    """
    checkins = checkins or []
    now = datetime.now(timezone.utc)

    # ── PERSONAL BASELINE ────────────────────────────────────────────────────
    baseline = _compute_baseline(checkins)
    baseline_active = baseline is not None
    baseline_days = len(checkins) if len(checkins) <= 28 else 28

    # ── CONFIDENCE SCORE ─────────────────────────────────────────────────────
    confidence = calculate_confidence(checkins, training_logs)
    confidence_score = confidence["score"]

    # Dynamic weight split based on confidence
    if confidence_score < 70:
        coach_weight = 0.80
        athlete_weight = 0.20
    else:
        coach_weight = 0.60
        athlete_weight = 0.40

    weight_split = f"{int(coach_weight * 100)}/{int(athlete_weight * 100)}"

    # ── ACWR: proper 7-day / 28-day windows ──────────────────────────────────
    loads_7d  = [_session_load(l) for l in training_logs if _days_ago(l, now) <=  7]
    loads_28d = [_session_load(l) for l in training_logs if _days_ago(l, now) <= 28]
    loads_7d  = [l for l in loads_7d  if l > 0]
    loads_28d = [l for l in loads_28d if l > 0]

    # ACWR needs at least 1 session this week and 5 across the month
    has_acwr = len(loads_7d) >= 1 and len(loads_28d) >= 5

    acute_load_total   = sum(loads_7d)
    chronic_load_total = sum(loads_28d)

    acwr_val = 0.0
    if has_acwr and chronic_load_total > 0:
        chronic_weekly_avg = chronic_load_total / 4
        acwr_val = round(acute_load_total / chronic_weekly_avg, 2)

    # ── PILLAR 1: COACH DATA ─────────────────────────────────────────────────
    coach_score = 70

    if training_logs:
        all_loads = [_session_load(l) for l in training_logs if _session_load(l) > 0]

        trend_score = 75
        if all_loads:
            recent_load = all_loads[0]
            baseline_load = (sum(all_loads[1:4]) / len(all_loads[1:4])
                             if len(all_loads) > 1 else recent_load)
            if baseline_load > 0:
                ratio = recent_load / baseline_load
                if   ratio > 1.6:  trend_score = max(25, int(75 - (ratio - 1.6) * 60))
                elif ratio > 1.3:  trend_score = max(48, int(75 - (ratio - 1.3) * 45))
                elif ratio > 1.1:  trend_score = 72
                elif ratio >= 0.7: trend_score = 85
                elif ratio >= 0.5: trend_score = 74
                else:              trend_score = 60

            last_rpe       = training_logs[0].get("rpe") or 5
            last_intensity = training_logs[0].get("intensity", "Medium")
            if last_rpe >= 9 or (last_intensity == "High" and last_rpe >= 8):
                trend_score = max(trend_score - 12, 20)
            elif last_rpe <= 3 and last_intensity == "Low":
                trend_score = min(trend_score + 8, 92)

        acwr_score = None
        if has_acwr and acwr_val > 0:
            if   acwr_val < 0.5:   acwr_score = 35
            elif acwr_val < 0.8:   acwr_score = int(35 + (acwr_val - 0.5) / 0.3 * 37)
            elif acwr_val <= 1.05: acwr_score = int(72 + (acwr_val - 0.8) / 0.25 * 21)
            elif acwr_val <= 1.3:  acwr_score = int(93 - (acwr_val - 1.05) / 0.25 * 27)
            elif acwr_val <= 1.5:  acwr_score = int(66 - (acwr_val - 1.3)  / 0.2  * 28)
            else:                  acwr_score = max(15, int(38 - (acwr_val - 1.5) / 0.5 * 23))

        notes_text = " ".join(
            t.get("coach_notes", "").lower()
            for t in training_logs[:5] if t.get("coach_notes")
        )
        notes_score = 75
        if any(kw in notes_text for kw in [
            "pain", "sore", "aching", "tight", "injury", "discomfort",
            "tender", "limping", "hurts", "hurting",
        ]):
            notes_score -= 20
        if any(kw in notes_text for kw in [
            "pulled out", "sat out", "stopped early", "early exit",
            "reduced load", "modified session", "held back",
        ]):
            notes_score -= 12
        if any(kw in notes_text for kw in [
            "tired", "fatigued", "sluggish", "heavy legs",
            "lethargic", "flat", "not sharp", "looked off",
        ]):
            notes_score -= 8
        if any(kw in notes_text for kw in [
            "great session", "excellent", "sharp", "strong",
            "best session", "perfect", "very good",
        ]):
            notes_score += 10
        notes_score = max(20, min(95, notes_score))

        if acwr_score is not None:
            coach_score = int(trend_score * 0.40 + acwr_score * 0.35 + notes_score * 0.25)
        else:
            coach_score = int(trend_score * 0.65 + notes_score * 0.35)

    # ── PILLAR 2: ATHLETE WELLNESS ───────────────────────────────────────────
    wellness_score = 70
    deviations = {}

    if checkins:
        recent = checkins[:3]
        avg_energy   = sum(c.get("energy",   5) for c in recent) / len(recent)
        avg_sleep    = sum(c.get("sleep",    5) for c in recent) / len(recent)
        avg_soreness = sum(c.get("soreness", 5) for c in recent) / len(recent)
        avg_mood     = sum(c.get("mood",     5) for c in recent) / len(recent)

        if baseline_active:
            # ── Z-SCORE BASED SCORING (personal baseline) ────────────────────
            bm = baseline["metrics"]

            for metric, avg_val, invert in [
                ("energy",   avg_energy,   False),
                ("sleep",    avg_sleep,    False),
                ("soreness", avg_soreness, True),
                ("mood",     avg_mood,     False),
            ]:
                z = _z_score(avg_val, bm[metric]["mean"], bm[metric]["std"])
                # For soreness, HIGHER is worse, so invert the z interpretation
                effective_z = -z if invert else z

                deviations[metric] = {
                    "value": round(avg_val, 1),
                    "mean": bm[metric]["mean"],
                    "z_score": z,
                    "status": (
                        "below" if effective_z <= -1.5
                        else "low" if effective_z <= -0.5
                        else "above" if effective_z >= 1.5
                        else "normal"
                    ),
                }

            # Convert z-scores to 0-100 sub-scores
            def z_to_score(z, invert=False):
                ez = -z if invert else z
                if ez <= -2.0:   return 20
                elif ez <= -1.5: return 35
                elif ez <= -0.5: return 60
                elif ez <= 0.5:  return 80
                elif ez <= 1.5:  return 90
                else:            return 95

            e_score  = z_to_score(deviations["energy"]["z_score"])
            sl_score = z_to_score(deviations["sleep"]["z_score"])
            so_score = z_to_score(deviations["soreness"]["z_score"], invert=True)
            m_score  = z_to_score(deviations["mood"]["z_score"])
        else:
            # ── GENERIC SCORING (no baseline yet) ────────────────────────────
            e_score  = int((avg_energy          / 10) * 100)
            sl_score = int((avg_sleep           / 10) * 100)
            so_score = int(((10 - avg_soreness) / 10) * 100)
            m_score  = int((avg_mood            / 10) * 100)

        # ── HRV from vitals scan (if available today) ────────────────────────
        hrv_score = None
        vitals = vitals or []
        if vitals:
            latest_vital = vitals[0]
            hr = latest_vital.get("heart_rate")
            hrv_val = latest_vital.get("hrv")
            sig_q = latest_vital.get("signal_quality", 0)

            # Only use if signal quality is decent
            if hrv_val is not None and sig_q >= 0.4:
                # HRV scoring: higher = better recovery
                # Population norms: 20-40ms = average, 50+ = excellent, <20 = poor
                if hrv_val >= 60:   hrv_score = 95
                elif hrv_val >= 50: hrv_score = 88
                elif hrv_val >= 40: hrv_score = 78
                elif hrv_val >= 30: hrv_score = 65
                elif hrv_val >= 20: hrv_score = 45
                else:               hrv_score = 25

                deviations["hrv"] = {
                    "value": hrv_val,
                    "heart_rate": hr,
                    "status": (
                        "excellent" if hrv_val >= 50
                        else "good" if hrv_val >= 30
                        else "low" if hrv_val >= 20
                        else "fatigued"
                    ),
                }

                # Also add resting HR deviation
                if hr:
                    deviations["heart_rate"] = {
                        "value": hr,
                        "status": (
                            "resting" if hr < 60
                            else "normal" if hr < 80
                            else "elevated" if hr < 100
                            else "high"
                        ),
                    }

        # Weighted wellness score — redistribute weights when HRV available
        if hrv_score is not None:
            wellness_score = int(
                e_score   * 0.25 +
                sl_score  * 0.25 +
                so_score  * 0.20 +
                m_score   * 0.10 +
                hrv_score * 0.20
            )
        else:
            wellness_score = int(
                e_score  * 0.30 +
                sl_score * 0.30 +
                so_score * 0.25 +
                m_score  * 0.15
            )

    # ── FINAL SCORE: dynamic weight split ────────────────────────────────────
    final_readiness = max(5, min(98, int(
        coach_score * coach_weight + wellness_score * athlete_weight
    )))

    if has_acwr and acwr_val > 0:
        if   acwr_val > 1.5:  risk_tier = "High Risk"
        elif acwr_val > 1.3:  risk_tier = "Caution"
        elif acwr_val < 0.8:  risk_tier = "Undertraining"
        else:                  risk_tier = "Optimal"
    else:
        if   final_readiness >= 78: risk_tier = "Optimal"
        elif final_readiness >= 55: risk_tier = "Caution"
        else:                        risk_tier = "High Risk"

    return {
        "readiness":          final_readiness,
        "acwr":               acwr_val,
        "acute_load":         round(acute_load_total),
        "chronic_load":       round(chronic_load_total),
        "risk_tier":          risk_tier,
        "coach_score":        coach_score,
        "wellness_score":     wellness_score,
        "has_acwr":           has_acwr,
        "baseline_active":    baseline_active,
        "baseline_days":      baseline_days,
        "confidence":         confidence,
        "weight_split":       weight_split,
        "deviations":         deviations,
    }


def calculate_acwr(training_logs: list) -> dict:
    return calculate_readiness(training_logs, [])


_RISK_TIER_TO_LEVEL = {
    "Optimal": "green",
    "Undertraining": "green",
    "Caution": "yellow",
    "High Risk": "red",
    "No Data": "unknown",
}


async def _get_cached_insight(athlete_name: str, academy_id: str):
    try:
        result = await asyncio.to_thread(
            lambda: safe_query(
                lambda sb: sb.table("ai_insights_cache")
                .select("insight, metrics, created_at")
                .eq("athlete_name", athlete_name)
                .eq("academy_id", academy_id)
                .execute()
            )
        )
        if not result.data:
            return None
        cached    = result.data[0]
        cached_at = datetime.fromisoformat(cached["created_at"].replace("Z", "+00:00"))
        age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600
        if age_hours >= 12:
            return None

        metrics = cached.get("metrics") or {}
        # Invalidate cache entries saved before baseline system was added
        if "baseline_days" not in metrics:
            return None
        athlete_message = metrics.get("athlete_message", "")
        return {
            "insight": cached["insight"],
            "metrics": metrics,
            "score": metrics.get("readiness"),
            "risk": _RISK_TIER_TO_LEVEL.get(metrics.get("risk_tier", ""), "unknown"),
            "athlete_message": athlete_message,
            "cached": True,
            "cache_age_mins": round(age_hours * 60),
            "baseline_active": metrics.get("baseline_active", False),
            "baseline_days": metrics.get("baseline_days", 0),
            "confidence": metrics.get("confidence", {}),
            "weight_split": metrics.get("weight_split", "60/40"),
            "deviations": metrics.get("deviations", {}),
        }
    except Exception:
        return None


async def _save_insight_cache(athlete_name: str, academy_id: str, insight: str, metrics: dict):
    try:
        await asyncio.to_thread(
            lambda: safe_query(
                lambda sb: sb.table("ai_insights_cache")
                .upsert(
                    {"athlete_name": athlete_name, "academy_id": academy_id,
                     "insight": insight, "metrics": metrics,
                     "created_at": datetime.now(timezone.utc).isoformat()},
                    on_conflict="athlete_name,academy_id",
                )
                .execute()
            )
        )
    except Exception:
        pass


@router.get("/insights/{athlete_name}")
async def get_athlete_insight(athlete_name: str, academy_id: str = ""):
    try:
        if not await asyncio.to_thread(check_trial_access, academy_id):
            return {"status": "trial_expired", "message": "Your 14-day trial has expired."}

        cached = await _get_cached_insight(athlete_name, academy_id)
        if cached:
            return cached

        checkins_result, training_result, vitals_result = await asyncio.gather(
            asyncio.to_thread(
                lambda: safe_query(
                    lambda sb: sb.table("checkins").select("*")
                    .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
                    .order("created_at", desc=True).limit(28).execute()
                )
            ),
            asyncio.to_thread(
                lambda: safe_query(
                    lambda sb: sb.table("training_logs").select("*")
                    .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
                    .order("created_at", desc=True).limit(28).execute()
                )
            ),
            asyncio.to_thread(
                lambda: safe_query(
                    lambda sb: sb.table("vitals").select("*")
                    .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
                    .order("created_at", desc=True).limit(7).execute()
                )
            ),
        )

        checkins = checkins_result.data or []
        training = training_result.data or []
        vitals = vitals_result.data or []

        if not checkins and not training:
            return {"insight": "No data yet", "risk": "unknown", "score": None, "cached": False,
                    "baseline_active": False, "baseline_days": 0,
                    "confidence": {"score": 100, "flags": [], "label": "New", "enough_data": False},
                    "weight_split": "60/40", "deviations": {}}

        metrics        = calculate_readiness(training, checkins, vitals)
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

        metrics["athlete_message"] = result.get("athlete_message", "")
        result["metrics"] = metrics
        result["baseline_active"] = metrics.get("baseline_active", False)
        result["baseline_days"] = metrics.get("baseline_days", 0)
        result["confidence"] = metrics.get("confidence", {})
        result["weight_split"] = metrics.get("weight_split", "60/40")
        result["deviations"] = metrics.get("deviations", {})
        await _save_insight_cache(athlete_name, academy_id, result.get("insight", ""), metrics)
        return result
    except Exception as e:
        log.error("insights/%s crashed: %s", athlete_name, e)
        return {"insight": "Insight temporarily unavailable", "risk": "unknown",
                "score": None, "cached": False, "error": True}


@router.get("/squad-insights")
async def get_squad_insights(academy_id: str = ""):
    try:
        cached = _ai_cache_get("squad-insights", "squad", academy_id)
        if cached:
            return cached

        athletes_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("athletes").select("*").eq("academy_id", academy_id).execute())
        )
        checkins_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("checkins").select("*").eq("academy_id", academy_id)
            .order("created_at", desc=True).execute())
        )
        training_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("training_logs").select("*").eq("academy_id", academy_id)
            .order("created_at", desc=True).execute())
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
        result = {"squad_insight": text.replace("SQUAD_INSIGHT:", "").strip()}
        _ai_cache_set("squad-insights", "squad", academy_id, result)
        return {**result, "cached": False}
    except Exception as e:
        log.error("squad-insights crashed: %s", e)
        return {"squad_insight": "Squad insight temporarily unavailable.", "cached": False, "error": True}


@router.get("/weekly-summary/{athlete_name}")
async def get_weekly_summary(athlete_name: str, academy_id: str = ""):
    try:
        cached = _ai_cache_get("weekly-summary", athlete_name, academy_id)
        if cached:
            return cached

        checkins_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("checkins").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .order("created_at", desc=True).limit(7).execute())
        )
        training_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("training_logs").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .order("created_at", desc=True).limit(7).execute())
        )

        checkins = checkins_result.data or []
        training = training_result.data or []

        if not checkins and not training:
            return {"summary": "No data available yet to generate a weekly summary."}

        metrics = calculate_readiness(training, checkins)

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
        result = {"summary": text}
        _ai_cache_set("weekly-summary", athlete_name, academy_id, result)
        return {**result, "cached": False}
    except Exception as e:
        log.error("weekly-summary/%s crashed: %s", athlete_name, e)
        return {"summary": "Weekly summary temporarily unavailable.", "cached": False, "error": True}


@router.get("/injury-risk/{athlete_name}")
async def get_injury_risk(athlete_name: str, academy_id: str = ""):
    cached = _ai_cache_get("injury-risk", athlete_name, academy_id)
    if cached:
        return cached

    try:
        checkins_result, training_result, vitals_result = await asyncio.gather(
            asyncio.to_thread(
                lambda: safe_query(
                    lambda sb: sb.table("checkins").select("*")
                    .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
                    .order("created_at", desc=True).limit(28).execute()
                )
            ),
            asyncio.to_thread(
                lambda: safe_query(
                    lambda sb: sb.table("training_logs").select("*")
                    .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
                    .order("created_at", desc=True).limit(28).execute()
                )
            ),
            asyncio.to_thread(
                lambda: safe_query(
                    lambda sb: sb.table("vitals").select("*")
                    .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
                    .order("created_at", desc=True).limit(7).execute()
                )
            ),
        )

        checkins = checkins_result.data or []
        training = training_result.data or []
        vitals = vitals_result.data or []

        if not checkins and not training:
            return {"injury_risk_score": None, "acwr": None, "signals": [],
                    "verdict": "No data available yet", "risk_level": "unknown",
                    "deception_flag": False, "sessions_28d": 0, "days_with_data": 0}

        metrics = calculate_readiness(training, checkins, vitals)
        acwr    = metrics["acwr"]
        now_utc = datetime.now(timezone.utc)

        # Sessions with valid load in last 28 days
        loads_28d = [l for l in training if _days_ago(l, now_utc) <= 28 and _session_load(l) > 0]
        sessions_28d = len(loads_28d)

        # Unique calendar days with training data in last 28 days
        days_with_data = len(set(
            l["created_at"][:10] for l in training
            if _days_ago(l, now_utc) <= 28 and _session_load(l) > 0
        ))

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

        # ── Baseline deviation signals ───────────────────────────────────────
        baseline_signals = []
        deviations = metrics.get("deviations", {})
        for metric_name, dev in deviations.items():
            z = dev.get("z_score", 0)
            status = dev.get("status", "normal")
            if metric_name == "soreness":
                # For soreness, positive z = higher than normal = worse
                if z >= 1.5:
                    baseline_signals.append(
                        f"Baseline alert: Soreness {z} std devs above personal normal"
                    )
            else:
                # For energy/sleep/mood, negative z = lower than normal = worse
                if z <= -1.5:
                    baseline_signals.append(
                        f"Baseline alert: {metric_name.title()} {abs(z)} std devs below personal normal"
                    )

        # ── Vitals-based signals (HR/HRV) ──────────────────────────────────────
        vitals_signals = []
        hrv_dev = deviations.get("hrv")
        hr_dev = deviations.get("heart_rate")
        if hrv_dev and hrv_dev.get("status") in ("low", "fatigued"):
            vitals_signals.append(
                f"Vitals alert: HRV {hrv_dev['value']}ms — {hrv_dev['status']} recovery"
            )
        if hr_dev and hr_dev.get("status") in ("elevated", "high"):
            vitals_signals.append(
                f"Vitals alert: Resting HR {hr_dev['value']} BPM — {hr_dev['status']}"
            )

        all_signals = baseline_signals + vitals_signals + acwr_signals + notes_signals + mismatch_signals + athlete_signals

        # Recalculate total with baseline + vitals signal contribution
        baseline_risk_add = min(15, len(baseline_signals) * 8)
        vitals_risk_add = min(10, len(vitals_signals) * 6)
        total_score = min(notes_score + athlete_score + acwr_score + baseline_risk_add + vitals_risk_add, 100)
        risk_level  = "red" if total_score >= 70 else ("yellow" if total_score >= 40 else "green")

        confidence_data = metrics.get("confidence", {})

        result = {
            "injury_risk_score": total_score,
            "acwr":              acwr,
            "signals":           all_signals,
            "verdict":           verdict,
            "risk_level":        risk_level,
            "deception_flag":    deception_flag,
            "metrics":           metrics,
            "sessions_28d":      sessions_28d,
            "days_with_data":    days_with_data,
            "baseline_active":   metrics.get("baseline_active", False),
            "confidence":        confidence_data,
            "weight_split":      metrics.get("weight_split", "60/40"),
        }
        _ai_cache_set("injury-risk", athlete_name, academy_id, result)
        return {**result, "cached": False}
    except Exception as e:
        log.error("injury-risk/%s crashed: %s", athlete_name, e)
        return {"injury_risk_score": None, "acwr": None, "signals": [],
                "verdict": "Risk assessment temporarily unavailable", "risk_level": "unknown",
                "deception_flag": False, "sessions_28d": 0, "days_with_data": 0, "error": True}


@router.get("/drills/{athlete_name}")
async def get_drill_suggestions(athlete_name: str, academy_id: str = ""):
    try:
        cached = _ai_cache_get("drills", athlete_name, academy_id)
        if cached:
            return cached

        checkins_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("checkins").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .order("created_at", desc=True).limit(3).execute())
        )
        training_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("training_logs").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .order("created_at", desc=True).limit(3).execute())
        )
        athletes_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("athletes").select("*")
            .eq("name", athlete_name).eq("academy_id", academy_id).limit(1).execute())
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
                if line.startswith("DRILL:"):       drill["name"]      = line.replace("DRILL:", "").strip()
                elif line.startswith("CATEGORY:"):  drill["category"]  = line.replace("CATEGORY:", "").strip()
                elif line.startswith("DURATION:"):  drill["duration"]  = line.replace("DURATION:", "").strip()
                elif line.startswith("INTENSITY:"): drill["intensity"] = line.replace("INTENSITY:", "").strip()
                elif line.startswith("REASON:"):    drill["reason"]    = line.replace("REASON:", "").strip()
            if drill.get("name"):
                drills.append(drill)

        result = {
            "drills":  drills[:3],
            "sport":   sport,
            "context": wellness_context if latest else "No check-in data",
            "athlete": athlete_name,
        }
        _ai_cache_set("drills", athlete_name, academy_id, result)
        return {**result, "cached": False}
    except Exception as e:
        log.error("drills/%s crashed: %s", athlete_name, e)
        return {"drills": [], "sport": "General", "cached": False, "error": True}


@router.get("/parent-recovery/{athlete_name}")
async def get_parent_recovery(athlete_name: str, academy_id: str = ""):
    try:
        cached = _ai_cache_get("parent-recovery", athlete_name, academy_id)
        if cached:
            return cached

        athletes_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("athletes").select("*")
            .eq("name", athlete_name).eq("academy_id", academy_id).limit(1).execute())
        )
        checkins_result = await asyncio.to_thread(
            lambda: safe_query(lambda sb: sb.table("checkins").select("*")
            .eq("athlete_name", athlete_name).eq("academy_id", academy_id)
            .order("created_at", desc=True).limit(7).execute())
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
            green_result = {
                "risk_level":    "green",
                "coach_message": (
                    f"{athlete_name.split(' ')[0]} is in good shape! "
                    "Wellness numbers look healthy. Keep encouraging regular sleep, hydration, and balanced meals."
                ),
                "exercises": [],
                "athlete":   athlete_name,
                "sport":     sport,
            }
            _ai_cache_set("parent-recovery", athlete_name, academy_id, green_result)
            return {**green_result, "cached": False}

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
                if line.startswith("EXERCISE:"):   exercise["name"]     = line.replace("EXERCISE:", "").strip()
                elif line.startswith("HOW:"):      exercise["how"]      = line.replace("HOW:", "").strip()
                elif line.startswith("DURATION:"): exercise["duration"] = line.replace("DURATION:", "").strip()
                elif line.startswith("WHY:"):      exercise["why"]      = line.replace("WHY:", "").strip()
            if exercise.get("name"):
                exercises.append(exercise)

        result = {
            "risk_level":    risk_level,
            "coach_message": coach_message,
            "exercises":     exercises[:3],
            "athlete":       athlete_name,
            "sport":         sport,
        }
        _ai_cache_set("parent-recovery", athlete_name, academy_id, result)
        return {**result, "cached": False}
    except Exception as e:
        log.error("parent-recovery/%s crashed: %s", athlete_name, e)
        return {"risk_level": "unknown", "coach_message": "Recovery plan temporarily unavailable.",
                "exercises": [], "cached": False, "error": True}