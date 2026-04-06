import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import logo from '../assets/athleteiq_logo.svg';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const getAcademyId = () => localStorage.getItem('academyId') || '';

const ALL_EXERCISES = [
  {
    id: 'box', name: 'Box Breathing', tag: 'FOCUS', emoji: '⬛', accentColor: '#6366f1', duration: '~5 min',
    why: 'Used by Navy SEALs — calms the nervous system and restores mental sharpness before performance.',
    when: 'energy is low or before a big session',
  },
  {
    id: '478', name: '4-7-8 Breathing', tag: 'CALM', emoji: '🌙', accentColor: '#8b5cf6', duration: '~4 min',
    why: "Dr. Andrew Weil's technique — reduces anxiety and helps the body wind down for better sleep.",
    when: 'sleep quality is poor or mood is anxious',
  },
  {
    id: 'sigh', name: 'Physiological Sigh', tag: 'RESET', emoji: '💨', accentColor: '#06b6d4', duration: '~2 min',
    why: 'Stanford research — the fastest known method to reduce acute stress in real time.',
    when: 'stress or soreness is high and a quick reset is needed',
  },
  {
    id: 'bodyscan', name: 'Body Scan', tag: 'RELEASE', emoji: '🧘', accentColor: '#10b981', duration: '~10 min',
    why: 'Sports psychology technique — releases physical tension held in muscles before or after training.',
    when: 'soreness is high or the body feels tight',
  },
  {
    id: 'visualise', name: 'Pre-Competition Visualisation', tag: 'PERFORM', emoji: '🏆', accentColor: '#f59e0b', duration: '~12 min',
    why: 'Used by Olympic athletes — mentally rehearsing perfect execution boosts confidence and readiness.',
    when: 'mood is low or a competition is approaching',
  },
];

function getSuggestedExercises(latest) {
  if (!latest) return ALL_EXERCISES.slice(0, 2);
  const { mood = 5, energy = 5, sleep = 5, soreness = 5 } = latest;
  const scores = ALL_EXERCISES.map(ex => {
    let score = 0;
    if (ex.id === 'box') score += (10 - energy) * 1.5 + (10 - mood) * 0.5;
    if (ex.id === '478') score += (10 - sleep) * 2.0 + (10 - mood) * 0.5;
    if (ex.id === 'sigh') score += soreness * 1.0 + (10 - mood) * 0.5;
    if (ex.id === 'bodyscan') score += soreness * 1.5 + (10 - energy) * 0.5;
    if (ex.id === 'visualise') score += (10 - mood) * 1.5 + (10 - energy) * 0.5;
    return { ex, score };
  });
  return scores.sort((a, b) => b.score - a.score).slice(0, 2).map(s => s.ex);
}

