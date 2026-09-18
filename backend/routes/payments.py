import os
import hmac
import hashlib
import logging
from datetime import datetime, timedelta, timezone

import razorpay
from fastapi import APIRouter, HTTPException, Request

from db import safe_query
from plans import PLANS, get_price

router = APIRouter()
log = logging.getLogger(__name__)

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
WEBHOOK_SECRET      = os.getenv("RAZORPAY_WEBHOOK_SECRET")

rz_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def _paid_until(cycle: str) -> str:
    """Annual buys 365 days, monthly buys 30."""
    days = 365 if cycle == "annual" else 30
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


@router.post("/create-order")
async def create_order(payload: dict):
    academy_id = payload.get("academy_id")
    tier       = payload.get("plan", "coach")
    cycle      = payload.get("cycle", "monthly")
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id required")

    price = get_price(tier, cycle)
    if not price:
        # Institution is quoted manually, so it has no self-serve price.
        raise HTTPException(status_code=400, detail="That plan is not available for self-serve checkout.")
    try:
        order = rz_client.order.create({
            "amount":   price["amount"],
            "currency": "INR",
            "notes":    {"academy_id": academy_id, "plan": tier, "cycle": cycle}
        })

        safe_query(
            lambda sb: sb.table("academies").update({
                "razorpay_order_id": order["id"]
            }).eq("id", academy_id).execute()
        )

        return {
            "order_id":  order["id"],
            "amount":    price["amount"],
            "currency":  "INR",
            "key_id":    RAZORPAY_KEY_ID,
            "plan_name": price["label"],
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("POST /payments/create-order failed: %s", e)
        raise HTTPException(status_code=500, detail="Could not create order. Try again.")


@router.post("/verify")
async def verify_payment(payload: dict):
    order_id   = payload.get("razorpay_order_id")
    payment_id = payload.get("razorpay_payment_id")
    signature  = payload.get("razorpay_signature")
    academy_id = payload.get("academy_id")
    tier       = payload.get("plan", "coach")
    cycle      = payload.get("cycle", "monthly")

    if not all([order_id, payment_id, signature, academy_id]):
        raise HTTPException(status_code=400, detail="Missing payment fields")
    try:
        msg      = f"{order_id}|{payment_id}"
        expected = hmac.new(
            RAZORPAY_KEY_SECRET.encode(), msg.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid signature")

        safe_query(
            lambda sb: sb.table("academies").update({
                "plan":                "paid",
                "plan_tier":           tier if tier in PLANS else "coach",
                "billing_cycle":       cycle if cycle in ("monthly", "annual") else "monthly",
                "paid_at":             datetime.now(timezone.utc).isoformat(),
                "paid_until":          _paid_until(cycle),
                "razorpay_payment_id": payment_id,
            }).eq("id", academy_id).execute()
        )

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        log.error("POST /payments/verify failed: %s", e)
        raise HTTPException(status_code=500, detail="Payment verification failed.")


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    try:
        body      = await request.body()
        signature = request.headers.get("x-razorpay-signature", "")

        expected = hmac.new(
            WEBHOOK_SECRET.encode(), body, hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

        event = await request.json()
        if event.get("event") == "payment.captured":
            payment    = event["payload"]["payment"]["entity"]
            notes      = payment.get("notes", {}) or {}
            academy_id = notes.get("academy_id")
            tier       = notes.get("plan", "coach")
            cycle      = notes.get("cycle", "monthly")
            if academy_id:
                safe_query(
                    lambda sb: sb.table("academies").update({
                        "plan":                "paid",
                        "plan_tier":           tier if tier in PLANS else "coach",
                        "billing_cycle":       cycle if cycle in ("monthly", "annual") else "monthly",
                        "paid_at":             datetime.now(timezone.utc).isoformat(),
                        "paid_until":          _paid_until(cycle),
                        "razorpay_payment_id": payment["id"],
                    }).eq("id", academy_id).execute()
                )

        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        log.error("POST /payments/webhook failed: %s", e)
        return {"status": "error"}
