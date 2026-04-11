import React, { useState } from 'react';

const StatCard = ({ label, value, color, sub, icon, subtitle, info }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 hover:border-gray-600 transition-all relative">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <p className="text-gray-500 text-[10px] uppercase tracking-widest font-black">{label}</p>
            {info && (
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="w-4 h-4 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white text-[9px] font-bold flex items-center justify-center transition-all"
              >
                i
              </button>
            )}
          </div>
          {icon && <span className="text-lg opacity-40">{icon}</span>}
        </div>
        <p className={`text-4xl font-black ${color}`}>{value}</p>
        {sub && <p className="text-gray-500 text-[10px] uppercase font-bold mt-1 tracking-widest">{sub}</p>}
        {subtitle && <p className="text-rose-400 text-[10px] font-bold mt-1 uppercase italic">{subtitle}</p>}
      </div>
      {showInfo && (
        <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-gray-900 border border-gray-600 rounded-xl p-3 shadow-xl">
          <p className="text-gray-300 text-xs leading-relaxed">{info}</p>
        </div>
      )}
    </div>
  );
};

export default StatCard;
