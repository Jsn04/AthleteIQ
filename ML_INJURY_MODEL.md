# AthleteIQ — Injury Prediction Model: Build Path

Training an XGBoost injury risk model from scratch and integrating it into AthleteIQ as the live scoring engine.

---

## Current State vs Target State

**Now:** `routes/ai.py` uses hand-written ACWR thresholds to score injury risk.
**Target:** A trained XGBoost model replaces those thresholds — learns patterns from real data, produces a probability score, explains each prediction with SHAP.

---

## Folder Structure (create this)

```
AthleteIQ/
└── ml/
    ├── data/               ← raw + processed datasets
    ├── notebooks/
    │   └── 01_injury_model.ipynb   ← main training notebook
    ├── models/
    │   └── injury_model.pkl        ← exported trained model
    ├── src/
    │   ├── features.py     ← feature engineering functions
    │   └── evaluate.py     ← evaluation helpers
    └── requirements.txt    ← ml-specific deps (xgboost, shap, pandas…)
```

---

## Step 1 — Environment Setup

**What to install:**
```
xgboost
scikit-learn
pandas
numpy
shap
matplotlib
seaborn
joblib
jupyter
```

Create `ml/requirements.txt` with these. Use a separate venv from the backend — the ML environment is local/notebook only and never deployed to Render.

**Where to work:** Locally on your machine in a Jupyter notebook. No GPU needed — XGBoost on tabular data runs in minutes on a laptop.

---

## Step 2 — Get the Dataset

### Primary: AFL Player Workload Dataset
- **What it is:** 4 seasons of session-by-session RPE × duration load data per player, with injury labels
- **Where:** Search "Colby et al athlete workload injury dataset" on Google Scholar / ResearchGate / Kaggle
- **Backup:** Kaggle → search "athlete workload injury prediction" — several derivatives exist

### What a clean row looks like after you process it:
```
athlete_id | date | session_load | acwr | monotony | strain | consecutive_high | wellness | injury_next_7d
```

Save raw data to `ml/data/raw/`. Processed (feature-engineered) data to `ml/data/processed/`.

---

## Step 3 — Feature Engineering

Compute these features per athlete per day. Write each as a function in `ml/src/features.py` so they can be reused when integrating into AthleteIQ later.

| Feature | Formula | Signal |
|---|---|---|
| `acwr` | 7-day load ÷ 28-day rolling avg load | Core injury spike signal |
| `acute_load` | Sum(RPE × duration) last 7 days | Raw weekly stress |
| `chronic_load` | Rolling 28-day average daily load | Fitness base |
| `monotony` | mean(daily loads 7d) ÷ std(daily loads 7d) | Lack of variety = higher risk |
| `strain` | monotony × sum(daily loads 7d) | Combined fatigue signal |
| `load_spike` | This week total ÷ last week total | Sudden jumps are the danger |
| `consecutive_high_days` | Count of back-to-back High intensity sessions | Elite programs cap at 2 |
| `days_since_rest` | Days since last zero-load day | Recovery gap |
| `wellness_trend` | 7-day rolling avg of check-in score | Subjective fatigue |
| `days_since_last_injury` | From injury logs | Re-injury risk peaks at days 14-30 |

**Target variable:** `injury_next_7_days` — binary 1 if the athlete was injured in the next 7 days, 0 otherwise.

**Critical rule:** Sort all data by `athlete_id, date` before computing rolling features. Never compute a rolling average across athletes — each athlete is their own baseline.

---

## Step 4 — Exploratory Data Analysis (EDA)

Do this in the notebook before any training. It shows understanding of the data and belongs in the portfolio.

**What to plot and analyse:**
1. Injury rate overall — what % of athlete-days result in injury?
2. Injury rate by ACWR zone — bar chart: `<0.8 / 0.8-1.3 / 1.3-1.5 / >1.5`
3. Injury rate by consecutive high days — does it spike at 3+?
4. Correlation matrix of all features — are any features redundant?
5. Class imbalance — injuries are rare (5-10% of rows), note this

**Why this matters:** EDA validates your feature choices before training. If injury rate doesn't go up with ACWR, something is wrong with your data or feature computation.

---

## Step 5 — Train/Test Split

**Never randomly shuffle.** This is temporal data — today's session affects tomorrow's risk. Shuffling leaks future data into training.

**Use TimeSeriesSplit:**
- Split: train on seasons 1-3, test on season 4
- Or: use `TimeSeriesSplit(n_splits=5)` from scikit-learn for cross-validation
- This means the model only ever sees past data when making predictions — same as real life

---

## Step 6 — Train the Model

**Model:** XGBoost binary classifier (`XGBClassifier`)

**Key parameters to set:**
| Parameter | Value to start | Why |
|---|---|---|
| `n_estimators` | 300 | Number of trees |
| `max_depth` | 4 | Depth per tree — deeper = more overfit |
| `learning_rate` | 0.05 | Smaller = better generalisation |
| `scale_pos_weight` | non-injury rows ÷ injury rows | Fixes class imbalance |
| `eval_metric` | `'auc'` | Right metric for imbalanced classification |
| `early_stopping_rounds` | 20 | Stop when validation AUC stops improving |

**Hyperparameter tuning:** Use `GridSearchCV` or `Optuna` to search over `max_depth` (3-6) and `learning_rate` (0.01-0.1). Run this after the initial model works.

