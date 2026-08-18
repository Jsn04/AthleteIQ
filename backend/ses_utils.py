import logging
import os

import boto3
from botocore.exceptions import BotoCoreError, ClientError

log = logging.getLogger(__name__)

_SES_ENABLED = bool(
    os.environ.get("AWS_ACCESS_KEY_ID")
    and os.environ.get("AWS_SECRET_ACCESS_KEY")
    and os.environ.get("AWS_SES_SENDER")
)

SENDER = os.environ.get("AWS_SES_SENDER", "")
REGION = os.environ.get("AWS_REGION", "ap-south-1")


def ses_enabled() -> bool:
    return _SES_ENABLED


def _client():
    return boto3.client(
        "ses",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        region_name=REGION,
    )


def send_red_zone_alert(
    *,
    athlete_name: str,
    risk_score: int,
    acwr,
    signals,
    verdict: str,
    coach_email: str,
    parent_email=None,
) -> None:
    """Fire a red-zone injury risk alert to the coach (and optionally parent).
    Silently no-ops if SES is not configured."""
    if not _SES_ENABLED:
        log.debug("SES not configured — skipping red-zone alert for %s", athlete_name)
        return

    acwr_str = f"{acwr:.2f}" if acwr else "N/A"
    signals_html = "".join(f"<li>{s}</li>" for s in signals) if signals else "<li>No specific signals</li>"

    subject = f"🔴 Red Zone Alert — {athlete_name} ({risk_score}/100)"

    body_html = f"""
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:auto;padding:24px">
  <div style="background:#dc2626;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">⚠️ Red Zone Injury Risk Alert</h2>
    <p style="margin:4px 0 0;opacity:.85">AthleteIQ — Automated Risk Notification</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="padding:10px;background:#fef2f2;border-radius:6px;width:50%">
          <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:bold">Athlete</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:bold">{athlete_name}</p>
        </td>
        <td style="padding:10px;width:4%"></td>
        <td style="padding:10px;background:#fef2f2;border-radius:6px;width:46%">
          <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:bold">Risk Score</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#dc2626">{risk_score}/100 · ACWR {acwr_str}</p>
        </td>
      </tr>
    </table>
    <h3 style="margin:0 0 8px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:.05em">Risk Signals</h3>
    <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:14px">
      {signals_html}
    </ul>
    <h3 style="margin:0 0 8px;font-size:14px;color:#374151;text-transform:uppercase;letter-spacing:.05em">Verdict</h3>
    <p style="margin:0 0 24px;font-size:14px;background:#f9fafb;padding:12px;border-radius:6px;border-left:3px solid #dc2626">{verdict}</p>
    <p style="margin:0;font-size:12px;color:#9ca3af">
      This alert was generated automatically by AthleteIQ. Log in to your dashboard for full context and to adjust the athlete's training load.
    </p>
  </div>
</body></html>
"""

    body_text = (
        f"RED ZONE ALERT — {athlete_name}\n"
        f"Risk Score: {risk_score}/100 | ACWR: {acwr_str}\n\n"
        f"Signals:\n" + "\n".join(f"- {s}" for s in signals) +
        f"\n\nVerdict: {verdict}\n\n"
        "Log in to AthleteIQ for full context."
    )

    recipients = [coach_email]
    if parent_email:
        recipients.append(parent_email)

    try:
        _client().send_email(
            Source=SENDER,
            Destination={"ToAddresses": recipients},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": body_text, "Charset": "UTF-8"},
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                },
            },
        )
        log.info("Red-zone alert sent for %s → %s", athlete_name, recipients)
    except (BotoCoreError, ClientError) as exc:
        log.error("SES send failed for %s: %s", athlete_name, exc)