function MentalRechargeCard({ latest, navigate }) {
  const [expanded, setExpanded] = useState(false);
  const suggestions = getSuggestedExercises(latest);

  return (
    <div className="bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-700 mb-5">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">🧠 Mind & Mental Recharge</p>
          <p className="text-gray-500 text-xs mt-1">Guided exercises to suggest tonight</p>
        </div>
        {!latest && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600 bg-gray-700/50 px-2 py-1 rounded-lg border border-gray-600/30">
            Showing defaults
          </span>
        )}
      </div>

      {latest && (
        <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-[11px] text-indigo-300 leading-relaxed">
            Based on today's check-in — mood <span className="font-black text-white">{latest.mood}/10</span>,
            sleep <span className="font-black text-white">{latest.sleep}/10</span>,
            soreness <span className="font-black text-white">{latest.soreness}/10</span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-3">
        {suggestions.map((ex) => (
          <div key={ex.id} className="bg-gray-700/40 rounded-xl p-4 border border-gray-600/30">
            <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl">{ex.emoji}</span>
                <p className="font-black text-sm text-white">{ex.name}</p>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: `${ex.accentColor}20`, color: ex.accentColor }}>
                  {ex.tag}
                </span>
              </div>
              <span className="bg-gray-600 text-gray-300 border border-gray-500/30 px-2 py-0.5 rounded-lg text-xs font-bold shrink-0">
                ⏱ {ex.duration}
              </span>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed mb-2">{ex.why}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ex.accentColor }}>
              Best when: <span className="normal-case font-normal text-gray-400">{ex.when}</span>
            </p>
          </div>
        ))}
      </div>

      <button onClick={() => setExpanded(e => !e)}
        className="w-full text-center text-xs font-bold uppercase tracking-widest text-gray-600 hover:text-gray-400 transition py-1">
        {expanded ? '▲ Show fewer' : `▼ View all ${ALL_EXERCISES.length} exercises`}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 mt-3">
          {ALL_EXERCISES.filter(ex => !suggestions.find(s => s.id === ex.id)).map(ex => (
            <div key={ex.id} className="flex items-center gap-3 bg-gray-700/20 rounded-xl px-4 py-3 border border-gray-600/20">
              <span className="text-lg">{ex.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black text-gray-300">{ex.name}</p>
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${ex.accentColor}15`, color: ex.accentColor }}>
                    {ex.tag}
                  </span>
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5">{ex.when}</p>
              </div>
              <span className="text-[10px] text-gray-600 font-bold shrink-0">{ex.duration}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-700">
        <p className="text-[10px] text-gray-600 text-center leading-relaxed mb-3">
          Ask your child to try one of these before bed or before tomorrow's session.
        </p>
        <button onClick={() => navigate('/meditation')}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition">
          🧘 Open Meditation & Breathing →
        </button>
      </div>
    </div>
  );
}

function ParentView() {
  const [history, setHistory] = useState([]);
  const [insight, setInsight] = useState(null);
  const [recovery, setRecovery] = useState(() => {
    const cached = sessionStorage.getItem(`parent_recovery_${localStorage.getItem('parentChildName') || ''}`);
    return cached ? JSON.parse(cached) : null;
  });
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [injuries, setInjuries] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();
  const childName = localStorage.getItem('parentChildName') || '';
  const academyId = getAcademyId();

  const fetchRecovery = async () => {
    setRecoveryLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/ai/parent-recovery/${encodeURIComponent(childName)}`,
        { params: { academy_id: academyId } }
      );
      setRecovery(res.data);
      sessionStorage.setItem(`parent_recovery_${childName}`, JSON.stringify(res.data));
    } catch {
      setRecovery(null);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = { academy_id: academyId };
      const [historyRes, insightRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/wellness/history/${encodeURIComponent(childName)}`, { params }),
        axios.get(`${API_BASE_URL}/ai/insights/${encodeURIComponent(childName)}`, { params }),
      ]);

      const raw = historyRes.data.history.reverse();
      if (raw.length === 0) {
        setHistory([]);
        setInsight(insightRes.data);
        setNotFound(false);
        setLoading(false);
        return;
      }

      const formatted = raw.map((c, i) => ({
        day: `Day ${i + 1}`,
        date: new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        energy: c.energy, sleep: c.sleep, soreness: c.soreness, mood: c.mood,
        notes: c.notes || '',
      }));
      setHistory(formatted);
      setInsight(insightRes.data);

      try {
        const injuryRes = await axios.get(
          `${API_BASE_URL}/injuries/${encodeURIComponent(childName)}`,
          { params: { academy_id: academyId } }
        );
        const activeInjuries = (injuryRes.data || []).filter(
          i => i.status === 'active' || i.status === 'recovering'
        );
        setInjuries(activeInjuries);
      } catch {
        setInjuries([]);
      }

      setNotFound(false);
    } catch {
      if (!isSilent) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [childName, academyId]);

  useEffect(() => {
    if (!childName) { navigate('/'); return; }
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [childName, navigate, fetchData]);

  const handleLogout = () => {
    localStorage.removeItem('role');
    localStorage.removeItem('parentChildName');
    navigate('/login');
  };

  if (loading && history.length === 0) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Loading child's progress...</p>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-white text-2xl font-black mb-2">Athlete Not Found</h2>
        <p className="text-gray-400 text-sm mb-6">
          No records found for <span className="text-white font-bold">"{childName}"</span>.
        </p>
        <button onClick={handleLogout} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition">
          Try Again
        </button>
      </div>
    </div>
  );

  const latest = history[history.length - 1];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 md:mb-10">
          <div>
            <img src={logo} alt="AthleteIQ" className="h-10 w-auto mb-2 cursor-pointer" onClick={() => navigate('/')} />
            <p className="text-gray-400 text-xs mt-1">Parent View · Live Updates</p>
          </div>
          <button onClick={handleLogout}
            className="border border-gray-600 text-gray-400 px-3 py-2 rounded-xl text-xs hover:border-red-500 hover:text-red-400 transition">
            Logout
          </button>
        </div>

        {/* Child header card */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 sm:p-5 mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
            <div>
              <p className="text-purple-400 text-xs uppercase tracking-widest font-bold mb-1">Viewing Progress For</p>
              <h2 className="text-2xl sm:text-3xl font-black text-white">{childName}</h2>
            </div>
            <div className="flex items-center gap-3">
              {insight?.score != null && (
                <div className="text-center bg-gray-800 rounded-2xl px-4 py-2 border border-gray-700">
                  <p className="text-3xl sm:text-4xl font-black text-white">{insight.score}</p>
                  <p className="text-gray-500 text-xs mt-1">Readiness</p>
                </div>
              )}
              <RiskBadge risk={insight?.risk} />
            </div>
          </div>
        </div>

        {/* AI message */}
        {insight?.athlete_message && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 sm:p-5 mb-5">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">
              🤖 Coach Message for {childName}
            </p>
            <p className="text-gray-200 text-sm leading-relaxed">{insight.athlete_message}</p>
          </div>
        )}

        {injuries.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 sm:p-5 mb-5">
            <p className="text-rose-400 text-xs font-bold uppercase tracking-widest mb-3">
              🩹 Active Injuries — {childName}
            </p>
            <div className="space-y-2">
              {injuries.map(inj => (
                <div key={inj.id} className="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-3 gap-3 flex-wrap">
                  <div>
                    <p className="text-white font-black text-sm">{inj.body_part} — {inj.injury_type}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Logged {inj.date_occurred}
                      {inj.notes ? ` · ${inj.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`text-xs font-black px-2 py-1 rounded-full border ${
                      inj.severity === 'severe' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                      inj.severity === 'moderate' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                      'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    }`}>
                      {inj.severity.toUpperCase()}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                      inj.status === 'active' ? 'text-rose-400 bg-rose-500/10' : 'text-amber-400 bg-amber-500/10'
                    }`}>
                      {inj.status.charAt(0).toUpperCase() + inj.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Home Recovery */}
        <div className="bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-700 mb-5">
          <div className="flex justify-between items-start mb-3 gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">🏠 Home Recovery Advice</p>
              <p className="text-gray-500 text-xs mt-1">Steps to help your child recover at home</p>
            </div>
            <button onClick={fetchRecovery} disabled={recoveryLoading || history.length === 0}
              className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shrink-0">
              {recoveryLoading ? '⏳ Loading...' : recovery ? '🔄 Refresh' : '✨ Get Advice'}
            </button>
          </div>

          {recoveryLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-700/40 rounded-xl border border-gray-600/30 animate-pulse" />
              ))}
            </div>
          ) : recovery ? (
            <div className="space-y-4">
              {recovery.coach_message && (
                <div className={`rounded-xl p-4 border mt-2 ${recovery.risk_level === 'red' ? 'bg-red-500/10 border-red-500/20'
                  : recovery.risk_level === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/20'
                    : 'bg-green-500/10 border-green-500/20'}`}>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${recovery.risk_level === 'red' ? 'text-red-400'
                    : recovery.risk_level === 'yellow' ? 'text-yellow-400' : 'text-green-400'}`}>
                    Coach's Message to Parents
                  </p>
                  <p className="text-gray-200 text-sm leading-relaxed">{recovery.coach_message}</p>
                </div>
              )}
              {recovery.exercises?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {recovery.exercises.map((ex, i) => (
                    <div key={i} className="bg-gray-700/40 rounded-xl p-4 border border-gray-600/30">
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🧘</span>
                          <p className="font-black text-sm text-green-400">{ex.name}</p>
                        </div>
                        <span className="bg-gray-600 text-gray-300 border border-gray-500/30 px-2 py-0.5 rounded-lg text-xs font-bold">
                          ⏱ {ex.duration}
                        </span>
                      </div>
                      {ex.how && <p className="text-gray-300 text-sm mb-2"><span className="text-gray-500 font-bold">How: </span>{ex.how}</p>}
                      {ex.why && <p className="text-gray-400 text-xs leading-relaxed border-t border-white/5 pt-2">💡 {ex.why}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Everything looks good! No home recovery needed today.</p>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-xs">
              {history.length === 0 ? 'Check back after their first check-in.' : 'Click "Get Advice" above to see recovery steps.'}
            </p>
          )}
        </div>

        {/* Mental Recharge */}
        <MentalRechargeCard latest={latest} navigate={navigate} />

        {/* Latest activity — 2 cols on mobile, 4 on sm+ */}
        {latest && (
          <div className="bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-700 mb-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-4">Latest Activity</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Energy', value: latest.energy, color: 'text-blue-400' },
                { label: 'Sleep', value: latest.sleep, color: 'text-purple-400' },
                { label: 'Soreness', value: latest.soreness, color: 'text-red-400' },
                { label: 'Mood', value: latest.mood, color: 'text-yellow-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center bg-gray-700/50 rounded-xl p-3">
                  <p className={`text-2xl sm:text-3xl font-black ${color}`}>{value}</p>
                  <p className="text-gray-500 text-xs mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wellness chart */}
        {history.length > 0 && (
          <div className="bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-700 mb-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-5">Wellness Progress</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
                <YAxis domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={{ stroke: '#374151' }} width={20} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '11px' }} />
                <Line type="monotone" dataKey="energy" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="Energy" />
                <Line type="monotone" dataKey="sleep" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} name="Sleep" />
                <Line type="monotone" dataKey="soreness" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} name="Soreness" />
                <Line type="monotone" dataKey="mood" stroke="#eab308" strokeWidth={2} dot={{ r: 2 }} name="Mood" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History log */}
        <div className="bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-5">History</h2>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">No history recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {[...history].reverse().map((entry, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="text-gray-500 text-xs w-10 pt-2 shrink-0">{entry.date}</div>
                  <div className="flex-1 bg-gray-700/50 rounded-xl p-3 sm:p-4 border border-gray-600/50">
                    {/* 2 cols on mobile, 4 on sm */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                      {['energy', 'sleep', 'soreness', 'mood'].map(key => (
                        <div key={key} className="text-center">
                          <p className={`font-black text-base sm:text-lg ${key === 'energy' ? 'text-blue-400'
                            : key === 'sleep' ? 'text-purple-400'
                              : key === 'soreness' ? 'text-red-400'
                                : 'text-yellow-400'}`}>{entry[key]}</p>
                          <p className="text-gray-500 text-[10px] uppercase">{key}</p>
                        </div>
                      ))}
                    </div>
                    {entry.notes && (
                      <p className="text-gray-400 text-xs border-t border-gray-600 pt-2 mt-1 italic">"{entry.notes}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default ParentView;
