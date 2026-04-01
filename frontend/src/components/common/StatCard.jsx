import React from 'react';

const StatCard = ({ label, value, color, sub, icon }) => (
  <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 hover:border-gray-600 transition-all">
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-black">{label}</p>
        {icon && <span className="text-lg opacity-40">{icon}</span>}
      </div>
      <p className={`text-4xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-[10px] uppercase font-bold mt-1 tracking-widest">{sub}</p>}
    </div>
  </div>
);

export default StatCard;
