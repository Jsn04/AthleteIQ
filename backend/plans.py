"""Plan definitions — the single source of truth for pricing and caps.

Tiers are priced by academy size only. Features are identical across tiers:
we charge more when an academy is bigger, we don't withhold functionality.
Amounts are in paise, as Razorpay expects.
"""

TRIAL_DAYS = 14

PLANS = {
    "coach": {
        "label":   "Coach",
        "cap":     60,
        "monthly": {"amount": 199900,  "label": "Coach — ₹1,999/mo"},
        "annual":  {"amount": 1999900, "label": "Coach — ₹19,999/yr"},
    },
    "academy": {
        "label":   "Academy",
        "cap":     250,
        "monthly": {"amount": 499900,  "label": "Academy — ₹4,999/mo"},
        "annual":  {"amount": 4999900, "label": "Academy — ₹49,999/yr"},
    },
    # Institution is quoted manually — no self-serve checkout.
    "institution": {
        "label":   "Institution",
        "cap":     None,          # unlimited
        "monthly": None,
        "annual":  None,
    },
}

DEFAULT_TIER = "coach"
# An academy still inside its trial gets the entry-tier cap.
TRIAL_CAP = PLANS[DEFAULT_TIER]["cap"]


def get_price(tier: str, cycle: str):
    """Return the price dict for a self-serve tier/cycle, or None."""
    plan = PLANS.get(tier)
    if not plan:
        return None
    return plan.get(cycle if cycle in ("monthly", "annual") else "monthly")


def athlete_cap(tier: str):
    """Athlete cap for a tier. None means unlimited."""
    plan = PLANS.get(tier or DEFAULT_TIER)
    if not plan:
        return TRIAL_CAP
    return plan["cap"]
