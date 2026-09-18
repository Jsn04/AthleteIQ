import React, { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

// Priced by academy size only. Both tiers get the same features — we charge
// more when an academy is bigger, we don't withhold functionality.
const FEATURES = [
  'Daily athlete check-ins',
  'AI readiness scores',
  'ACWR injury risk engine',
  'Deception flag analytics',
  'Bulk session logger',
  'AI session planner',
  'Weekly PDF reports',
  'Parent WhatsApp broadcast',
  'Coach ↔ athlete messaging',
  'Mental performance tools',
];

const PLANS = {
  coach: {
    label: 'Coach',
    cap: 'Up to 60 athletes',
    note: 'For a single coach or small academy',
    monthly: { price: '₹1,999', amount: 199900 },
    annual: { price: '₹19,999', amount: 1999900 },
    borderColor: 'border-emerald-500/40',
    bg: 'bg-emerald-500/5',
  },
  academy: {
    label: 'Academy',
    cap: 'Up to 250 athletes',
    note: 'For multi-sport academies',
    monthly: { price: '₹4,999', amount: 499900 },
    annual: { price: '₹49,999', amount: 4999900 },
    borderColor: 'border-sky-500/40',
    bg: 'bg-sky-500/5',
  },
};

export default function UpgradeModal({ onClose }) {
  const academyId = localStorage.getItem('academyId') || '';
  const academyName = localStorage.getItem('academyName') || 'Your Academy';
  const academyEmail = localStorage.getItem('academyEmail') || '';
  const academyPhone = localStorage.getItem('academyPhone') || '';
  const [selected, setSelected] = useState('coach');
  const [cycle, setCycle] = useState('annual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const plan = PLANS[selected];
  const price = plan[cycle];
  const period = cycle === 'annual' ? '/year' : '/month';

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_BASE_URL}/payments/create-order`, {
        academy_id: academyId,
        plan: selected,
        cycle,
      });

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: 'INR',
        name: 'AthleteIQ',
        description: data.plan_name,
        order_id: data.order_id,
        prefill: {
          name: academyName,
          email: academyEmail,
          contact: academyPhone,
        },
        method: {
          card: true,
          netbanking: true,
          wallet: true,
          upi: true,
          emi: true,
        },
        config: {
          display: {
            preferences: { show_default_blocks: true },
          },
        },
        notes: { academy_id: academyId, plan: selected, cycle },
        theme: { color: '#4F46E5' },
        handler: async (response) => {
          try {
            await axios.post(`${API_BASE_URL}/payments/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              academy_id: academyId,
              plan: selected,
              cycle,
            });
            localStorage.setItem('plan', 'paid');
            window.location.reload();
          } catch {
            setError('Payment verification failed. Contact support.');
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      setError('Could not initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-6 space-y-5 my-4">

        {/* Header */}
        <div className="text-center">
          <p className="text-4xl mb-2">🏆</p>
          <h2 className="text-white font-black text-2xl">Choose Your Plan</h2>
          <p className="text-gray-500 text-sm mt-1">
            Every feature on both plans. Pick the one that fits your size.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="grid grid-cols-2 gap-2 bg-gray-800 p-1 rounded-xl max-w-xs mx-auto">
          {[
            { key: 'monthly', label: 'Monthly' },
            { key: 'annual', label: 'Annual · 2 months free' },
          ].map(c => (
            <button key={c.key} onClick={() => setCycle(c.key)}
              className={`py-2 rounded-lg text-[11px] font-black transition ${cycle === c.key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-300'
                }`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Plan selector */}
        <div className="grid grid-cols-2 gap-2 bg-gray-800 p-1 rounded-xl">
          {Object.entries(PLANS).map(([key, p]) => (
            <button key={key} onClick={() => setSelected(key)}
              className={`py-2 rounded-lg text-xs font-black transition ${selected === key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-300'
                }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Selected plan detail */}
        <div className={`rounded-2xl border p-5 ${plan.borderColor} ${plan.bg}`}>
          <div className="flex items-start justify-between mb-4 gap-4">
            <div>
              <h3 className="text-white font-black text-xl mb-1">{plan.label}</h3>
              <p className="text-gray-400 text-xs font-bold">{plan.cap}</p>
              <p className="text-gray-500 text-xs mt-0.5">{plan.note}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white font-black text-3xl">
                {price.price}
                <span className="text-gray-500 text-sm font-bold">{period}</span>
              </p>
              <p className="text-gray-600 text-[10px] mt-0.5">
                {cycle === 'annual' ? 'billed once a year' : 'billed monthly'}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-emerald-400 text-sm flex-shrink-0">✓</span>
                <span className="text-gray-300 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-rose-400 text-xs font-bold text-center">{error}</p>
        )}

        {/* CTA */}
        <button onClick={handlePay} disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest transition">
          {loading ? 'Opening payment...' : `Get ${plan.label} — ${price.price}${period} →`}
        </button>

        <p className="text-center text-gray-600 text-[10px]">
          Secured by Razorpay · UPI, Cards, Netbanking, EMI
        </p>

        <p className="text-center text-gray-600 text-[11px]">
          More than 250 athletes?{' '}
          <a href="mailto:jineshnanal04@gmail.com?subject=AthleteIQ%20Institution%20plan"
            className="text-indigo-400 hover:text-indigo-300 font-bold">
            Talk to us about Institution
          </a>
        </p>

        {onClose && (
          <button onClick={onClose}
            className="w-full text-gray-600 hover:text-gray-400 text-xs transition text-center">
            Maybe later
          </button>
        )}
      </div>
    </div>
  );
}
