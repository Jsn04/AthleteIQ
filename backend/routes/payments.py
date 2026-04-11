import os
import hmac
import hashlib
import logging
from datetime import datetime, timezone

import razorpay
from fastapi import APIRouter, HTTPException, Request

from db import safe_query

router = APIRouter()
log = logging.getLogger(__name__)

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
WEBHOOK_SECRET      = os.getenv("RAZORPAY_WEBHOOK_SECRET")

rz_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

PLANS = {
    "founding": {"amount": 99900,  "name": "Founding 15 — ₹999/mo"},
    "pro":      {"amount": 249900, "name": "Pro — ₹2,499/mo"},
    "elite":    {"amount": 499900, "name": "Elite — ₹4,999/mo"},
}


@router.post("/create-order")
async def create_order(payload: dict):
    academy_id = payload.get("academy_id")
    plan       = payload.get("plan", "pro")
    if not academy_id:
        raise HTTPException(status_code=400, detail="academy_id required")
    try:
        plan_data = PLANS.get(plan, PLANS["pro"])
        order = rz_client.order.create({
            "amount":   plan_data["amount"],
            "currency": "INR",
            "notes":    {"academy_id": academy_id, "plan": plan}
        })

        safe_query(
            lambda sb: sb.table("academies").update({
                "razorpay_order_id": order["id"]
            }).eq("id", academy_id).execute()
        )

        return {
            "order_id":  order["id"],
            "amount":    plan_data["amount"],
            "currency":  "INR",
            "key_id":    RAZORPAY_KEY_ID,
            "plan_name": plan_data["name"],
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
                "paid_at":             datetime.now(timezone.utc).isoformat(),
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
            academy_id = payment.get("notes", {}).get("academy_id")
            if academy_id:
                safe_query(
                    lambda sb: sb.table("academies").update({
                        "plan":                "paid",
                        "paid_at":             datetime.now(timezone.utc).isoformat(),
                        "razorpay_payment_id": payment["id"],
                    }).eq("id", academy_id).execute()
                )

        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        log.error("POST /payments/webhook failed: %s", e)
        return {"status": "error"}