---

## Step 7 — Evaluate the Model

**Metrics to report (in the notebook):**

| Metric | What it tells you | Target |
|---|---|---|
| ROC-AUC | Overall discrimination ability | > 0.78 |
| Precision at top 10% risk | Of athletes you flag, how many actually got injured | > 40% |
| Recall | Of actual injuries, how many did the model catch | > 60% |
| Precision-Recall curve | Trade-off plot | Include in notebook |

**Never report accuracy** — a model that always predicts "no injury" gets 92% accuracy and catches zero injuries.

**Also plot:**
- Confusion matrix at your chosen threshold (e.g. 0.3 probability = flag as risk)
- ROC curve with AUC score
- Precision-Recall curve

---

## Step 8 — SHAP Explainability

This is what separates your model from a black box and makes it usable by coaches.

**What SHAP does:** For every prediction, it tells you exactly which features pushed the risk score up or down and by how much.

**What to generate:**
1. **Beeswarm plot** — shows feature importance across all test predictions
2. **Waterfall plot for one athlete** — shows why athlete X was flagged today (ACWR contributed +23, wellness contributed +12, etc.)
3. **Dependence plot for ACWR** — shows how risk changes as ACWR value changes

All three plots go into the notebook. The waterfall plot is what you show in AthleteIQ to coaches.

---

## Step 9 — Export the Model

Once you're happy with evaluation:

```python
import joblib
joblib.dump(model, 'ml/models/injury_model.pkl')

# Also save the feature list — the order must match exactly when loading
import json
json.dump(feature_columns, open('ml/models/feature_columns.json', 'w'))
```

Save both files. The feature list is critical — when the model runs in FastAPI, features must be fed in the same order they were trained on.

---

## Step 10 — Integrate into AthleteIQ

This is where the model goes from notebook to production.

### What changes in the backend:

**1. Load the model at startup in `backend/main.py`:**
```python
# load once when the server starts, reuse on every request
```

**2. Add `ml/src/features.py` functions to the backend** (or duplicate the logic) so the same feature engineering runs on live AthleteIQ data.

**3. In `backend/routes/ai.py` — `get_injury_risk` endpoint:**
- Currently: computes ACWR → applies hand-written thresholds → returns score
- After: computes same ACWR features → feeds to loaded model → returns `model.predict_proba()` as the risk score

**4. The response format stays identical** — frontend doesn't change. The number just becomes model-driven instead of rule-driven.

### New response field to add:
```json
{
  "injury_risk_score": 74,
  "model_driven": true,
  "top_signals": ["ACWR 1.82 (+23)", "4 consecutive high days (+15)", "Wellness 3.2 (+12)"]
}
```

The `top_signals` come from SHAP — computed live per athlete.

---

## Step 11 — The Notebook as Portfolio Artifact

Final notebook structure (what a reviewer or investor sees):

```
01. Problem Statement        — why ACWR thresholds alone miss injuries
02. Dataset Overview         — shape, seasons, injury rate, class imbalance
03. Feature Engineering      — each feature, formula, and sports science rationale
04. EDA                      — injury rate by zone, correlation matrix, distributions
05. Train/Test Split         — TimeSeriesSplit, why not random shuffle
06. Model Training           — XGBoost, parameter choices, early stopping
07. Evaluation               — ROC-AUC, precision-recall, confusion matrix
08. SHAP Analysis            — beeswarm, waterfall, dependence plots
09. Integration              — how this deploys in AthleteIQ
10. Limitations & Next Steps — more data, real-time re-training on AthleteIQ users
```

Publish this notebook on GitHub in the `ml/` folder.

---

## Checklist — Steps in Order

- [ ] **1.** Create `ml/` folder structure
- [ ] **2.** Set up Python venv and install ML dependencies
- [ ] **3.** Download AFL dataset, save to `ml/data/raw/`
- [ ] **4.** Write `ml/src/features.py` — all 10 feature functions
- [ ] **5.** Load + process data in notebook, compute features, check shapes
- [ ] **6.** EDA — injury rate by ACWR zone, correlation matrix, class imbalance check
- [ ] **7.** TimeSeriesSplit — set up train/test, confirm no future leakage
- [ ] **8.** Train XGBoost baseline — check ROC-AUC on test set
- [ ] **9.** Tune hyperparameters — GridSearch or Optuna
- [ ] **10.** Plot ROC curve, Precision-Recall curve, confusion matrix
- [ ] **11.** Run SHAP — beeswarm plot + one waterfall plot for a high-risk athlete
- [ ] **12.** Export model to `ml/models/injury_model.pkl`
- [ ] **13.** Load model in `backend/main.py` at startup
- [ ] **14.** Update `get_injury_risk` in `backend/routes/ai.py` to use model
- [ ] **15.** Test end-to-end: log sessions → call injury-risk endpoint → model returns score
- [ ] **16.** Polish notebook → push `ml/` folder to GitHub

---

## Resume Line (once done)

> *"Built an XGBoost injury prediction model from scratch — 10 engineered features from athlete load data (ACWR, monotony, strain, consecutive high days), TimeSeriesSplit cross-validation, SHAP explainability. Deployed as the live risk-scoring engine in AthleteIQ, a production sports SaaS."*
