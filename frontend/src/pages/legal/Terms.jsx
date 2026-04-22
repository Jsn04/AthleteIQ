import React from 'react';
import LegalLayout from './LegalLayout';

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="22 April 2026">
      <p>
        These Terms of Service ("Terms") govern your access to and use of AthleteIQ
        (the "Service"), a performance and wellness management platform for sports
        academies, operated from Pune, Maharashtra, India by Jinesh Nanal as sole
        proprietor ("AthleteIQ", "we", "our", "us"). By registering an academy,
        coach, athlete or parent account, you agree to be bound by these Terms.
      </p>

      <h2>1. Eligibility and Account Registration</h2>
      <p>
        The Service is intended for use by sports academies, their authorised coaches,
        registered athletes and the parents/guardians of minor athletes. You confirm
        that you have the authority to register the academy on whose behalf you are
        signing up, and that information provided during registration is accurate and
        current. Coaches and academy owners are responsible for securing consent from
        athletes and, where athletes are minors, from a parent or legal guardian,
        before entering their personal or performance data into the Service.
      </p>

      <h2>2. Subscription, Billing and Auto-Renewal</h2>
      <p>
        Paid access is offered on the plans displayed in-app (currently Founding 15,
        Pro and Elite). Subscriptions are billed monthly in Indian Rupees through
        Razorpay. The <strong>Founding 15</strong> price is locked for the lifetime of
        an uninterrupted subscription for the first fifteen academies to subscribe on
        that tier; any lapse or cancellation forfeits the locked price.
      </p>
      <p>
        Unless cancelled, subscriptions renew automatically at the start of each
        billing cycle at the then-current price. Prices are exclusive of applicable
        taxes, which will be added where required by law. We may revise pricing with
        at least 30 days' notice over email; revisions will not apply mid-cycle.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>upload data relating to individuals who have not consented to its collection;</li>
        <li>share academy login credentials with unaffiliated third parties;</li>
        <li>attempt to reverse engineer, scrape, probe or disrupt the Service or its infrastructure;</li>
        <li>use the Service for any unlawful, harassing, discriminatory or harmful purpose;</li>
        <li>upload medical, diagnostic or doping information that belongs in a regulated clinical system.</li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate this section, including
        immediately and without refund where the violation is material.
      </p>

      <h2>4. Role of AI-Generated Output</h2>
      <p>
        AthleteIQ uses machine-learning models to produce readiness scores, ACWR
        signals, drill suggestions, weekly reports and parent-facing narratives.
        These outputs are decision-support tools for qualified coaches and are
        <strong> not medical advice, diagnosis, or a substitute for the judgement of a
        licensed physician, physiotherapist or sports-medicine professional</strong>.
        Coaches retain full responsibility for training and return-to-play decisions.
      </p>

      <h2>5. Intellectual Property</h2>
      <p>
        The Service, including its source code, UI, AI prompts, drill library and
        brand assets, is the intellectual property of AthleteIQ. You retain ownership
        of data you upload (session logs, wellness check-ins, athlete profiles).
        You grant us a non-exclusive, royalty-free licence to process that data
        solely to operate, secure and improve the Service for your academy.
      </p>

      <h2>6. Availability and Support</h2>
      <p>
        We target high availability but do not guarantee uninterrupted service.
        Planned maintenance will be communicated in advance where possible. Support
        is provided over email at
        {' '}<a href="mailto:support@athleteiq.in">support@athleteiq.in</a>{' '}
        during business hours (Mon–Sat, 10:00–19:00 IST).
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by Indian law, AthleteIQ's aggregate
        liability for any claim arising from or related to the Service is limited to
        the subscription fees paid by the affected academy in the three (3) months
        immediately preceding the event giving rise to the claim. We are not liable
        for indirect, incidental, special or consequential damages, loss of revenue,
        loss of goodwill, or loss of data beyond our reasonable control.
      </p>

      <h2>8. Indemnity</h2>
      <p>
        You agree to indemnify and hold AthleteIQ harmless from third-party claims
        arising out of your misuse of the Service, your breach of these Terms, or
        your violation of applicable law, including data-protection obligations to
        athletes and parents whose data you upload.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may cancel your subscription at any time from your Academy Profile; the
        cancellation takes effect at the end of the current billing cycle. We may
        terminate accounts for non-payment, breach of these Terms, or where required
        by law. Upon termination, access to the dashboard will cease and your data
        will be retained for 90 days for reactivation before being securely deleted.
      </p>

      <h2>10. Governing Law and Jurisdiction</h2>
      <p>
        These Terms are governed by the laws of India. Any dispute will be subject to
        the exclusive jurisdiction of the courts at Pune, Maharashtra.
      </p>

      <h2>11. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        communicated over email to the academy's registered address at least 14 days
        before taking effect. Continued use of the Service after the effective date
        constitutes acceptance of the revised Terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:support@athleteiq.in">support@athleteiq.in</a>.
      </p>
    </LegalLayout>
  );
}
