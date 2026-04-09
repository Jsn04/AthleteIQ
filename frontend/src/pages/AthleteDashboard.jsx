import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import logo from '../assets/athleteiq_logo.svg';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

const Glass = ({ children, className = '', style = {} }) => (
  <div
    className={`rounded-2xl border backdrop-blur-sm ${className}`}
    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', ...style }}
  >
    {children}
  </div>
);

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
      const [histRes, insRes, injRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/wellness/history/${encodeURIComponent(athleteName)}`, { params: { academy_id: academyId } }),
        axios.get(`${API_BASE_URL}/ai/insights/${encodeURIComponent(athleteName)}`, { params: { academy_id: academyId } }),
        axios.get(`${API_BASE_URL}/ai/injury-risk/${encodeURIComponent(athleteName)}`, { params: { academy_id: academyId } }),
      ]);

      const formatted = histRes.data.history.slice().reverse().map((c, i) => ({
        day: `Day ${i + 1}`,
        date: new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        energy: c.energy,
        sleep: c.sleep,
        soreness: c.soreness,
        mood: c.mood,
      }));

      setHistory(formatted);
      setInsight(insRes.data);
      setInjuryRisk(injRes.data);

      const profileRes = await axios.get(`${API_BASE_URL}/athletes`, { params: { academy_id: academyId } });
      const found = profileRes.data.find(a => a.name.toLowerCase() === athleteName.toLowerCase());
      if (found) {
        setAthleteProfile(found);
        if (!found.parent_phone) setShowProfileForm(true);
      }

      try {
        const injuriesRes = await axios.get(
          `${API_BASE_URL}/injuries/${encodeURIComponent(athleteName)}`,
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
      await axios.patch(
        `${API_BASE_URL}/athletes/${athleteProfile.id}?academy_id=${academyId}`,
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

  const riskColor = (risk) =>
    risk === 'red' ? '#f43f5e' : risk === 'yellow' ? '#f59e0b' : '#10b981';

  const avgReadiness = insight?.score ?? '—';
  const acwrVal = injuryRisk?.acwr ?? '—';
  const injuryRiskScore = injuryRisk?.injury_risk_score ?? null;
  const injuryRiskLevel = injuryRisk?.risk_level ?? null;

  const riskLevelColor = (level) => {
    if (!level) return '#10b981';
    if (level === 'red') return '#f43f5e';
    if (level === 'yellow') return '#f59e0b';
    return '#10b981';
  };

  if (loading && !history.length) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <LoadingSkeleton type="profile" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;600;700&display=swap');
        .display{font-family:'Bebas Neue',sans-serif}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .score-ring{animation:fadeUp .5s ease both}
        .card-hover{transition:border-color .2s,transform .2s}
        .card-hover:hover{border-color:rgba(99,102,241,0.25)!important;transform:translateY(-1px)}
      `}</style>

      <div className="fixed inset-0 pointer-events-none">
        <div style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%,rgba(99,102,241,0.08) 0%,transparent 60%)' }} className="absolute inset-0" />
        <div style={{ background: 'radial-gradient(ellipse 40% 30% at 90% 90%,rgba(16,185,129,0.05) 0%,transparent 60%)' }} className="absolute inset-0" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <img src={logo} alt="AthleteIQ" className="h-7 w-auto mb-3 opacity-80 cursor-pointer"
              onClick={() => navigate('/athlete-dashboard')} />
            <h1 className="display text-4xl md:text-5xl tracking-wider text-white leading-none">
              HEY {athleteName.split(' ')[0].toUpperCase()} 👋
            </h1>
            <p className="text-gray-500 text-[11px] mt-1.5 uppercase font-bold tracking-widest">
              {athleteSport || 'Elite Squad'} · My Wellness Portal
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/checkin')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition active:scale-95 shadow-lg shadow-emerald-900/40">
              + Check-in
            </button>
            <button onClick={() => navigate('/meditation')}
              className="border border-white/10 text-gray-400 px-3 py-2.5 rounded-xl font-bold text-xs hover:border-indigo-500/50 hover:text-indigo-400 transition flex items-center gap-1.5">
              🧘 <span>Meditate</span>
            </button>
            <button onClick={() => setShowProfile(true)}
              className="border border-white/10 text-gray-400 px-3 py-2.5 rounded-xl font-bold text-xs hover:border-blue-500/50 hover:text-blue-400 transition flex items-center gap-1.5">
              👤 <span>Profile</span>
            </button>
            <button onClick={handleLogout}
              className="border border-white/10 text-gray-500 px-3 py-2.5 rounded-xl font-bold text-xs hover:border-red-500/50 hover:text-red-400 transition flex items-center gap-1.5">
              🚪 <span>Logout</span>
            </button>
          </div>
        </div>

        {/* 3 Hero Stat Cards */}
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Glass className="p-4 text-center card-hover" style={{
              background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)',
            }}>
              <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-2">Avg Readiness</p>
              <p className="display text-4xl leading-none" style={{ color: riskColor(insight?.risk) }}>
                {avgReadiness !== '—' ? avgReadiness : '—'}
              </p>
              <p className="text-[9px] text-gray-600 mt-1 font-semibold">/100</p>
            </Glass>

            <Glass className="p-4 text-center card-hover" style={{
              background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)',
            }}>
              <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-2">Injury Risk</p>
              <p className="display text-4xl leading-none" style={{ color: riskLevelColor(injuryRiskLevel) }}>
                {injuryRiskScore != null ? injuryRiskScore : '—'}
              </p>
              <p className="text-[9px] text-gray-600 mt-1 font-semibold">
                {injuryRiskScore != null ? '/100' : 'No data'}
              </p>
            </Glass>

            <Glass className="p-4 text-center card-hover" style={{
              background: 'rgba(96,165,250,0.06)', borderColor: 'rgba(96,165,250,0.2)',
            }}>
              <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-2">ACWR</p>
              <p className="display text-4xl leading-none" style={{
                color: !acwrVal || acwrVal === '—' ? '#6b7280'
                  : acwrVal > 1.5 ? '#f43f5e'
                    : acwrVal > 1.3 ? '#f59e0b'
                      : '#60a5fa'
              }}>
                {acwrVal !== '—' ? Number(acwrVal).toFixed(2) : '—'}
              </p>
              <p className="text-[9px] text-gray-600 mt-1 font-semibold">Workload Ratio</p>
            </Glass>
          </div>
        )}

        {/* Profile completion banner */}
        {showProfileForm && (
          <Glass className="p-5 card-hover" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
            <p className="text-indigo-400 text-[11px] font-black uppercase tracking-widest mb-1">Complete Your Profile</p>
            <p className="text-gray-500 text-sm mb-4">Add parent details so your coach can reach them.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              {[
                { key: 'age', type: 'number', placeholder: 'Your age' },
                { key: 'parent_name', type: 'text', placeholder: "Parent's name" },
                { key: 'parent_phone', type: 'tel', placeholder: 'Parent phone (10 digits)' },
              ].map(f => (
                <input key={f.key} type={f.type} placeholder={f.placeholder} value={profileForm[f.key]}
                  onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-sm" />
              ))}
            </div>
            <button onClick={handleSaveProfile} disabled={savingProfile || !profileForm.parent_phone.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-2.5 rounded-xl font-black text-sm transition">
              {savingProfile ? 'Saving...' : 'Save Profile →'}
            </button>
          </Glass>
        )}

        {/* Empty state */}
        {history.length === 0 ? (
          <Glass className="p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="display text-3xl tracking-wider text-white mb-2">READY TO START?</h2>
            <p className="text-gray-500 mb-8 text-sm">Submit your first daily check-in to see your performance metrics.</p>
            <button onClick={() => navigate('/checkin')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold text-sm transition">
              Launch Check-in →
            </button>
          </Glass>
        ) : (
          <>
            {/* Readiness hero card */}
            {insight?.score != null && (
              <Glass className="p-6 card-hover" style={{
                background: `linear-gradient(135deg, rgba(${insight.risk === 'red' ? '244,63,94' : '16,185,129'},0.06) 0%, rgba(255,255,255,0.02) 100%)`,
                borderColor: `rgba(${insight.risk === 'red' ? '244,63,94' : '16,185,129'},0.2)`,
              }}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-6">
                    <div className="relative w-20 h-20 score-ring shrink-0">
                      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                        <circle cx="40" cy="40" r="34" fill="none"
                          stroke={riskColor(insight.risk)} strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 34}`}
                          strokeDashoffset={`${2 * Math.PI * 34 * (1 - insight.score / 100)}`}
                          style={{ transition: 'stroke-dashoffset 1s ease' }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-black text-xl leading-none text-white">{insight.score}</span>
                        <span className="text-[8px] text-gray-500 uppercase font-bold">Ready</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Today's Status</p>
                      <RiskBadge risk={insight.risk} />
                      {injuryRisk?.metrics?.risk_tier && (
                        <p className="text-gray-600 text-[11px] mt-1.5">
                          Workload: {injuryRisk.metrics.risk_tier} · ACWR {injuryRisk.acwr}
                        </p>
                      )}
                    </div>
                  </div>
                  {insight?.athlete_message && insight.athlete_message !== 'No data yet' && (
                    <div className="flex-1 min-w-0 bg-white/[0.03] rounded-xl px-4 py-3 border border-white/5 max-w-xs">
                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1">🤖 Coach Says</p>
                      <p className="text-gray-300 text-xs leading-relaxed italic">"{insight.athlete_message}"</p>
                    </div>
                  )}
                </div>
              </Glass>
            )}

            {/* Recovery Insight + Injury Prediction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Glass className="p-5 card-hover">
                <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-3">🤖 Recovery Insight</p>
                {insight?.insight && insight.insight !== 'No data yet' ? (
                  <p className="text-gray-200 text-sm leading-relaxed italic">"{insight.insight}"</p>
                ) : (
                  <p className="text-gray-500 text-sm italic">Gathering wellness patterns...</p>
                )}
              </Glass>

              <Glass className="p-5 card-hover" style={{
                borderColor: injuryRiskLevel === 'red' ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.08)',
              }}>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">🛡️ Injury Prediction</p>
                {injuryRisk ? (
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <p className="text-2xl font-black" style={{ color: riskLevelColor(injuryRiskLevel) }}>
                        {injuryRiskLevel ? injuryRiskLevel.toUpperCase() : '—'}
                      </p>
                      {injuryRiskScore != null && (
                        <p className="text-gray-500 text-[10px] font-bold">SCORE: {injuryRiskScore}/100</p>
                      )}
                    </div>
                    {injuryRiskScore != null && (
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-3">
                        <div className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${injuryRiskScore}%`, background: riskLevelColor(injuryRiskLevel) }} />
                      </div>
                    )}
                    {injuryRisk.verdict && (
                      <p className="text-gray-400 text-xs leading-relaxed">{injuryRisk.verdict}</p>
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
              </Glass>
            </div>

            {/* Avg metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Energy', val: avgOf('energy'), color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
                { label: 'Sleep', val: avgOf('sleep'), color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
                { label: 'Soreness', val: avgOf('soreness'), color: '#f43f5e', bg: 'rgba(244,63,94,0.08)' },
                { label: 'Mood', val: avgOf('mood'), color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
              ].map(m => (
                <Glass key={m.label} className="p-4 text-center card-hover" style={{ background: m.bg }}>
                  <p className="font-black text-2xl leading-none mb-1" style={{ color: m.color }}>{m.val}</p>
                  <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">Avg {m.label}</p>
                </Glass>
              ))}
            </div>

            {/* Chart */}
            <Glass className="p-5 card-hover">
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-5">Weekly Trend</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.slice(-7)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: 12 }} />
                    <Line type="monotone" dataKey="energy" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} name="Energy" />
                    <Line type="monotone" dataKey="sleep" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name="Sleep" />
                    <Line type="monotone" dataKey="soreness" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3, fill: '#f43f5e' }} name="Soreness" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Glass>

            {/* Recent check-ins */}
            <Glass className="p-5 card-hover">
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-4">Recent Check-ins</p>
              <div className="space-y-3">
                {[...history].reverse().slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-gray-700 text-[10px] font-bold w-12 shrink-0">{entry.date}</span>
                    <div className="flex-1 bg-white/[0.02] rounded-xl px-4 py-2.5 border border-white/5 grid grid-cols-4 gap-2 text-center">
                      {[
                        { v: entry.energy, c: '#6366f1', l: 'EN' },
                        { v: entry.sleep, c: '#8b5cf6', l: 'SL' },
                        { v: entry.soreness, c: '#f43f5e', l: 'SO' },
                        { v: entry.mood, c: '#f59e0b', l: 'MO' },
                      ].map(x => (
                        <div key={x.l}>
                          <p className="font-black text-sm" style={{ color: x.c }}>{x.v}</p>
                          <p className="text-[8px] text-gray-700">{x.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Glass>

            {/* Injuries */}
            {injuries.length > 0 && (
              <Glass className="p-5 card-hover">
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-4">🩹 Injury History</p>
                <div className="space-y-3">
                  {injuries.map(inj => (
                    <div key={inj.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-white font-black text-sm">{inj.body_part} — {inj.injury_type}</p>
                        <p className="text-gray-600 text-xs mt-0.5">{inj.date_occurred}</p>
                        {inj.notes && <p className="text-gray-500 text-xs mt-1 italic">"{inj.notes}"</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full border ${inj.severity === 'severe' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                            inj.severity === 'moderate' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                              'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}>{inj.severity.toUpperCase()}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${inj.status === 'active' ? 'text-rose-400 bg-rose-500/10' :
                            inj.status === 'recovering' ? 'text-amber-400 bg-amber-500/10' :
                              'text-emerald-400 bg-emerald-500/10'
                          }`}>{inj.status.charAt(0).toUpperCase() + inj.status.slice(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Glass>
            )}
          </>
        )}
      </div>

      {/* Profile modal */}
      {showProfile && athleteProfile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfile(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="display text-2xl tracking-wider text-white">MY PROFILE</h3>
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
                <div key={item.label} className="flex justify-between items-center bg-white/[0.03] rounded-xl px-4 py-3 border border-white/5">
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{item.label}</p>
                  <p className="text-white text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowProfile(false); setShowProfileForm(true); }}
              className="w-full mt-4 border border-white/10 text-gray-400 py-2.5 rounded-xl text-sm font-bold hover:border-indigo-500/50 hover:text-indigo-400 transition">
              Edit Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}