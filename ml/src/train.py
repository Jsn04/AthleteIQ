"""
Reproducible training pipeline for the AthleteIQ injury-risk model.

Run from the ml/ directory:
    ./venv/bin/python src/train.py

Produces:
    models/injury_model.pkl       — trained XGBoost classifier
    models/feature_columns.json   — feature order (must match at inference)
    models/metrics.json           — evaluation metrics for the model card
"""
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score
from xgboost import XGBClassifier

sys.path.append(os.path.dirname(__file__))
import features
import synthetic

FEATURE_COLS = [
    "session_load", "acute_load", "chronic_load", "acwr", "monotony",
    "strain", "load_spike", "consecutive_high_days", "days_since_rest",
    "wellness_trend", "days_since_last_injury",
]


def build_target(df: pd.DataFrame) -> pd.DataFrame:
    """Label = 1 if the athlete is injured on any of the next 7 days (T+1..T+7)."""
    def forward_7d(s: pd.Series) -> pd.Series:
        a = s.values
        out = np.zeros(len(a), dtype=int)
        for i in range(len(a)):
            window = a[i + 1:i + 8]
            out[i] = 1 if (window.size and window.max() > 0) else 0
        return pd.Series(out, index=s.index)

    df["injury_next_7_days"] = (
        df.groupby("athlete_id")["injured"].transform(forward_7d)
    )
    return df


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(here, "..", "models")
    os.makedirs(models_dir, exist_ok=True)

    # 1. data (synthetic time-series mirroring AthleteIQ's RPE/duration/wellness)
    df = synthetic.generate_synthetic_data(n_athletes=40, n_days=365, seed=42)

    # 2. features + target
    df = features.engineer_all_features(df)
    df = build_target(df)
    df = df.dropna(subset=["acwr"]).sort_values("date")

    # 3. temporal split (no shuffle — leakage-safe)
    split = int(len(df) * 0.75)
    train_df, test_df = df.iloc[:split], df.iloc[split:]
    X_train, y_train = train_df[FEATURE_COLS], train_df["injury_next_7_days"]
    X_test, y_test = test_df[FEATURE_COLS], test_df["injury_next_7_days"]

    # 4. train with class-imbalance correction
    scale_pos_weight = (y_train == 0).sum() / max(1, (y_train == 1).sum())
    model = XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        scale_pos_weight=scale_pos_weight, eval_metric="auc",
        early_stopping_rounds=20, random_state=42,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    # 5. evaluate
    proba = model.predict_proba(X_test)[:, 1]
    metrics = {
        "roc_auc": round(float(roc_auc_score(y_test, proba)), 4),
        "pr_auc": round(float(average_precision_score(y_test, proba)), 4),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "target_rate": round(float(df["injury_next_7_days"].mean()), 4),
        "feature_importances": {
            k: round(float(v), 4)
            for k, v in sorted(
                zip(FEATURE_COLS, model.feature_importances_),
                key=lambda x: -x[1],
            )
        },
    }

    # 6. persist artifacts
    joblib.dump(model, os.path.join(models_dir, "injury_model.pkl"))
    json.dump(FEATURE_COLS, open(os.path.join(models_dir, "feature_columns.json"), "w"))
    json.dump(metrics, open(os.path.join(models_dir, "metrics.json"), "w"), indent=2)

    print("ROC-AUC:", metrics["roc_auc"], "| PR-AUC:", metrics["pr_auc"])
    print("Saved model, feature_columns.json, metrics.json to models/")


if __name__ == "__main__":
    main()
