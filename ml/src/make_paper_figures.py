"""
Generate publication figures for the AthleteIQ paper (IEEE column width).

Run from ml/:
    ./venv/bin/python src/make_paper_figures.py

Outputs to paper/figures/:
    fig5_shap_beeswarm.png   — SHAP feature importance across the test set
    fig6_roc_pr.png          — ROC and precision-recall curves
"""
import os
import sys

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import (average_precision_score, precision_recall_curve,
                             roc_auc_score, roc_curve)

sys.path.append(os.path.dirname(__file__))
import features
import synthetic
from train import FEATURE_COLS, build_target

HERE = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(HERE, "..", "..", "paper", "figures")

# IEEE single-column ~3.5in wide
plt.rcParams.update({
    "font.size": 8,
    "axes.titlesize": 9,
    "axes.labelsize": 8,
    "legend.fontsize": 7,
    "xtick.labelsize": 7,
    "ytick.labelsize": 7,
})

# human-readable feature names for the paper
PRETTY = {
    "session_load": "Session load",
    "acute_load": "Acute load (7d)",
    "chronic_load": "Chronic load (28d)",
    "acwr": "ACWR",
    "monotony": "Training monotony",
    "strain": "Training strain",
    "load_spike": "Week-on-week load spike",
    "consecutive_high_days": "Consecutive high days",
    "days_since_rest": "Days since rest",
    "wellness_trend": "Wellness trend (7d)",
    "days_since_last_injury": "Days since last injury",
}


def main():
    os.makedirs(FIG_DIR, exist_ok=True)

    # rebuild the exact training/test split used in train.py
    df = synthetic.generate_synthetic_data(n_athletes=40, n_days=365, seed=42)
    df = features.engineer_all_features(df)
    df = build_target(df)
    df = df.dropna(subset=["acwr"]).sort_values("date")
    split = int(len(df) * 0.75)
    X_train = df.iloc[:split][FEATURE_COLS]
    X_test = df.iloc[split:][FEATURE_COLS]
    y_test = df.iloc[split:]["injury_next_7_days"]

    model = joblib.load(os.path.join(HERE, "..", "models", "injury_model.pkl"))
    proba = model.predict_proba(X_test)[:, 1]

    # ── Fig 5: SHAP beeswarm ────────────────────────────────────────────────
    X_test_pretty = X_test.rename(columns=PRETTY)
    explainer = shap.Explainer(model, X_train)
    sv = explainer(X_test)
    sv.feature_names = [PRETTY[c] for c in FEATURE_COLS]

    fig = plt.figure(figsize=(5.0, 3.4))
    shap.plots.beeswarm(sv, max_display=11, show=False, plot_size=None)
    ax = plt.gca()
    ax.tick_params(labelsize=8)
    ax.set_xlabel("SHAP value (impact on injury-risk output)", fontsize=8)
    # shrink the colorbar labels shap adds
    for cb_ax in fig.axes[1:]:
        cb_ax.tick_params(labelsize=7)
        cb_ax.set_ylabel(cb_ax.get_ylabel(), fontsize=7)
    plt.tight_layout()
    out = os.path.join(FIG_DIR, "fig5_shap_beeswarm.png")
    plt.savefig(out, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print("saved", out)

    # ── Fig 6: ROC + PR curves side by side ────────────────────────────────
    auc = roc_auc_score(y_test, proba)
    ap = average_precision_score(y_test, proba)
    base_rate = float(y_test.mean())
    fpr, tpr, _ = roc_curve(y_test, proba)
    prec, rec, _ = precision_recall_curve(y_test, proba)

    fig, axes = plt.subplots(1, 2, figsize=(3.5, 1.9))
    axes[0].plot(fpr, tpr, lw=1.4, color="#1f4e9c", label=f"AUC = {auc:.2f}")
    axes[0].plot([0, 1], [0, 1], lw=0.8, ls="--", color="gray")
    axes[0].set_xlabel("False positive rate")
    axes[0].set_ylabel("True positive rate")
    axes[0].set_title("ROC")
    axes[0].legend(loc="lower right", frameon=False)

    axes[1].plot(rec, prec, lw=1.4, color="#b03030", label=f"AP = {ap:.2f}")
    axes[1].axhline(base_rate, lw=0.8, ls="--", color="gray",
                    label=f"Base rate = {base_rate:.2f}")
    axes[1].set_xlabel("Recall")
    axes[1].set_ylabel("Precision")
    axes[1].set_title("Precision--Recall")
    axes[1].legend(loc="upper right", frameon=False)

    plt.tight_layout()
    out = os.path.join(FIG_DIR, "fig6_roc_pr.png")
    plt.savefig(out, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print("saved", out)


if __name__ == "__main__":
    main()
