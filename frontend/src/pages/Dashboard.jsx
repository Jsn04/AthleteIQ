import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import StatCard from '../components/common/StatCard';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import BulkLogModal from './BulkLogModal';

const getCoachSport = () => localStorage.getItem('coachSport') || null;
const getAcademyId = () => localStorage.getItem('academyId') || '';
const norm = (str) => (str || '').trim().toLowerCase();

const Bar = ({ value, color }) => (
  <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-1 overflow-hidden">
    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
      style={{ width: `${value * 10}%` }} />
  </div>
);

const InjuryScorePill = ({ score, riskLevel }) => {
  if (score == null) return null;
  const color = riskLevel === 'red' ? 'text-rose-400' : riskLevel === 'yellow' ? 'text-amber-400' : 'text-emerald-400';
  const bg = riskLevel === 'red' ? 'bg-rose-500/10 border-rose-500/20'
    : riskLevel === 'yellow' ? 'bg-amber-500/10 border-amber-500/20'
      : 'bg-emerald-500/10 border-emerald-500/20';
  return (
    <div className={`rounded-lg px-3 py-1.5 border text-center ${bg}`}>
      <p className={`text-lg font-black ${color}`}>{score}</p>
      <p className="text-[10px] text-gray-500 uppercase font-bold">Injury Risk</p>
    </div>
  );
};

const LiveIndicator = ({ lastUpdated }) => (
  <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-3 py-1">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
      Live {lastUpdated && `· ${lastUpdated}`}
    </span>
  </div>
);

