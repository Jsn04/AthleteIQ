# AthleteIQ — Injury Prediction Model

An XGBoost model that predicts **injury within the next 7 days** from athlete
training-load and wellness patterns. Deployed in shadow mode inside
[AthleteIQ](https://athlete-iq-dun.vercel.app), a production sports SaaS for
Indian grassroots academies — the model's score is served live by the
`/ai/injury-risk` endpoint alongside the platform's rule-based composite score.

## Why this exists

AthleteIQ's injury-risk engine was rule-based: hand-coded ACWR thresholds from
the sports-science literature (Hulin & Gabbett). This project replaces banded
heuristics with a learned, calibrated probability — while keeping the
rule-based score primary until the model is validated on real outcomes.

## Results

| Metric | Value |
|---|---|
| ROC-AUC (held-out, temporal split) | **0.68** |
| Average precision (vs 0.25 base rate) | **0.41** |
| Training set | 14,600 athlete-days (40 athletes × 365 days) |

Published injury-prediction models on real cohorts typically report ROC-AUC
0.65–0.75 — this is in range, honestly evaluated with no leakage.

SHAP attribution independently recovers **ACWR as a dominant learned risk
driver** — the model learns the Hulin–Gabbett spike relationship from data
rather than having it hand-coded.

## Design decisions that matter

- **Synthetic bootstrap, production-identical features.** No labelled
  grassroots injury cohort exists. Training data is simulated daily workload
  (`src/synthetic.py`) whose injury hazard is causally driven by ACWR spikes,
  training monotony, wellness collapse, and consecutive high-intensity days.
  The 11 features are computed identically in training (`src/features.py`)
  and production (`backend/ml_model.py`) — so retraining on real academy
  data requires **zero feature changes**.
- **Temporal split, never shuffled.** Train on the first 75% of days, test
  on the last 25%. Random shuffling leaks future load patterns into training.
- **Class-imbalance weighting + prior correction.** `scale_pos_weight`
  during training; probabilities mapped back to the true base-rate scale at
  inference via `p' = p / (p + (1-p)·w)`.
- **Shadow deployment.** The model never overrides the rule-based score.
  If the model artifact or xgboost is missing, the endpoint degrades
  gracefully to rule-based-only.

## The 11 features

`session_load`, `acute_load` (7d), `chronic_load` (28d), `acwr`, `monotony`,
`strain`, `load_spike` (week-on-week), `consecutive_high_days`,
`days_since_rest`, `wellness_trend` (7d), `days_since_last_injury`.

## Repo layout

```
ml/
├── notebooks/01_injury_model.ipynb   # full story: EDA → train → SHAP
├── src/
│   ├── synthetic.py                  # causal workload data generator
│   ├── features.py                   # feature engineering
│   ├── train.py                      # reproducible training pipeline
│   ├── evaluate.py                   # ROC/PR/precision-at-k helpers
│   └── make_paper_figures.py         # publication figures (IEEE width)
└── models/                           # trained model + metrics + schema
```

## Reproduce

```bash
cd ml
python -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python src/train.py
# → models/injury_model.pkl, feature_columns.json, metrics.json
```

## Next milestone

Retrain on real deployment data once 6+ months of academy logs accumulate.
Shadow-vs-rule-based disagreement logs become the natural evaluation set.
