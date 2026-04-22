import React from 'react';
import LegalLayout from './LegalLayout';

const CONTACT_ROWS = [
  { label: 'General & Sales', email: 'hello@athleteiq.in', hours: 'Mon–Sat, 10:00–19:00 IST' },
  { label: 'Support', email: 'support@athleteiq.in', hours: 'Mon–Sat, 10:00–19:00 IST' },
  { label: 'Billing & Refunds', email: 'support@athleteiq.in', hours: 'Mon–Fri, 10:00–18:00 IST' },
  { label: 'Privacy & Grievance Officer', email: 'privacy@athleteiq.in', hours: 'Responses within 72 hours' },
];

export default function Contact() {
  return (
    <LegalLayout title="Contact Us" updated="22 April 2026">
      <p>
        AthleteIQ is operated by <strong>Jinesh Nanal</strong> as a sole
        proprietorship based in Pune, Maharashtra, India. You can reach us through
        the channels below — we prioritise email for anything that requires a
        written record.
      </p>

      <h2>Business Details</h2>
      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 not-prose">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
          <dt className="text-gray-500 text-[11px] uppercase tracking-widest font-bold">Entity</dt>
          <dd className="sm:col-span-2 text-white">AthleteIQ (Sole Proprietorship)</dd>

          <dt className="text-gray-500 text-[11px] uppercase tracking-widest font-bold">Proprietor</dt>
          <dd className="sm:col-span-2 text-white">Jinesh Nanal</dd>

          <dt className="text-gray-500 text-[11px] uppercase tracking-widest font-bold">City</dt>
          <dd className="sm:col-span-2 text-white">Pune, Maharashtra, India</dd>

          <dt className="text-gray-500 text-[11px] uppercase tracking-widest font-bold">Primary Email</dt>
          <dd className="sm:col-span-2 text-white">
            <a href="mailto:hello@athleteiq.in" className="text-indigo-400 hover:text-indigo-300">hello@athleteiq.in</a>
          </dd>

          <dt className="text-gray-500 text-[11px] uppercase tracking-widest font-bold">Phone</dt>
          <dd className="sm:col-span-2 text-white">
            <a href="tel:+918087688956" className="text-indigo-400 hover:text-indigo-300">+91 80876 88956</a>
            <span className="text-gray-500 text-xs ml-2">(Mon–Sat, 10:00–19:00 IST)</span>
          </dd>
        </dl>
      </div>

      <h2>Departments</h2>
      <div className="space-y-3 not-prose">
        {CONTACT_ROWS.map(r => (
          <div key={r.label} className="flex items-start justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
            <div>
              <p className="text-white text-sm font-bold">{r.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{r.hours}</p>
            </div>
            <a href={`mailto:${r.email}`} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold whitespace-nowrap">
              {r.email}
            </a>
          </div>
        ))}
      </div>

      <h2>Grievance Officer (DPDP Act, 2023)</h2>
      <p>
        In line with the Digital Personal Data Protection Act, 2023 and the IT
        Rules, concerns about the handling of personal data by AthleteIQ can be
        raised with the Grievance Officer:
      </p>
      <ul>
        <li><strong>Name:</strong> Jinesh Nanal</li>
        <li><strong>Email:</strong> <a href="mailto:privacy@athleteiq.in">privacy@athleteiq.in</a></li>
        <li><strong>Response window:</strong> Acknowledgement within 72 hours, resolution within 30 days</li>
      </ul>

      <h2>Response Expectations</h2>
      <p>
        We aim to respond to support emails within one business day. Sales and
        partnership enquiries are usually answered the same day. If your query is
        urgent and relates to an active outage or payment failure, include the word
        <strong> URGENT</strong> in the subject line.
      </p>
    </LegalLayout>
  );
}
