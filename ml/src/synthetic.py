"""
Synthetic athlete training-load generator for AthleteIQ injury model.

Produces daily session logs (RPE x duration) + wellness check-ins where injury
risk is *causally* driven by sports-science signals — acute:chronic workload
ratio (ACWR), training monotony, sudden load spikes, poor wellness, and
back-to-back high-intensity days.

This mirrors the exact data AthleteIQ collects in production (RPE, duration,
wellness check-ins), so a model trained here can be retrained on real academy
data with no feature changes.
"""
import numpy as np
import pandas as pd


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def generate_synthetic_data(
    n_athletes: int = 40,
    n_days: int = 365,
    seed: int = 42,
    target_injury_rate: float = 0.08,
) -> pd.DataFrame:
    """
    Returns a daily-grain DataFrame with columns:
        athlete_id, date, rpe, duration, session_load, wellness, injured

    Injuries are sampled from a hazard that depends on recent training load
    patterns, so the downstream model has genuine signal to learn.
    """
    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2025-01-01")
    rows = []

    for a in range(n_athletes):
        athlete_id = f"A{a + 1:03d}"
        # each athlete has their own baseline workload and fragility
        base_rpe = rng.uniform(4.0, 7.0)
        base_dur = rng.uniform(45, 80)
        fragility = rng.uniform(0.7, 1.4)  # injury-prone multiplier

        recent_loads = []        # rolling history of daily loads
        days_since_injury = 999
        rest_days_left = 0

        for d in range(n_days):
            date = start + pd.Timedelta(days=d)

            # forced recovery after an injury
            if rest_days_left > 0:
                rpe, duration = 0, 0
                rest_days_left -= 1
            else:
                # weekly rhythm: lighter on Sundays, occasional spikes
                weekday = date.weekday()
                rest = (weekday == 6) and (rng.random() < 0.7)
                if rest:
                    rpe, duration = 0, 0
                else:
                    spike = 1.6 if rng.random() < 0.06 else 1.0  # ~6% spike days
                    rpe = int(np.clip(rng.normal(base_rpe, 1.5) * spike, 1, 10))
                    duration = int(np.clip(rng.normal(base_dur, 15) * spike, 20, 130))

            session_load = rpe * duration
            recent_loads.append(session_load)

            # --- rolling load signals (the causal drivers) ---
            acute = sum(recent_loads[-7:])
            chronic_window = recent_loads[-28:]
            chronic = (sum(chronic_window) / len(chronic_window)) * 7 if chronic_window else 0
            acwr = acute / chronic if chronic > 0 else 1.0

            last7 = recent_loads[-7:]
            monotony = (np.mean(last7) / (np.std(last7) + 1e-6)) if len(last7) >= 2 else 1.0
            consec_high = 0
            for load in reversed(recent_loads):
                if load >= base_rpe * base_dur * 1.1:
                    consec_high += 1
                else:
                    break

            # wellness drops with accumulated load, recovers with rest
            load_strain = acute / (base_rpe * base_dur * 7 + 1e-6)
            wellness = float(np.clip(rng.normal(7.0 - 2.0 * (load_strain - 1.0), 1.0), 1, 10))

            # --- injury hazard: causal function of the signals ---
            # ACWR is the dominant driver (matches sports-science literature),
            # with monotony, poor wellness and back-to-back high days adding risk.
            hazard = _sigmoid(
                fragility * (
                    3.0 * (acwr - 1.0)
                    + 0.55 * (monotony - 1.5)
                    + 0.40 * (6.5 - wellness)
                    + 0.18 * consec_high
                ) - 3.8
            )

            injured = int(rng.random() < hazard)

            rows.append({
                "athlete_id": athlete_id,
                "date": date,
                "rpe": rpe,
                "duration": duration,
                "session_load": session_load,
                "wellness": round(wellness, 1),
                "injured": injured,
            })

            if injured:
                days_since_injury = 0
                # short recovery block so "days since injury" doesn't dominate
                # the model — we want load signals to be the headline drivers
                rest_days_left = int(rng.integers(2, 5))
            else:
                days_since_injury += 1

    df = pd.DataFrame(rows)

    # gently calibrate overall injury rate toward the target
    actual = df["injured"].mean()
    if actual > target_injury_rate * 1.5:
        injured_idx = df.index[df["injured"] == 1].to_numpy()
        n_drop = int(len(injured_idx) * (1 - target_injury_rate / actual))
        drop = rng.choice(injured_idx, size=n_drop, replace=False)
        df.loc[drop, "injured"] = 0

    return df
