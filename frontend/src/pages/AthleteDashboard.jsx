import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { warmup } from '../api';
import StatCard from '../components/common/StatCard';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import logo from '../assets/athleteiq_logo.svg';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function AthleteDashboard() {
  const navigate = useNavigate();
  const athleteName = localStorage.getItem('athleteName') || '';
  const athleteSport = localStorage.getItem('athleteSport') || '';

  const [history, setHistory] = useState([]);
  const [insight, setInsight] = useState(null);
  const [injuryRisk, setInjuryRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [athleteProfile, setAthleteProfile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ age: '', parent_name: '', parent_phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [injuries, setInjuries] = useState([]);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const academyId = localStorage.getItem('academyId') || '';
      const [histRes, insRes, injRes] = await Promise.allSettled([
        api.get(`/wellness/history/${encodeURIComponent(athleteName)}`, { params: { academy_id: academyId } }),
        api.get(`/ai/insights/${encodeURIComponent(athleteName)}`, { params: { academy_id: academyId } }),
        api.get(`/ai/injury-risk/${encodeURIComponent(athleteName)}`, { params: { academy_id: academyId } }),
      ]);

      if (histRes.status === 'fulfilled' && histRes.value.data.history) {
        const formatted = histRes.value.data.history.slice().reverse().map((c, i) => ({
          day: `Day ${i + 1}`,
          date: new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          energy: c.energy,
          sleep: c.sleep,
          soreness: c.soreness,
          mood: c.mood,
        }));
        setHistory(formatted);
      }
      if (insRes.status === 'fulfilled') setInsight(insRes.value.data);
      if (injRes.status === 'fulfilled') setInjuryRisk(injRes.value.data);

      try {
        const profileRes = await api.get(`/athletes`, { params: { academy_id: academyId } });
        const found = profileRes.data.find(a => a.name.toLowerCase() === athleteName.toLowerCase());
        if (found) {
          setAthleteProfile(found);
          if (!found.parent_phone) setShowProfileForm(true);
        }
      } catch { }

      try {
        const injuriesRes = await api.get(
          `/injuries/${encodeURIComponent(athleteName)}`,
          { params: { academy_id: academyId } }
        );
        setInjuries(injuriesRes.data || []);
      } catch { setInjuries([]); }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally { setLoading(false); }
  }, [athleteName]);

  useEffect(() => {
    if (!athleteName) { navigate('/login'); return; }
    fetchData();
    const iv = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(iv);
  }, [athleteName, navigate, fetchData]);

  const handleLogout = () => {
    ['role', 'athleteName', 'athleteSport'].forEach(k => localStorage.removeItem(k));
    navigate('/login');
  };

  const handleSaveProfile = async () => {
    if (!profileForm.parent_phone.trim()) return;
    setSavingProfile(true);
    try {
      const academyId = localStorage.getItem('academyId') || '';
      await api.patch(
        `/athletes/${athleteProfile.id}?academy_id=${academyId}`,
        {
          age: profileForm.age ? parseInt(profileForm.age) : athleteProfile.age,
          parent_name: profileForm.parent_name.trim(),
          parent_phone: profileForm.parent_phone.trim()
        }
      );
      setShowProfileForm(false);
      fetchData(true);
    } catch (err) { console.error(err); }
    finally { setSavingProfile(false); }
  };

  const avgOf = (key) => {
    if (!history.length) return '—';
    const vals = history.map(h => h[key]).filter(v => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
  };

  const avgReadiness = insight?.score ?? null;
  const acwrVal = injuryRisk?.acwr ?? null;
  const injuryRiskScore = injuryRisk?.injury_risk_score ?? null;
  const injuryRiskLevel = injuryRisk?.risk_level ?? null;

  const chartData = history.map(h => ({
    ...h,
    readiness: parseFloat(((h.energy + h.sleep + (10 - h.soreness) + h.mood) / 4).toFixed(1)),
  }));

  if (loading && !history.length) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <LoadingSkeleton type="profile" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <img
              src={logo}
              alt="AthleteIQ"
              className="h-8 w-auto opacity-80 cursor-pointer"
              onClick={() => navigate('/athlete-dashboard')}
            />
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight">
                Hey {athleteName.split(' ')[0]}
              </h1>
              <p className="text-gray-500 font-bold uppercase text-[10px] md:text-xs mt-1 tracking-widest">
                {athleteSport || 'Elite Squad'} · My Wellness Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {insight && <RiskBadge risk={insight.risk} />}
            <button
              onClick={() => navigate('/checkin')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
            >
              + Check-in
            </button>
            <button
              onClick={() => navigate('/meditation')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
            >
              🧘 Meditate
            </button>
            <button
              onClick={() => setShowProfile(true)}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition border border-gray-700"
            >
              👤 Profile
            </button>
            <button
              onClick={handleLogout}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-rose-400 px-4 py-2 rounded-xl text-xs font-bold transition border border-gray-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Avg Readiness"
            value={avgReadiness != null ? `${avgReadiness}/100` : '—'}
            color="text-emerald-400"
          />
          <StatCard
            label="Injury Risk"
            value={injuryRiskScore != null ? `${injuryRiskScore}/100` : '—'}
            color={injuryRiskLevel === 'red' ? 'text-rose-400' : injuryRiskLevel === 'yellow' ? 'text-amber-400' : 'text-emerald-400'}
          />
          <StatCard
            label="ACWR"
            value={acwrVal && acwrVal > 0 ? Number(acwrVal).toFixed(2) : '—'}
            color="text-blue-400"
            subtitle={!acwrVal || acwrVal === 0 ? '7+ days needed' : null}
            info="Acute:Chronic Workload Ratio — compares your last 7 days of training load to your 28-day average to flag injury risk from sudden spikes."
          />
          <StatCard
            label="Active Days"
            value={history.length}
            color="text-white"
          />
        </div>

        {/* Profile completion banner */}
        {showProfileForm && (
          <div className="bg-gray-800 rounded-2xl p-6 border border-indigo-500/30 mb-8">
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-1">Complete Your Profile</p>
            <p className="text-gray-400 text-sm mb-4">Add parent details so your coach can reach them.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              {[
                { key: 'age', type: 'number', placeholder: 'Your age' },
                { key: 'parent_name', type: 'text', placeholder: "Parent's name" },
                { key: 'parent_phone', type: 'tel', placeholder: 'Parent phone (10 digits)' },
              ].map(f => (
                <input
                  key={f.key}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={profileForm[f.key]}
                  onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-sm"
                />
              ))}
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile || !profileForm.parent_phone.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2.5 rounded-xl font-bold text-sm transition"
            >
              {savingProfile ? 'Saving...' : 'Save Profile →'}
            </button>
          </div>
        )}

        {/* Empty state */}
        {history.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
            <h2 className="text-3xl font-black tracking-tight text-white mb-2">Ready to start?</h2>
            <p className="text-gray-400 mb-8 text-sm">Submit your first daily check-in to see your performance metrics.</p>
            <button
              onClick={() => navigate('/checkin')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold text-sm transition"
            >
              Launch Check-in →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              {/* Readiness hero card */}
              {insight?.score != null && (
                <div className={`bg-gray-800 rounded-2xl p-6 border ${insight.risk === 'red' ? 'border-rose-500/30' : insight.risk === 'yellow' ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
                  <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div className="flex items-center gap-6">
                      <div className="relative w-24 h-24 shrink-0">
                        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="#374151" strokeWidth="6" />
                          <circle
                            cx="40" cy="40" r="34" fill="none"
                            stroke={insight.risk === 'red' ? '#f43f5e' : insight.risk === 'yellow' ? '#f59e0b' : '#10b981'}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 34}`}
                            strokeDashoffset={`${2 * Math.PI * 34 * (1 - insight.score / 100)}`}
                            style={{ transition: 'stroke-dashoffset 1s ease' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="font-black text-2xl leading-none text-white">{insight.score}</span>
                          <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mt-0.5">Ready</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">Today's Status</p>
                        <RiskBadge risk={insight.risk} />
                        {injuryRisk?.metrics?.risk_tier && (
                          <p className="text-gray-500 text-xs mt-2">
                            Workload: {injuryRisk.metrics.risk_tier} · ACWR {injuryRisk.acwr}
                          </p>
                        )}
                      </div>
                    </div>
                    {insight?.athlete_message && insight.athlete_message !== 'No data yet' && (
                      <div className="flex-1 min-w-0 bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-700 max-w-md">
                        <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-1">🤖 Coach Says</p>
                        <p className="text-gray-300 text-sm leading-relaxed italic">"{insight.athlete_message}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recovery Insight + Injury Prediction */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                  <p className="text-blue-400 text-[10px] font-black uppercase mb-3 tracking-widest">🤖 Recovery Insight</p>
                  {insight?.insight && insight.insight !== 'No data yet' ? (
                    <p className="text-gray-200 text-sm leading-relaxed italic">"{insight.insight}"</p>
                  ) : (
                    <p className="text-gray-500 text-sm italic">Gathering wellness patterns...</p>
                  )}
                </div>
                <div className={`bg-gray-800 rounded-2xl p-6 border ${injuryRiskLevel === 'red' ? 'border-rose-500/30' : 'border-gray-700'}`}>
                  <p className="text-gray-500 text-[10px] font-black uppercase mb-3 tracking-widest">🛡️ Injury Prediction</p>
                  {injuryRisk ? (
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <p className={`text-2xl font-black ${injuryRiskLevel === 'red' ? 'text-rose-400' : injuryRiskLevel === 'yellow' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {injuryRiskLevel ? injuryRiskLevel.toUpperCase() : '—'}
                        </p>
                        {injuryRiskScore != null && (
                          <p className="text-gray-500 text-[10px] font-bold">SCORE: {injuryRiskScore}/100</p>
                        )}
                      </div>
                      {injuryRiskScore != null && (
                        <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${injuryRiskLevel === 'red' ? 'bg-rose-500' : injuryRiskLevel === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${injuryRiskScore}%` }}
                          />
                        </div>
                      )}
                      {injuryRisk.verdict && (
                        <p className="text-gray-400 text-xs mt-4 leading-relaxed">{injuryRisk.verdict}</p>
                      )}
                      {injuryRisk.deception_flag && (
                        <span className="inline-block mt-3 text-orange-400 font-bold text-[10px] bg-orange-400/10 px-2 py-0.5 rounded border border-orange-400/20">
                          ⚠️ Deception Warning
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">Analyzing training load...</p>
                  )}
                </div>
              </div>

              {/* Weekly Trend chart */}
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6">Weekly Trend</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData.slice(-7)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900, paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="energy" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="Energy" />
                    <Line type="monotone" dataKey="sleep" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} name="Sleep" />
                    <Line type="monotone" dataKey="soreness" stroke="#f43f5e" strokeWidth={2} dot={{ r: 2 }} name="Soreness" />
                    <Line type="monotone" dataKey="mood" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="Mood" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">

              {/* Avg metric cards */}
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">7-Day Averages</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Energy', val: avgOf('energy'), color: 'text-blue-400' },
                    { label: 'Sleep', val: avgOf('sleep'), color: 'text-indigo-400' },
                    { label: 'Soreness', val: avgOf('soreness'), color: 'text-rose-400' },
                    { label: 'Mood', val: avgOf('mood'), color: 'text-amber-400' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{m.label}</p>
                      <p className={`text-2xl font-black ${m.color}`}>{m.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent check-ins */}
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Recent Check-ins</h2>
                <div className="space-y-3">
                  {[...history].reverse().slice(0, 5).map((entry, i) => (
                    <div key={i} className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">{entry.date}</p>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { v: entry.energy, c: 'text-blue-400', l: 'EN' },
                          { v: entry.sleep, c: 'text-indigo-400', l: 'SL' },
                          { v: entry.soreness, c: 'text-rose-400', l: 'SO' },
                          { v: entry.mood, c: 'text-amber-400', l: 'MO' },
                        ].map(x => (
                          <div key={x.l}>
                            <p className={`font-black text-base ${x.c}`}>{x.v}</p>
                            <p className="text-[9px] text-gray-600 font-bold">{x.l}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Injuries */}
              {injuries.length > 0 && (
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">🩹 Injury History</h2>
                  <div className="space-y-3">
                    {injuries.map(inj => (
                      <div key={inj.id} className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-white font-black text-sm">{inj.body_part}</p>
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{inj.injury_type}</p>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${inj.severity === 'severe' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                            inj.severity === 'moderate' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                              'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            }`}>{inj.severity.toUpperCase()}</span>
                        </div>
                        <p className="text-gray-600 text-[10px] font-bold">{inj.date_occurred}</p>
                        {inj.notes && <p className="text-gray-400 text-xs mt-1 italic">"{inj.notes}"</p>}
                        <div className="mt-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${inj.status === 'active' ? 'text-rose-400 bg-rose-500/10' :
                            inj.status === 'recovering' ? 'text-amber-400 bg-amber-500/10' :
                              'text-emerald-400 bg-emerald-500/10'
                            }`}>{inj.status.charAt(0).toUpperCase() + inj.status.slice(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile modal */}
      {showProfile && athleteProfile && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl font-black tracking-tight text-white">My Profile</h3>
              <button onClick={() => setShowProfile(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Name', value: athleteProfile.name },
                { label: 'Sport', value: athleteProfile.sport || '—' },
                { label: 'Age', value: athleteProfile.age || '—' },
                { label: "Parent's Name", value: athleteProfile.parent_name || '—' },
                { label: "Parent's Phone", value: athleteProfile.parent_phone || '—' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-700/50">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{item.label}</p>
                  <p className="text-white text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setShowProfile(false); setShowProfileForm(true); }}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-bold transition"
            >
              Edit Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
