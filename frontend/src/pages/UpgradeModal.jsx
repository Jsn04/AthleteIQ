import React, { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

const PLANS = {
  founding: {
    label: 'Founding 15',
    price: '₹999/month',
    note: 'First 15 academies only — locked for life',
    amount: 99900,
    badge: '🔥 Best Deal',
  },
  pro: {
    label: 'Pro',
    price: '₹2,499/month',
    note: 'Full access, cancel anytime',
    amount: 249900,
    badge: null,
  },
  elite: {
    label: 'Elite',
    price: '₹4,999/month',
    note: 'Large clubs — multi-sport, custom branding',
    amount: 499900,
    badge: null,
  },
};

export default function UpgradeModal({ onClose }) {
  const academyId   = localStorage.getItem('academyId') || '';
  const academyName = localStorage.getItem('academyName') || 'Your Academy';
  const [selected, setSelected] = useState('founding');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_BASE_URL}/payments/create-order`, {
        academy_id: academyId,
        plan: selected,
      });

      const options = {
        key:         data.key_id,
        amount:      data.amount,
        currency:    'INR',
        name:        'AthleteIQ',
        description: PLANS[selected].label,
        order_id:    data.order_id,
        prefill:     { name: academyName },
        theme:       { color: '#4F46E5' },
        handler: async (response) => {
          try {
            await axios.post(`${API_BASE_URL}/payments/verify`, {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              academy_id:          academyId,
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
    } catch (err) {
      setError('Could not initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-5">

        <div className="text-center">
          <p className="text-4xl mb-2">🏆</p>
          <h2 className="text-white font-black text-xl">Unlock Full Access</h2>
          <p className="text-gray-500 text-xs mt-1">Your 14-day free trial has ended. Choose a plan to continue.</p>
        </div>

        <div className="space-y-3">
          {Object.entries(PLANS).map(([key, plan]) => (
            <button key={key} onClick={() => setSelected(key)}
              className={`w-full text-left p-4 rounded-xl border-2 transition ${
                selected === key
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-500'
              }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-black text-sm">{plan.label}</p>
                    {plan.badge && (
                      <span className="text-[10px] font-black bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{plan.note}</p>
                </div>
                <p className="text-indigo-400 font-black text-base">{plan.price}</p>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-rose-400 text-xs font-bold text-center">{error}</p>
        )}

        <button onClick={handlePay} disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest transition">
          {loading ? 'Opening payment...' : `Pay ${PLANS[selected].price} →`}
        </button>

        <p className="text-center text-gray-600 text-[10px]">
          Secured by Razorpay · UPI, Cards, Netbanking, EMI accepted
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
