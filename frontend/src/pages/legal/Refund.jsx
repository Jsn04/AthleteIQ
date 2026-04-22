import React from 'react';
import LegalLayout from './LegalLayout';

export default function Refund() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" updated="22 April 2026">
      <p>
        AthleteIQ is a monthly SaaS subscription. This policy sets out when you are
        entitled to a refund, how cancellation works, and how long a refund takes
        to reach your source of payment.
      </p>

      <h2>1. Cancellation</h2>
      <p>
        You can cancel your AthleteIQ subscription at any time from
        <strong> Academy Profile → Billing → Cancel Subscription</strong>, or by
        emailing <a href="mailto:support@athleteiq.in">support@athleteiq.in</a> from
        the registered academy email address. Cancellation takes effect at the end
        of the current billing cycle. You will retain full access until that date.
        Auto-renewal stops immediately on cancellation.
      </p>

      <h2>2. 7-Day Satisfaction Refund (First Subscription Only)</h2>
      <p>
        If you are not satisfied with AthleteIQ within <strong>seven (7) calendar
        days</strong> of your <em>first</em> paid subscription invoice, email
        <a href="mailto:support@athleteiq.in"> support@athleteiq.in</a> with the
        academy name and reason. We will refund the first month's subscription fee
        in full, no questions asked. The 7-day window applies only to the first
        paid invoice on an academy account and is not available on renewals.
      </p>

      <h2>3. Refunds Outside the 7-Day Window</h2>
      <p>
        Monthly subscription fees are otherwise non-refundable. We do not pro-rate
        refunds for mid-cycle cancellation, downgrades, unused users, or
        unactivated features. You continue to have access to the Service for the
        remainder of the cycle you have paid for.
      </p>

      <h2>4. Service-Fault Refunds</h2>
      <p>
        If the Service is unavailable for a continuous period exceeding seventy-two
        (72) hours due to a confirmed fault on our side (excluding scheduled
        maintenance, force majeure events, issues with your own internet or
        device, or downtime of upstream providers beyond our reasonable control),
        you may request a pro-rata credit for the affected days. Credits are
        issued against the next invoice; cash refunds for service-fault credits
        are granted only on cancellation.
      </p>

      <h2>5. Duplicate or Failed Payments</h2>
      <p>
        If you are charged twice for the same billing cycle, or if a payment is
        captured for a subscription that did not activate, the duplicate / erroneous
        amount will be refunded in full to the original source of payment.
      </p>

      <h2>6. How to Request a Refund</h2>
      <p>Email <a href="mailto:support@athleteiq.in">support@athleteiq.in</a> with:</p>
      <ul>
        <li>Academy name and registered email</li>
        <li>Razorpay Payment ID (visible on the invoice)</li>
        <li>Reason for the refund request</li>
      </ul>
      <p>
        We acknowledge refund requests within 2 business days and issue a decision
        within 5 business days.
      </p>

      <h2>7. Refund Processing Time</h2>
      <p>
        Approved refunds are issued to the original payment instrument via Razorpay.
        Funds typically reflect within:
      </p>
      <ul>
        <li><strong>UPI / wallets:</strong> 1–3 business days</li>
        <li><strong>Net banking:</strong> 3–5 business days</li>
        <li><strong>Domestic cards:</strong> 5–7 business days</li>
        <li><strong>International cards:</strong> 7–14 business days</li>
      </ul>
      <p>
        Exact timelines depend on your bank or card issuer and are not controlled by
        AthleteIQ.
      </p>

      <h2>8. Chargebacks</h2>
      <p>
        If you believe a charge is incorrect, please contact us before raising a
        dispute with your bank — we are almost always able to resolve issues
        directly and more quickly. Accounts with an open chargeback may have
        service suspended until the chargeback is resolved.
      </p>

      <h2>9. Contact</h2>
      <p>
        Billing and refunds: <a href="mailto:support@athleteiq.in">support@athleteiq.in</a>.
      </p>
    </LegalLayout>
  );
}
