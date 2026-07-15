import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import { isTrialActive } from '../utils/trialUtils';


const getAcademyId = () => localStorage.getItem('academyId') || '';

// Injected once — styles the native range input (flat filled track, clean thumb).
const SLIDER_CSS = `
  .aiq-slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 6px; border-radius: 9999px;
    cursor: pointer; outline: none;
  }
  .aiq-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--c); border: 2px solid #0f1523;
    transition: transform .12s ease;
  }
  .aiq-slider::-webkit-slider-thumb:active { transform: scale(1.12); }
  .aiq-slider::-moz-range-thumb {
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--c); border: 2px solid #0f1523;
  }
`;

const SliderField = ({ label, name, value, onChange, color, trackColor }) => {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div className="bg-gray-800/50 rounded-2xl p-4 sm:p-5 border border-gray-700/60 hover:border-gray-600/80 transition-colors">
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-400 text-xs font-black uppercase tracking-widest truncate">{label}</p>
        <span className={`text-2xl font-black leading-none ${color}`}>{value}<span className="text-gray-600 text-sm font-bold">/10</span></span>
      </div>
      <input type="range" name={name} min="1" max="10" value={value} onChange={onChange}
        className="aiq-slider"
        style={{ '--c': trackColor, background: `linear-gradient(to right, ${trackColor} ${pct}%, #1f2937 ${pct}%)` }}
      />
      <div className="flex justify-between text-[10px] font-bold text-gray-600 mt-2.5 uppercase tracking-widest">
        <span>Low</span><span>High</span>
      </div>
    </div>
  );
};

const metrics = [
  { label: 'Energy', key: 'energy', color: 'text-blue-400', track: '#3b82f6' },
  { label: 'Sleep', key: 'sleep', color: 'text-purple-400', track: '#a855f7' },
  { label: 'Soreness', key: 'soreness', color: 'text-red-400', track: '#ef4444' },
  { label: 'Mood', key: 'mood', color: 'text-yellow-400', track: '#eab308' },
];

