import React from 'react';

// Signals pulled from what the athlete wrote in their check-in note.
// Coach-facing only — athletes are never shown that their words are read,
// or they stop writing honestly.
export default function CheckinSignals({ analysis }) {
  if (!analysis) return null;

  const pills = [];
  if (analysis.injury_flag) {
    pills.push({ key: 'injury', text: `🚩 ${analysis.injury_detail}`,
      cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' });
  }
  if (analysis.mental_load_flag) {
    pills.push({ key: 'mental', text: `😟 ${analysis.mental_load_detail}`,
      cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' });
  }
  if (analysis.mismatch) {
    pills.push({ key: 'mismatch', text: `⚠️ ${analysis.mismatch_detail}`,
      cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' });
  }
  if (analysis.sentiment === 'negative' && !analysis.injury_flag && !analysis.mental_load_flag) {
    pills.push({ key: 'sentiment', text: 'Negative tone',
      cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' });
  }
  if (analysis.motivation === 'low') {
    pills.push({ key: 'motivation', text: 'Low motivation',
      cls: 'text-gray-400 bg-gray-900 border-gray-700' });
  }

  if (pills.length === 0) return null;

  return (
    <div className="bg-gray-900/60 rounded-xl px-4 py-3 mb-4 border border-gray-700/50">
      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">
        From their note
      </p>
      <div className="flex flex-wrap gap-2">
        {pills.map(p => (
          <span key={p.key} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${p.cls}`}>
            {p.text}
          </span>
        ))}
      </div>
      {analysis.summary && (
        <p className="text-gray-400 text-xs mt-2 leading-relaxed">{analysis.summary}</p>
      )}
    </div>
  );
}
