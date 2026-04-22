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
    badge: '🔥 Best Deal',
    badgeColor: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
    borderColor: 'border-indigo-500',
    bg: 'bg-indigo-500/5',
    features: [
      'Up to 40 athletes',
      'AI readiness insights (daily)',
      'ACWR injury risk engine',
      'Bulk session logger',
      'Weekly performance PDF report',
      'Parent WhatsApp broadcast',
      'Attendance tracker',
      'Injury log',
      'Mental performance tools',
      'Session planner (AI)',
    ],
  },
  pro: {
    label: 'Pro',
    price: '₹2,499',
    period: '/month',
    note: 'For growing academies',
    amount: 249900,
    badge: null,
    badgeColor: '',
    borderColor: 'border-gray-700',
    bg: 'bg-gray-800',
    features: [
      'Unlimited athletes',
      'Everything in Founding 15',
      'Multiple sport sections',
      'Multi-coach access',
      'Priority email support',
      'Deception flag analytics',
      'Advanced ACWR trends',
    ],
  },
  elite: {
    label: 'Elite',
    price: '₹4,999',
    period: '/month',
    note: 'For large clubs & institutions',
    amount: 499900,
    badge: '🏆 Premium',
    badgeColor: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    borderColor: 'border-gray-700',
    bg: 'bg-gray-800',
    features: [
      'Everything in Pro',
      'Custom academy branding on PDFs',
      'Monthly strategy call with founder',
      'Multi-sport club dashboard',
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
  const [selected, setSelected] = useState('founding');
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
        <div className="grid grid-cols-3 gap-2 bg-gray-800 p-1 rounded-xl">
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
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-black text-xl">{plan.label}</h3>
                {plan.badge && (
                  <span className={`text-[10px] font-black border px-2 py-0.5 rounded-full ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                )}
              </div>
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
            {selected === 'founding' && '₹999/month ÷ 30 athletes = '}
            {selected === 'pro' && '₹2,499/month ÷ 50 athletes = '}
            {selected === 'elite' && '₹4,999/month ÷ 100 athletes = '}
            <span className="text-white font-black">
              {selected === 'founding' && '₹33 per athlete per month'}
              {selected === 'pro' && '₹50 per athlete per month'}
              {selected === 'elite' && '₹50 per athlete per month'}
            </span>
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