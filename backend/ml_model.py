"""
XGBoost injury-risk model inference for AthleteIQ.

Loads the trained booster (exported from ml/ pipeline) once at import and
rebuilds the same 11 features the model was trained on from live Supabase
rows (training_logs, checkins, injury_logs).

Feature formulas MUST stay in sync with ml/src/features.py — the model is
only valid if inference features match training features.

Gracefully degrades: if xgboost or the model file is unavailable, ml_enabled()
returns False and the injury-risk endpoint keeps its rule-based behaviour.
"""
import json
import logging
import math
import os
from datetime import datetime, timezone

log = logging.getLogger(__name__)

_MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
_booster = None
_feature_cols = None
_scale_pos_weight = 1.0

try:
    import numpy as np
    import xgboost as xgb

    _model_path = os.path.join(_MODEL_DIR, "injury_model.json")
    _cols_path = os.path.join(_MODEL_DIR, "feature_columns.json")
    _calib_path = os.path.join(_MODEL_DIR, "calibration.json")
    if os.path.exists(_model_path) and os.path.exists(_cols_path):
        _booster = xgb.Booster()
        _booster.load_model(_model_path)
        _feature_cols = json.load(open(_cols_path))
        if os.path.exists(_calib_path):
            _scale_pos_weight = json.load(open(_calib_path)).get("scale_pos_weight", 1.0)
        log.info("Injury model loaded (%d features)", len(_feature_cols))
    else:
        log.warning("Injury model files not found in %s — ML scoring disabled", _MODEL_DIR)
except Exception as exc:  # xgboost missing or model corrupt
    log.warning("Injury model unavailable (%s) — ML scoring disabled", exc)
    _booster = None


def ml_enabled() -> bool:
    return _booster is not None


def _log_day(log_row: dict, now: datetime) -> int:
    """Whole days ago this log was created (0 = today)."""
    try:
        created = datetime.fromisoformat(log_row["created_at"].replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return max(0, int((now - created).total_seconds() // 86400))
    except Exception:
        return 999


def build_features(training_logs: list, checkins: list, injuries: list) -> dict:
    """
    Convert live AthleteIQ rows into the model's 11-feature dict.

    Training data was daily-grain with session_load = rpe * duration and rest
    days as zero-load rows. We rebuild a 28-day daily series where days with
    no logged session count as rest (load 0).
    """
    now = datetime.now(timezone.utc)

    # daily load + max-rpe series, index 0 = today ... 27 = 27 days ago
    daily_load = [0.0] * 28
    daily_rpe = [0.0] * 28
    for t in training_logs:
        day = _log_day(t, now)
        if day < 28:
            rpe = t.get("rpe") or 5
            duration = t.get("duration") or 0
            daily_load[day] += rpe * duration
            daily_rpe[day] = max(daily_rpe[day], rpe)

    last7 = daily_load[:7]
    prev7 = daily_load[7:14]

    acute_load = sum(last7)
    chronic_load = sum(daily_load) / 28.0  # mean daily load over 28d (matches training)
    acwr = acute_load / (chronic_load * 7) if chronic_load > 0 else 0.0

    mean7 = sum(last7) / 7.0
    var7 = sum((x - mean7) ** 2 for x in last7) / 7.0
    std7 = math.sqrt(var7)
    monotony = (mean7 / std7) if std7 > 1e-6 else 1.0
    strain = monotony * acute_load

    prev_acute = sum(prev7)
    load_spike = (acute_load / prev_acute) if prev_acute > 0 else 1.0

    consecutive_high_days = 0
    for rpe in daily_rpe:  # walk back from today
        if rpe >= 8:
            consecutive_high_days += 1
        else:
            break

    days_since_rest = 0
    for load_val in daily_load:
        if load_val == 0:
            break
        days_since_rest += 1

    # wellness composite on the same 0-10 scale used in training
    wellness_vals = []
    for c in checkins:
        if _log_day(c, now) < 7:
            try:
                wellness_vals.append(
                    (c["energy"] + c["sleep"] + (10 - c["soreness"]) + c["mood"]) / 4.0
                )
            except (KeyError, TypeError):
                continue
    wellness_trend = sum(wellness_vals) / len(wellness_vals) if wellness_vals else 7.0

    days_since_last_injury = 999
    for inj in injuries:
        date_str = inj.get("date_occurred") or inj.get("created_at", "")
        try:
            occurred = datetime.fromisoformat(str(date_str)[:10]).replace(tzinfo=timezone.utc)
            days_since_last_injury = min(
                days_since_last_injury, max(0, int((now - occurred).total_seconds() // 86400))
            )
        except Exception:
            continue

    return {
        "session_load": daily_load[0],
        "acute_load": acute_load,
        "chronic_load": chronic_load,
        "acwr": round(acwr, 4),
        "monotony": round(monotony, 4),
        "strain": round(strain, 2),
        "load_spike": round(load_spike, 4),
        "consecutive_high_days": consecutive_high_days,
        "days_since_rest": days_since_rest,
        "wellness_trend": round(wellness_trend, 2),
        "days_since_last_injury": days_since_last_injury,
    }


def predict_risk(training_logs: list, checkins: list, injuries: list):
    """
    Returns (ml_risk_score 0-100, features dict) or (None, None) when the
    model is unavailable or there is no training data to score.
    """
    if not ml_enabled() or not training_logs:
        return None, None
    try:
        feats = build_features(training_logs, checkins, injuries)
        row = np.array([[feats[c] for c in _feature_cols]], dtype=float)
        dmat = xgb.DMatrix(row, feature_names=_feature_cols)
        proba = float(_booster.predict(dmat)[0])
        # Prior correction: training used scale_pos_weight, which inflates raw
        # probabilities. Map back to the true base-rate scale.
        w = _scale_pos_weight
        if w > 1.0 and 0.0 < proba < 1.0:
            proba = proba / (proba + (1.0 - proba) * w)
        return round(proba * 100), feats
    except Exception as exc:
        log.error("ML injury prediction failed: %s", exc)
        return None, None
