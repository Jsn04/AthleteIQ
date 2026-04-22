import React from 'react';
import LegalLayout from './LegalLayout';

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="22 April 2026">
      <p>
        AthleteIQ respects the privacy of academies, coaches, athletes and parents
        who use the Service. This Policy explains what personal data we collect, why
        we collect it, how it is stored and shared, and the rights you have under
        the Digital Personal Data Protection Act, 2023 ("DPDP Act") and the
        Information Technology Act, 2000 with its rules.
      </p>

      <h2>1. Data Fiduciary</h2>
      <p>
        For data uploaded by an academy about its athletes, coaches and parents, the
        <strong> academy is the Data Fiduciary</strong> and AthleteIQ acts as the
        Data Processor. For account-level data (academy owner name, email, billing),
        AthleteIQ is the Data Fiduciary.
      </p>

      <h2>2. Data We Collect</h2>
      <h3>Account data</h3>
      <ul>
        <li>Academy name, owner name, email address, phone number</li>
        <li>Authentication credentials (hashed passwords only)</li>
        <li>Subscription plan and payment status</li>
      </ul>

      <h3>Athlete & wellness data</h3>
      <ul>
        <li>Athlete name, sport, date of birth, gender, contact of parent/guardian</li>
        <li>Daily wellness check-ins (sleep, soreness, mood, energy, stress)</li>
        <li>Training session logs (RPE, duration, type)</li>
        <li>Attendance records, injury logs, notes left by coaches</li>
        <li>Readiness scores and ACWR derived by our AI engine</li>
      </ul>

      <h3>Technical data</h3>
      <ul>
        <li>IP address, device type, browser, approximate location (for security)</li>
        <li>Usage analytics (pages visited, features used)</li>
      </ul>

      <h3>Payment data</h3>
      <p>
        Payments are processed by <strong>Razorpay Software Pvt. Ltd.</strong>
        We do not store card numbers, CVVs or UPI PINs on our servers. We retain
        only a payment reference (Razorpay order and payment IDs) for reconciliation
        and invoicing.
      </p>

      <h2>3. Purposes of Processing</h2>
      <ul>
        <li>To provide dashboards, readiness scoring, ACWR analysis, weekly reports and planner outputs to authorised users of the academy</li>
        <li>To authenticate users and secure the account</li>
        <li>To process subscription payments and issue invoices</li>
        <li>To send service-related communications (billing, security, outages, material changes to terms)</li>
        <li>To improve the Service in aggregated or anonymised form</li>
      </ul>
      <p>
        We do not sell personal data. We do not use athlete data to train third-party
        AI models.
      </p>

      <h2>4. Legal Basis and Consent</h2>
      <p>
        Processing is carried out on the basis of the consent collected by the
        academy from athletes, coaches and parents at onboarding, and on the basis
        of the contractual necessity of providing the subscribed Service. For
        minors, the academy is responsible for obtaining verifiable parental consent
        before uploading the minor's data, as required by the DPDP Act.
      </p>

      <h2>5. Sharing and Sub-processors</h2>
      <p>
        Personal data is shared with the following trusted sub-processors, each
        bound by their own security and privacy commitments:
      </p>
      <ul>
        <li><strong>Supabase</strong> — PostgreSQL database and authentication hosting</li>
        <li><strong>Render</strong> — backend application hosting</li>
        <li><strong>Vercel</strong> — frontend hosting and CDN</li>
        <li><strong>Razorpay</strong> — payment processing</li>
        <li><strong>Groq</strong> — inference provider for AI-generated insights (processed in-request, not stored by the provider)</li>
        <li><strong>Email delivery provider</strong> — transactional email for signups, password resets, billing</li>
      </ul>
      <p>
        We do not transfer personal data to any party for marketing or advertising
        purposes.
      </p>

      <h2>6. International Transfers</h2>
      <p>
        Some sub-processors operate infrastructure outside India. Where data is
        transferred internationally, it is transferred only to jurisdictions that
        are not on a list of restricted countries notified by the Government of
        India under the DPDP Act, and under contractual safeguards with the
        sub-processor.
      </p>

      <h2>7. Retention</h2>
      <p>
        Active academy data is retained for the duration of the subscription and for
        90 days thereafter to allow reactivation. Weekly reports and attendance
        records are retained for up to 24 months to support longitudinal comparisons.
        Payment records are retained for the statutory period required under Indian
        tax and financial law (currently 8 years). On verified request, we will
        delete personal data earlier, except where retention is legally required.
      </p>

      <h2>8. Security</h2>
      <p>
        We use TLS in transit, encrypted storage at rest on managed database
        infrastructure, hashed passwords, role-based access within the dashboard,
        and isolated data per academy. We review access logs and patch
        infrastructure on a regular cadence. No internet-connected system is
        completely secure; in the event of a qualifying data breach we will notify
        affected academies and the Data Protection Board of India within the
        timelines required by law.
      </p>

      <h2>9. Your Rights</h2>
      <p>Under the DPDP Act, data principals have the right to:</p>
      <ul>
        <li>access a summary of personal data being processed;</li>
        <li>correct inaccurate or outdated data;</li>
        <li>erase data that is no longer necessary or where consent is withdrawn;</li>
        <li>nominate a person to exercise rights in case of death or incapacity;</li>
        <li>raise a grievance with our Grievance Officer (see Contact page).</li>
      </ul>
      <p>
        Requests from athletes, coaches and parents should first be raised with
        their academy (the Data Fiduciary). Account-level requests can be sent to
        <a href="mailto:privacy@athleteiq.in"> privacy@athleteiq.in</a>.
      </p>

      <h2>10. Children</h2>
      <p>
        AthleteIQ is used by academies that train minors. We do not allow minors to
        register their own account directly. All data relating to minors must be
        uploaded by the academy after obtaining verifiable parental consent.
      </p>

      <h2>11. Cookies</h2>
      <p>
        We use strictly necessary cookies and local storage to keep you signed in
        and to remember your academy. We do not use advertising cookies or
        third-party behavioural trackers.
      </p>

      <h2>12. Changes to this Policy</h2>
      <p>
        We will post material changes to this Policy on this page and notify
        academy owners over email at least 14 days before the change takes effect.
      </p>

      <h2>13. Contact</h2>
      <p>
        Privacy queries: <a href="mailto:privacy@athleteiq.in">privacy@athleteiq.in</a>.
        Grievance Officer: Jinesh Nanal, Pune, Maharashtra, India.
      </p>
    </LegalLayout>
  );
}
