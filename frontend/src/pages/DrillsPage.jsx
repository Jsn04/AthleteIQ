import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

const API = API_BASE_URL;
const getAcademyId = () => localStorage.getItem('academyId') || '';
const getCoachSport = () => localStorage.getItem('coachSport') || null;

const CATEGORY_CONFIG = {
  Warmup: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', emoji: '🔥' },
  Skill: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', emoji: '🎯' },
  Strength: { color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', emoji: '💪' },
  Recovery: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', emoji: '🧘' },
  Conditioning: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', emoji: '⚡' },
};

const INTENSITY_STYLES = {
  Low: 'bg-green-500/20 text-green-400 border-green-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  High: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SPORT_ICONS = {
  Skating: '⛸️', Athletics: '🏃', Swimming: '🏊', Badminton: '🏸',
  Cricket: '🏏', Football: '⚽', Basketball: '🏀', Wrestling: '🤼',
  Kabaddi: '🤸', Tennis: '🎾', Volleyball: '🏐', Boxing: '🥊',
  Cycling: '🚴', Gymnastics: '🤸', Other: '🏅', General: '🏅',
};

const DrillCard = ({ drill }) => {
  const cat = CATEGORY_CONFIG[drill.category] || CATEGORY_CONFIG['Skill'];
  return (
    <div className={`rounded-xl p-4 border ${cat.bg} flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">{cat.emoji}</span>
          <p className={`font-black text-sm ${cat.color}`}>{drill.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${INTENSITY_STYLES[drill.intensity] || 'bg-gray-700 text-gray-400 border-gray-600'}`}>
            {drill.intensity}
          </span>
          <span className="bg-gray-700/60 text-gray-300 border border-gray-600/50 px-2 py-0.5 rounded-lg text-xs font-bold">
            ⏱ {drill.duration}
          </span>
          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${cat.bg} ${cat.color}`}>
            {drill.category}
          </span>
        </div>
      </div>
      {drill.reason && (
        <p className="text-gray-400 text-xs leading-relaxed border-t border-white/5 pt-2">💡 {drill.reason}</p>
      )}
    </div>
  );
};

const RiskDot = ({ risk }) => {
  const styles = { red: 'bg-red-500', yellow: 'bg-yellow-500', green: 'bg-green-500', unknown: 'bg-gray-600' };
  return <span className={`inline-block w-2 h-2 rounded-full ${styles[risk] || styles.unknown}`} />;
};

function LockedSportGroup({ sport, athletes, skipLock = false, children }) {
  const sessionKey = `unlocked_${sport.toLowerCase()}`;
  const [unlocked, setUnlocked] = useState(() => skipLock || sessionStorage.getItem(sessionKey) === 'true');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => { if (skipLock) setUnlocked(true); }, [skipLock]);

  const handleUnlock = () => {
    if (password.trim().toLowerCase() === sport.toLowerCase()) {
      sessionStorage.setItem(sessionKey, 'true');
      setUnlocked(true);
      setError('');
    } else {
      setError('Incorrect password');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(sessionKey);
    setUnlocked(false);
    setPassword('');
  };

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl">{SPORT_ICONS[sport] || '🏅'}</span>
          <h2 className="text-lg font-bold text-gray-300 uppercase tracking-widest">{sport}</h2>
          <span className="text-gray-600 text-xs">{athletes.length} athletes</span>
          {unlocked && !skipLock && (
            <button onClick={handleLock}
              className="text-gray-600 hover:text-gray-400 text-xs border border-gray-700 hover:border-gray-500 px-2 py-0.5 rounded-lg transition">
              🔒 Lock
            </button>
          )}
          {skipLock && (
            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg">
              Your Sport
            </span>
          )}
        </div>
      </div>

      {!unlocked ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">🔒</div>
          <div className="text-center">
            <p className="text-white font-bold text-lg mb-1">{sport} Drills Locked</p>
            <p className="text-gray-500 text-sm">Enter the sport name to view drill plans</p>
          </div>
          <div className="w-full relative rounded-xl overflow-hidden mb-2">
            <div className="flex flex-col gap-3 blur-sm pointer-events-none select-none opacity-40">
              {athletes.slice(0, 2).map((a, i) => (
                <div key={i} className="bg-gray-700 rounded-xl p-4 border border-gray-600">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-500/20 rounded-xl" />
                      <div>
                        <p className="font-bold text-white text-sm">{a.name}</p>
                        <p className="text-gray-500 text-xs">Readiness —/100</p>
                      </div>
                    </div>
                    <div className="w-20 h-6 bg-gray-600 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={`w-full max-w-sm ${shake ? 'animate-bounce' : ''}`}>
            <div className="flex gap-2">
              <input type="text" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                placeholder={`Type "${sport}" to unlock`}
                className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm"
              />
              <button onClick={handleUnlock}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-xl font-bold text-sm transition">
                Unlock
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">{children}</div>
      )}
    </div>
  );
}

function AthletePanel({ athlete, insight }) {
  const academyId = getAcademyId();
  const cacheKey = `drills_${athlete.name}`;
  const [drills, setDrills] = useState(() => {
    const cached = sessionStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const fetchDrills = async (e) => {
    e?.stopPropagation();
    setLoading(true);
    setExpanded(true);
    try {
      const res = await axios.get(`${API}/ai/drills/${encodeURIComponent(athlete.name)}`, {
        params: { academy_id: academyId }
      });
      setDrills(res.data);
      sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
    } catch {
      setDrills({ drills: [], context: 'Failed to generate. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (e) => {
    e?.stopPropagation();
    sessionStorage.removeItem(cacheKey);
    setDrills(null);
    setLoading(true);
    setExpanded(true);
    try {
      const res = await axios.get(`${API}/ai/drills/${encodeURIComponent(athlete.name)}`, {
        params: { academy_id: academyId }
      });
      setDrills(res.data);
      sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
    } catch {
      setDrills({ drills: [], context: 'Failed to generate. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-700/40 transition"
        onClick={() => drills && setExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
            {athlete.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-white text-sm hover:text-blue-400 transition cursor-pointer"
              onClick={(e) => { e.stopPropagation(); navigate(`/athlete/${encodeURIComponent(athlete.name)}`); }}>
              {athlete.name}
            </p>
            <p className="text-gray-500 text-xs flex items-center gap-1.5 mt-0.5">
              {insight?.risk && <RiskDot risk={insight.risk} />}
              Readiness {insight?.score ?? '—'}/100
              {insight?.risk === 'red' && <span className="text-red-400 font-bold">· High Risk</span>}
              {insight?.risk === 'yellow' && <span className="text-yellow-400 font-bold">· Caution</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {drills?.drills?.length > 0 && (
            <button onClick={handleRefresh}
              className="text-gray-600 hover:text-purple-400 text-xs border border-gray-700 hover:border-purple-500/50 px-3 py-1.5 rounded-lg transition">
              🔄 Refresh
            </button>
          )}
          {!drills ? (
            <button onClick={fetchDrills} disabled={loading}
              className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
              {loading ? '⏳ Generating...' : '✨ Generate'}
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
              className="text-gray-500 hover:text-white text-xs border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition">
              {expanded ? '▲ Hide' : `▼ ${drills.drills.length} drills`}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-700/60">
          {loading ? (
            <div className="flex flex-col gap-3 pt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-700/40 rounded-xl border border-gray-600/30 animate-pulse" />
              ))}
            </div>
          ) : drills?.drills?.length > 0 ? (
            <>
              {drills.context && (
                <div className="bg-gray-700/30 rounded-xl px-4 py-2 border border-gray-600/30 mt-4 mb-3">
                  <p className="text-gray-500 text-xs">
                    <span className="text-gray-400 font-bold">Based on: </span>{drills.context}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-3 mt-3">
                {drills.drills.map((drill, i) => <DrillCard key={i} drill={drill} />)}
              </div>
            </>
          ) : (
            <p className="text-gray-600 text-xs pt-4">{drills?.context || 'No drills available.'}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DrillsPage() {
  const [athletes, setAthletes] = useState([]);
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const coachSport = getCoachSport();
  const academyId = getAcademyId();

  useEffect(() => { if (coachSport) setFilter(coachSport); }, [coachSport]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await axios.get(`${API}/athletes`, { params: { academy_id: academyId } });
        setAthletes(res.data);
        const insightMap = {};
        await Promise.all(
          res.data.map(async (a) => {
            try {
              const r = await axios.get(`${API}/ai/insights/${encodeURIComponent(a.name)}`, {
                params: { academy_id: academyId }
              });
              insightMap[a.name] = r.data;
            } catch {
              insightMap[a.name] = null;
            }
          })
        );
        setInsights(insightMap);
      } catch (err) {
        console.error('Error loading drills page:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [academyId]);

  const norm = (s) => (s || '').trim().toLowerCase();

  const visibleAthletes = coachSport
    ? athletes.filter(a => norm(a.sport) === norm(coachSport))
    : athletes;

  const sports = coachSport
    ? [coachSport]
    : ['All', ...Array.from(new Set(athletes.map(a => a.sport).filter(Boolean)))];

  const filtered = visibleAthletes.filter(a => {
    const matchSport = coachSport ? true : (filter === 'All' || a.sport === filter);
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    return matchSport && matchSearch;
  });

  const riskOrder = { red: 0, yellow: 1, green: 2, unknown: 3 };
  const sorted = [...filtered].sort((a, b) =>
    (riskOrder[insights[a.name]?.risk] ?? 3) - (riskOrder[insights[b.name]?.risk] ?? 3)
  );

  const sportGroups = sorted.reduce((acc, athlete) => {
    const sport = athlete.sport || 'General';
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(athlete);
    return acc;
  }, {});

  const generateAll = async () => {
    const uncached = visibleAthletes.filter(a => !sessionStorage.getItem(`drills_${a.name}`));
    await Promise.allSettled(
      uncached.map(a =>
        axios.get(`${API}/ai/drills/${encodeURIComponent(a.name)}`, { params: { academy_id: academyId } })
          .then(res => sessionStorage.setItem(`drills_${a.name}`, JSON.stringify(res.data)))
          .catch(() => { })
      )
    );
    setAthletes(prev => [...prev]);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🏋️</div>
        <p className="text-gray-400 text-lg mb-2">Loading drill centre...</p>
        <p className="text-gray-600 text-sm">Fetching athlete roster and insights</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black tracking-tight">Drill Centre</h1>
              {coachSport && (
                <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
                  {coachSport} only
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">AI sport-specific drills · {visibleAthletes.length} athletes</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={generateAll}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition">
              ✨ Generate All
            </button>
            <button onClick={() => navigate('/dashboard')}
              className="border border-gray-600 text-gray-400 px-4 py-2 rounded-xl text-sm hover:border-blue-500 hover:text-blue-400 transition">
              ← Dashboard
            </button>
          </div>
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search athletes..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm min-w-0"
          />
          {!coachSport && (
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm appearance-none cursor-pointer">
              {sports.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {visibleAthletes.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-white">{visibleAthletes.length}</p>
              <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">{coachSport || 'Total'}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-red-400">
                {visibleAthletes.filter(a => insights[a.name]?.risk === 'red').length}
              </p>
              <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">High Risk</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-yellow-400">
                {visibleAthletes.filter(a => insights[a.name]?.risk === 'yellow').length}
              </p>
              <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">Caution</p>
            </div>
          </div>
        )}

        {visibleAthletes.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-16 border border-gray-700 text-center">
            <div className="text-5xl mb-4">🏋️</div>
            <h2 className="text-xl font-black text-white mb-2">
              {coachSport ? `No ${coachSport} athletes yet` : 'No athletes yet'}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {coachSport ? `Ask an admin to add ${coachSport} athletes first.` : 'Add athletes first to generate drill plans.'}
            </p>
            {!coachSport && (
              <button onClick={() => navigate('/athletes')}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold transition text-sm">
                + Add Athletes
              </button>
            )}
          </div>
        ) : (
          Object.entries(sportGroups).map(([sport, sportAthletes]) => (
            <LockedSportGroup key={sport} sport={sport} athletes={sportAthletes} skipLock={!!coachSport}>
              {sportAthletes.map(a => <AthletePanel key={a.id} athlete={a} insight={insights[a.name]} />)}
            </LockedSportGroup>
          ))
        )}
      </div>
    </div>
  );
}

export default DrillsPage;