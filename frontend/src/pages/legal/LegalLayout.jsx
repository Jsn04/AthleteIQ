import React from 'react';
import { Link } from 'react-router-dom';

const LINKS = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refund', label: 'Refund & Cancellation' },
  { to: '/contact', label: 'Contact' },
];

export default function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="border-b border-white/5 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-white font-black tracking-tight text-lg">AthleteIQ</Link>
          <nav className="hidden sm:flex gap-5">
            {LINKS.map(l => (
              <Link key={l.to} to={l.to}
                className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <p className="text-indigo-400 text-[11px] font-black uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-white font-black text-3xl sm:text-4xl mb-2 tracking-tight">{title}</h1>
        <p className="text-gray-600 text-xs mb-10">Last updated: {updated}</p>

        <article className="legal-prose space-y-6 text-gray-300 text-[15px] leading-relaxed">
          {children}
        </article>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-wrap gap-4 sm:hidden">
          {LINKS.map(l => (
            <Link key={l.to} to={l.to}
              className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition">
              {l.label}
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 mt-8">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-gray-600 text-[11px] uppercase tracking-widest font-bold">
            AthleteIQ · India · © {new Date().getFullYear()}
          </p>
          <p className="text-gray-700 text-[11px]">
            Operated by Jinesh Nanal, Pune, Maharashtra, India
          </p>
        </div>
      </footer>

      <style>{`
        .legal-prose h2 { color: #fff; font-weight: 900; font-size: 1.15rem; letter-spacing: -0.01em; margin-top: 2rem; margin-bottom: 0.5rem; }
        .legal-prose h3 { color: #e5e7eb; font-weight: 800; font-size: 0.95rem; margin-top: 1.25rem; margin-bottom: 0.35rem; }
        .legal-prose p { color: #d1d5db; }
        .legal-prose ul { list-style: disc; padding-left: 1.25rem; color: #d1d5db; }
        .legal-prose ul li { margin-bottom: 0.35rem; }
        .legal-prose a { color: #818cf8; text-decoration: underline; }
        .legal-prose strong { color: #fff; font-weight: 700; }
      `}</style>
    </div>
  );
}
