import React from 'react';

const RiskBadge = ({ risk, checkedIn = true }) => {
  if (!checkedIn) return (
    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-gray-800 text-gray-500 border border-gray-700 uppercase tracking-widest">
      No Check-in
    </span>
  );

  const config = {
    green: {
      style: 'bg-green-500/10 text-green-400 border-green-500/20',
      label: '✅ Low Risk',
    },
    yellow: {
      style: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      label: '⚠️ Caution',
    },
    red: {
      style: 'bg-red-500/10 text-red-400 border-red-500/20',
      label: '🚨 High Risk',
    },
    unknown: {
      style: 'bg-gray-800 text-gray-500 border-gray-700',
      label: '—',
    },
  };

  const key = (risk || 'unknown').toLowerCase();
  const { style, label } = config[key] || config.unknown;

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest ${style}`}>
      {label}
    </span>
  );
};

export default RiskBadge;