function AthleteCheckIn() {
  const navigate = useNavigate();
  const athleteName = (localStorage.getItem('athleteName') || '').trim();
  const athleteSport = localStorage.getItem('athleteSport') || '';
  const academyId = getAcademyId();

  const [form, setForm] = useState({ energy: 5, sleep: 5, soreness: 5, mood: 5, notes: '' });
  const [checkInError, setCheckInError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [yesterdayData, setYesterdayData] = useState(null);
  const [todayData, setTodayData] = useState(null);
  const [aiMessage, setAiMessage] = useState('');

  useEffect(() => {
    if (!athleteName) { navigate('/login'); return; }
    const fetchYesterday = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/wellness/history/${encodeURIComponent(athleteName)}`,
          { params: { academy_id: academyId, days: 30 } }
        );
        const history = res.data.history || [];
        if (history.length > 0) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const previous = history.filter(h => h.created_at.slice(0, 10) !== todayStr);
          setYesterdayData(previous[0] || null);
        }
      } catch {
        // no previous data — fine
      }
    };
    fetchYesterday();
  }, [athleteName, navigate, academyId]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    if (!isTrialActive()) {
      setCheckInError('Your 14-day free trial has expired. Contact us to upgrade.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(
        `${API_BASE_URL}/wellness?academy_id=${academyId}`,
        {
          athlete_name: athleteName,
          energy: parseInt(form.energy),
          sleep: parseInt(form.sleep),
          soreness: parseInt(form.soreness),
          mood: parseInt(form.mood),
          notes: form.notes,
        }
      );

      try {
        const aiRes = await axios.get(
          `${API_BASE_URL}/ai/insights/${encodeURIComponent(athleteName)}`,
          { params: { academy_id: academyId } }
        );
        setAiMessage(aiRes.data.athlete_message || '');
      } catch {
        setAiMessage('');
      }

      setTodayData({
        energy: parseInt(form.energy),
        sleep: parseInt(form.sleep),
        soreness: parseInt(form.soreness),
        mood: parseInt(form.mood),
      });
      setShowComparison(true);
      setTimeout(() => navigate('/athlete-dashboard'), 4000);
    } catch (err) {
      console.error('Error submitting wellness:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('role');
    localStorage.removeItem('athleteName');
    localStorage.removeItem('athleteSport');
    navigate('/login');
  };

  const getDiff = (today, yesterday) => {
    if (yesterday == null) return null;
    const diff = today - yesterday;
    if (diff > 0) return { label: `+${diff}`, color: 'text-green-400' };
    if (diff < 0) return { label: `${diff}`, color: 'text-red-400' };
    return { label: '0', color: 'text-gray-500' };
  };

  if (showComparison && todayData) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-3xl font-black text-white">Submitted!</h2>
            <p className="text-gray-500 text-sm mt-1">
              Hey {athleteName.split(' ')[0]}, here's how today compares to yesterday
            </p>
          </div>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-4">
            <div className="grid grid-cols-3 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
              <span className="text-left">Metric</span>
              <span className="text-center">Today</span>
              <span className="text-right">Change</span>
            </div>
            <div className="space-y-4">
              {metrics.map(m => {
                const diff = getDiff(todayData[m.key], yesterdayData?.[m.key]);
                return (
                  <div key={m.key} className="grid grid-cols-3 items-center">
                    <span className="text-gray-400 text-xs font-bold text-left">{m.label}</span>
                    <span className={`text-2xl font-black text-center ${m.color}`}>{todayData[m.key]}</span>
                    <span className={`text-xs font-bold text-right ${diff?.color || 'text-gray-600'}`}>
                      {yesterdayData ? (diff?.label || '—') : 'First Sync'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {aiMessage && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-6">
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-2">🤖 AI Coach Wisdom</p>
              <p className="text-gray-200 text-sm italic">"{aiMessage}"</p>
            </div>
          )}
          <p className="text-gray-600 text-[10px] text-center uppercase font-bold tracking-widest animate-pulse">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-10">
      <style>{SLIDER_CSS}</style>

      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full mb-2.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                Daily Check-in
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
                How are you <span className="text-blue-400">feeling</span>?
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                Hey {athleteName.split(' ')[0]}
                {athleteSport && <span className="text-gray-600 font-bold uppercase tracking-widest text-[10px] ml-2 align-middle">· {athleteSport}</span>}
              </p>
            </div>
            {/* Logout always visible */}
            <button onClick={handleLogout}
              className="border border-gray-700 text-gray-500 px-3 py-2 rounded-xl text-xs hover:border-red-500 hover:text-red-400 font-bold transition shrink-0">
              Logout
            </button>
          </div>

          {/* Nav buttons — full width row on mobile */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            <button onClick={() => navigate('/vitals')}
              className="border border-rose-500/30 text-rose-400 py-2.5 rounded-xl text-xs hover:bg-rose-500/10 font-bold transition text-center">
              Vitals Scan
            </button>
            <button onClick={() => navigate('/athlete-dashboard')}
              className="border border-gray-700 text-gray-500 py-2.5 rounded-xl text-xs hover:border-blue-500 hover:text-blue-400 font-bold transition text-center">
              Dashboard
            </button>
            <button onClick={() => navigate('/meditation')}
              className="border border-gray-700 text-gray-500 py-2.5 rounded-xl text-xs hover:border-indigo-500 hover:text-indigo-400 font-bold transition text-center">
              Meditate
            </button>
          </div>
        </div>

        {/* Sliders — 2-col on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {metrics.map(m => (
            <SliderField key={m.key} label={`${m.label} Level`} name={m.key}
              value={form[m.key]} onChange={handleChange} color={m.color} trackColor={m.track} />
          ))}
        </div>

        {/* Notes */}
        <div className="bg-gray-800/60 rounded-2xl p-4 sm:p-5 border border-gray-700/70 mb-6">
          <label className="block text-gray-300 text-xs font-black uppercase tracking-widest mb-3">
            Anything else? <span className="text-gray-600">(Optional)</span>
          </label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows="3"
            placeholder="Injuries, concerns, or comments..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition resize-none text-sm"
          />
        </div>

        {/* Submit */}
        {checkInError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm font-bold">⚠️ {checkInError}</p>
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-4 rounded-xl font-black text-lg transition active:scale-[0.98] flex items-center justify-center gap-2">
          {loading
            ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
            : 'Confirm Check-in ✓'}
        </button>
      </div>
    </div>
  );
}

export default AthleteCheckIn;
