import React, { useState, useEffect } from 'react';
import { PAYMENT_REQUIRED_EVENT } from '../../api';
import UpgradeModal from '../../pages/UpgradeModal';

/**
 * Listens for the 402 broadcast from the axios interceptors and turns it into
 * something the user can act on. Coaches get the plan picker; athletes get a
 * plain notice, since they have no way to pay for the academy themselves.
 */
export default function UpgradeGate() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const onPaymentRequired = (e) => setMessage(e.detail || 'Your access has expired.');
    window.addEventListener(PAYMENT_REQUIRED_EVENT, onPaymentRequired);
    return () => window.removeEventListener(PAYMENT_REQUIRED_EVENT, onPaymentRequired);
  }, []);

  if (message === null) return null;

  const isCoach = localStorage.getItem('role') === 'coach';
  if (isCoach) return <UpgradeModal onClose={() => setMessage(null)} />;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setMessage(null)}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-3xl mb-3">🔒</p>
        <h3 className="text-white font-black text-lg mb-2">Access paused</h3>
        <p className="text-gray-400 text-sm mb-5">{message} Ask your coach to renew the academy's plan.</p>
        <button
          onClick={() => setMessage(null)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl text-sm font-bold transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