function SportSection({ sport, athletes, insights, injuryRisks, checkins, onNavigate, skipLock = false }) {
  const sessionKey = `unlocked_${sport.toLowerCase()}`;
  const [unlocked, setUnlocked] = useState(() => skipLock || sessionStorage.getItem(sessionKey) === 'true');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => { if (skipLock) setUnlocked(true); }, [skipLock]);

  const getLatestCheckin = (athleteName) =>
    checkins.find(c => norm(c.athlete_name) === norm(athleteName));

  const sportRed = athletes.filter(a => insights[a.name]?.risk === 'red').length;
  const sportYellow = athletes.filter(a => insights[a.name]?.risk === 'yellow').length;
  const checkedIn = athletes.filter(a => getLatestCheckin(a.name)).length;

  const handleUnlock = () => {
    if (password.trim().toLowerCase() === sport.toLowerCase()) {
      sessionStorage.setItem(sessionKey, 'true');
      setUnlocked(true);
      setError('');
      setPassword('');
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
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-black text-white tracking-tight uppercase">{sport}</h2>
          <span className="text-gray-500 text-xs font-medium">
            {athletes.length} athletes · {checkedIn} checked in
          </span>
          {skipLock && (
            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg">
              Your Sport
            </span>
          )}
          {unlocked && !skipLock && (
            <button onClick={handleLock}
              className="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest border border-gray-800 hover:border-gray-600 px-2 py-1 rounded-lg transition-all">
              🔒 Lock
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sportRed > 0 && (
            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              {sportRed} High Risk
            </span>
          )}
          {sportYellow > 0 && (
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              {sportYellow} Caution
            </span>
          )}
          {unlocked && !skipLock && (
            <button onClick={() => onNavigate(`/sport/${encodeURIComponent(sport)}`)}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-gray-700 hover:border-gray-500 transition-all">
              Full View →
            </button>
          )}
        </div>
      </div>

      {!unlocked ? (
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-white font-bold text-lg mb-1">{sport} Analytics Locked</h3>
          <p className="text-gray-500 text-sm mb-6">Enter the sport name to unlock</p>
          <div className={`flex gap-2 max-w-sm mx-auto ${shake ? 'animate-bounce' : ''}`}>
            <input type="text" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder={`Type "${sport}" to unlock`}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition"
            />
            <button onClick={handleUnlock}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all">
              Unlock
            </button>
          </div>
          {error && <p className="text-rose-400 text-xs mt-3 font-bold uppercase">{error}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {athletes.map(athlete => {
            const checkin = getLatestCheckin(athlete.name);
            const insight = insights[athlete.name];
            const injuryData = injuryRisks[athlete.name];
            const isCheckedIn = !!checkin;
            return (
              <div key={athlete.id}
                className={`bg-gray-800 rounded-2xl p-4 sm:p-5 border transition-all hover:border-gray-600 cursor-pointer ${insight?.risk === 'red' ? 'border-rose-500/30'
                  : insight?.risk === 'yellow' ? 'border-amber-500/20'
                    : 'border-gray-700'
                  }`}
                onClick={() => onNavigate(`/athlete/${encodeURIComponent(athlete.name)}`)}>

                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-lg shrink-0">
                      {athlete.name[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-white truncate">{athlete.name}</h3>
                      <p className="text-gray-500 text-xs font-bold uppercase mt-0.5">
                        {athlete.sport}{athlete.age ? ` · Age ${athlete.age}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {insight?.score != null && isCheckedIn && (
                      <div className="text-center bg-gray-900 rounded-xl px-3 py-1.5 border border-gray-700">
                        <p className={`text-xl sm:text-2xl font-black ${insight.risk === 'red' ? 'text-rose-400'
                          : insight.risk === 'yellow' ? 'text-amber-400'
                            : 'text-emerald-400'
                          }`}>{insight.score}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Ready</p>
                      </div>
                    )}
                    <RiskBadge risk={insight?.risk} checkedIn={isCheckedIn} />
                  </div>
                </div>

                {injuryData?.injury_risk_score != null && (
                  <div className="mb-4">
                    <InjuryScorePill score={injuryData.injury_risk_score} riskLevel={injuryData.risk_level} />
                  </div>
                )}

                {checkin ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Energy', val: checkin.energy, color: 'bg-blue-500' },
                      { label: 'Sleep', val: checkin.sleep, color: 'bg-indigo-500' },
                      { label: 'Soreness', val: checkin.soreness, color: 'bg-rose-500' },
                      { label: 'Mood', val: checkin.mood, color: 'bg-amber-500' },
                    ].map(m => (
                      <div key={m.label} className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                          <span>{m.label}</span>
                          <span className="text-gray-400">{m.val}/10</span>
                        </div>
                        <Bar value={m.val} color={m.color} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-900/50 rounded-xl px-4 py-3 mb-4 border border-dashed border-gray-700 flex items-center gap-3">
                    <span className="text-gray-600">⏳</span>
                    <p className="text-gray-500 text-xs">No check-in today — remind {athlete.name.split(' ')[0]}.</p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {injuryData?.acwr != null && (
                    <div className="flex items-center gap-3 text-xs font-bold flex-wrap">
                      <span className="text-gray-500 uppercase tracking-widest text-[10px]">ACWR</span>
                      <span className={`px-2 py-0.5 rounded bg-gray-900 border border-gray-700 ${injuryData.acwr > 1.5 ? 'text-rose-400'
                        : injuryData.acwr > 1.3 ? 'text-amber-400'
                          : injuryData.acwr < 0.8 ? 'text-blue-400'
                            : 'text-emerald-400'
                        }`}>{injuryData.acwr}</span>
                      {injuryData.deception_flag && (
                        <span className="text-orange-400 text-[10px] font-bold uppercase animate-pulse">
                          ⚠️ Deception Flagged
                        </span>
                      )}
                    </div>
                  )}
                  {insight?.insight && insight.insight !== 'No data yet' && (
                    <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-700">
                      <p className="text-[10px] text-blue-400 uppercase font-black mb-2">🤖 AI Insight</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{insight.insight}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [athletes, setAthletes] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [insights, setInsights] = useState({});
  const [injuryRisks, setInjuryRisks] = useState({});
  const [loading, setLoading] = useState(true);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const prevCheckinsRef = useRef(null);
  const coachSport = getCoachSport();
  const academyId = getAcademyId();

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [athletesRes, checkinsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/athletes`, { params: { academy_id: academyId } }),
        axios.get(`${API_BASE_URL}/wellness`, { params: { academy_id: academyId } }),
      ]);

      const newCheckinsRaw = JSON.stringify(checkinsRes.data);
      const dataChanged = newCheckinsRaw !== prevCheckinsRef.current;

      setAthletes(athletesRes.data);
      setCheckins(checkinsRes.data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      if (dataChanged || !isSilent) {
        const insightResults = {};
        const injuryResults = {};
        await Promise.all(
          athletesRes.data.map(async (athlete) => {
            const [insightRes, injuryRes] = await Promise.allSettled([
              axios.get(`${API_BASE_URL}/ai/insights/${encodeURIComponent(athlete.name)}`, { params: { academy_id: academyId } }),
              axios.get(`${API_BASE_URL}/ai/injury-risk/${encodeURIComponent(athlete.name)}`, { params: { academy_id: academyId } }),
            ]);
            insightResults[athlete.name] = insightRes.status === 'fulfilled' ? insightRes.value.data : null;
            injuryResults[athlete.name] = injuryRes.status === 'fulfilled' ? injuryRes.value.data : null;
          })
        );
        setInsights(insightResults);
        setInjuryRisks(injuryResults);
        prevCheckinsRef.current = newCheckinsRaw;
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const visibleAthletes = coachSport
    ? athletes.filter(a => norm(a.sport) === norm(coachSport))
    : athletes;

  const checkedInToday = visibleAthletes.filter(a =>
    checkins.find(c => norm(c.athlete_name) === norm(a.name))
  ).length;
  const highRiskCount = visibleAthletes.filter(a => insights[a.name]?.risk === 'red').length;
  const cautionCount = visibleAthletes.filter(a => insights[a.name]?.risk === 'yellow').length;

  const sportGroups = visibleAthletes.reduce((groups, athlete) => {
    const sport = athlete.sport || 'General';
    if (!groups[sport]) groups[sport] = [];
    groups[sport].push(athlete);
    return groups;
  }, {});

  const handleLogout = () => {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('unlocked_')) sessionStorage.removeItem(key);
    });
    localStorage.removeItem('role');
    localStorage.removeItem('athleteName');
    localStorage.removeItem('athleteSport');
    localStorage.removeItem('coachSport');
    localStorage.removeItem('parentChildName');
    navigate('/login');
  };

  if (loading && athletes.length === 0) return (
    <div className="min-h-screen bg-gray-950 p-6 flex items-center justify-center">
      <p className="text-gray-400">Loading dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight">AthleteIQ</h1>
                <LiveIndicator lastUpdated={lastUpdated} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {coachSport ? (
                  <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
                    {coachSport} Coach
                  </span>
                ) : (
                  <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
                    Admin
                  </span>
                )}
                <span className="bg-gray-800 border border-gray-700 text-gray-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
                  {localStorage.getItem('academyName') || 'Academy'}
                </span>
              </div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="sm:hidden flex flex-col gap-1.5 p-2 rounded-xl bg-gray-800 border border-gray-700 shrink-0 mt-1">
              <span className={`block w-5 h-0.5 bg-gray-400 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-400 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-400 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>

          {/* Desktop nav — ← ONLY CHANGE IS HERE: /drills → /session-planner */}
          <div className="hidden sm:flex gap-2 flex-wrap">
            <Link to="/athletes"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              Manage Athletes
            </Link>
            <Link to="/session-planner"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              📋 Session Planner
            </Link>
            <Link to="/meditation"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              🧘 Meditate
            </Link>
            <Link to="/academy-profile"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              🏛️ Academy
            </Link>
            <button
              onClick={() => setShowBulkModal(true)}
              disabled={visibleAthletes.length === 0}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 transition-all">
              + Log Session
            </button>
            <button
              onClick={handleLogout}
              className="text-rose-500 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-rose-500/10 transition-all">
              Logout
            </button>
          </div>

          {/* Mobile dropdown — ← SAME CHANGE HERE */}
          {menuOpen && (
            <div className="sm:hidden mt-3 flex flex-col gap-2">
              <Link to="/athletes"
                className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center"
                onClick={() => setMenuOpen(false)}>
                Manage Athletes
              </Link>
              <Link to="/session-planner"
                className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center"
                onClick={() => setMenuOpen(false)}>
                📋 Session Planner
              </Link>
              <Link to="/meditation"
                className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center"
                onClick={() => setMenuOpen(false)}>
                🧘 Meditate
              </Link>
              <Link to="/academy-profile"
                className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center"
                onClick={() => setMenuOpen(false)}>
                🏛️ Academy
              </Link>
              <button
                onClick={() => { setShowBulkModal(true); setMenuOpen(false); }}
                disabled={visibleAthletes.length === 0}
                className="bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold disabled:bg-gray-700 disabled:text-gray-500">
                + Log Today's Session
              </button>
              <button
                onClick={handleLogout}
                className="text-rose-500 font-bold px-5 py-3 rounded-xl text-sm border border-rose-500/20 hover:bg-rose-500/10">
                Logout
              </button>
            </div>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <StatCard label={coachSport ? `${coachSport} Athletes` : 'Total Athletes'} value={visibleAthletes.length} color="text-white" />
          <StatCard label="Active Today" value={checkedInToday} color="text-emerald-400" />
          <StatCard label="High Risk" value={highRiskCount} color="text-rose-400" />
          <StatCard label="Caution" value={cautionCount} color="text-amber-400" />
        </div>

        {/* ── Athletes ── */}
        {visibleAthletes.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-10 sm:p-16 text-center border border-dashed border-gray-700">
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
              {coachSport ? `No ${coachSport} athletes found` : 'No athletes found'}
            </h2>
            <p className="text-gray-500 mb-6 font-medium text-sm">
              {coachSport
                ? `No athletes assigned to ${coachSport} yet. Ask an admin to add them.`
                : 'Get started by adding your athlete profiles.'}
            </p>
            {!coachSport && (
              <Link to="/athletes"
                className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all">
                Add Athletes
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(sportGroups).map(([sport, sportAthletes]) => (
              <SportSection
                key={sport}
                sport={sport}
                athletes={sportAthletes}
                insights={insights}
                injuryRisks={injuryRisks}
                checkins={checkins}
                onNavigate={navigate}
                skipLock={!!coachSport}
              />
            ))}
          </div>
        )}
      </div>

      {showBulkModal && (
        <BulkLogModal
          athletes={visibleAthletes}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => fetchData(true)}
        />
      )}
    </div>
  );
}

export default Dashboard;