import React, { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

const PLANS = {
  founding: {
    label: 'Founding 15',
    price: '₹999',
    period: '/month',
    note: 'First 15 academies only — locked for life',
    amount: 99900,
    borderColor: 'border-indigo-500',
    bg: 'bg-indigo-500/5',
    perAthlete: '₹999/month ÷ 40 athletes = ',
    perAthleteHighlight: '₹25 per athlete per month',
    features: [
      'Up to 40 athletes',
      '1 sport section',
      'AI readiness insights (daily)',
      'ACWR injury risk engine',
      'Bulk session logger',
      'Weekly PDF reports',
      'Parent WhatsApp broadcast',
      'Mental performance tools',
      'AI session planner',
    ],
  },
  coach: {
    label: 'Coach',
    price: '₹2,499',
    period: '/month',
    note: 'For solo coaches, single sport',
    amount: 249900,
    borderColor: 'border-emerald-500/40',
    bg: 'bg-emerald-500/5',
    perAthlete: '₹2,499/month ÷ 50 athletes = ',
    perAthleteHighlight: '₹50 per athlete per month',
    features: [
      'Up to 50 athletes',
      '1 sport section',
      '1 coach login',
      'Daily AI readiness scores',
      'ACWR injury risk alerts',
      'Bulk session logger',
      'Weekly PDF reports',
      'Parent WhatsApp updates',
      'Mental wellness suite',
    ],
  },
  academy: {
    label: 'Academy',
    price: '₹5,999',
    period: '/month',
    note: 'For multi-sport academies',
    amount: 599900,
    borderColor: 'border-sky-500/40',
    bg: 'bg-sky-500/5',
    perAthlete: '₹5,999/month ÷ 150 athletes = ',
    perAthleteHighlight: '₹40 per athlete per month',
    features: [
      '150+ athletes',
      'Up to 3 sport sections',
      'Up to 5 coach logins',
      'Everything in Coach',
      'AI training plan generator',
      'Advanced ACWR trends',
      'Deception flag analytics',
      'Priority email support',
    ],
  },
  elite: {
    label: 'Elite',
    price: '₹11,999',
    period: '/month',
    note: 'For institutions & large clubs',
    amount: 1199900,
    borderColor: 'border-purple-500/40',
    bg: 'bg-purple-500/5',
    perAthlete: '₹11,999/month ÷ 300 athletes = ',
    perAthleteHighlight: '₹40 per athlete per month',
    features: [
      'Unlimited athletes',
      'Unlimited sport sections',
      'Unlimited coach logins',
      'Everything in Academy',
      'Custom academy branding on PDFs',
      'Monthly strategy call with founder',
      'Dedicated onboarding session',
      'Direct WhatsApp support',
      'Early access to all new features',
    ],
  },
};

export default function UpgradeModal({ onClose }) {
  const academyId = localStorage.getItem('academyId') || '';
  const academyName = localStorage.getItem('academyName') || 'Your Academy';
  const academyEmail = localStorage.getItem('academyEmail') || '';
  const academyPhone = localStorage.getItem('academyPhone') || '';
  const [selected, setSelected] = useState('academy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const plan = PLANS[selected];

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_BASE_URL}/payments/create-order`, {
        academy_id: academyId,
        plan: selected,
      });

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: 'INR',
        name: 'AthleteIQ',
        description: PLANS[selected].label,
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
        notes: { academy_id: academyId, plan: selected },
        theme: { color: '#4F46E5' },
        handler: async (response) => {
          try {
            await axios.post(`${API_BASE_URL}/payments/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              academy_id: academyId,
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl p-6 space-y-6 my-4">

        {/* Header */}
        <div className="text-center">
          <p className="text-4xl mb-2">🏆</p>
          <h2 className="text-white font-black text-2xl">Choose Your Plan</h2>
          <p className="text-gray-500 text-sm mt-1">
            Turning your academy into an Elite Performance Center
          </p>
        </div>

        {/* Plan selector tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-800 p-1 rounded-xl">
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-white font-black text-xl mb-1">{plan.label}</h3>
              <p className="text-gray-500 text-xs">{plan.note}</p>
            </div>
            <div className="text-right">
              <p className="text-white font-black text-3xl">
                {plan.price}
                <span className="text-gray-500 text-sm font-bold">{plan.period}</span>
              </p>
              <p className="text-gray-600 text-[10px] mt-0.5">billed monthly</p>
            </div>
          </div>

          {/* Features list */}
          <div className="space-y-2.5">
            {plan.features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-emerald-400 text-sm flex-shrink-0">✓</span>
                <span className="text-gray-300 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Per athlete math */}
        <div className="bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
          <p className="text-gray-500 text-xs text-center">
            {plan.perAthlete}
            <span className="text-white font-black">{plan.perAthleteHighlight}</span>
            <span className="text-gray-600"> — less than one protein bar</span>
          </p>
        </div>

        {error && (
          <p className="text-rose-400 text-xs font-bold text-center">{error}</p>
        )}

        {/* CTA */}
        <button onClick={handlePay} disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest transition">
          {loading ? 'Opening payment...' : `Get ${plan.label} — ${plan.price}/month →`}
        </button>

        <p className="text-center text-gray-600 text-[10px]">
          Secured by Razorpay · UPI, Cards, Netbanking, EMI · Cancel anytime
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
