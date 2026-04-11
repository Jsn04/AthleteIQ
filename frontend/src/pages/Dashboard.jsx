import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { warmup } from '../api';
import StatCard from '../components/common/StatCard';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import BulkLogModal from './BulkLogModal';
import TopLoader from '../components/common/TopLoader';

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

function SportSection({ sport, athletes, insights, injuryRisks, checkins, onNavigate, skipLock = false, attendance = {}, onMarkAttendance, markingAttendance = {} }) {
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

                {/* Attendance */}
                <div className="flex items-center gap-2 mb-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Attendance:</span>
                  {(() => {
                    const key = athlete.name.toLowerCase().trim();
                    const status = attendance[key];
                    const loading = markingAttendance[key];
                    return (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); onMarkAttendance(athlete, 'present'); }}
                          disabled={loading}
                          className={`text-[10px] font-black px-3 py-1 rounded-lg border transition ${status === 'present'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'border-gray-700 text-gray-600 hover:border-emerald-500/40 hover:text-emerald-400'
                            }`}>
                          ✓ Present
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onMarkAttendance(athlete, 'absent'); }}
                          disabled={loading}
                          className={`text-[10px] font-black px-3 py-1 rounded-lg border transition ${status === 'absent'
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                            : 'border-gray-700 text-gray-600 hover:border-rose-500/40 hover:text-rose-400'
                            }`}>
                          ✗ Absent
                        </button>
                        {status && (
                          <span className={`text-[10px] font-black uppercase tracking-widest ${status === 'present' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                            {status === 'present' ? '✓ Marked Present' : '✗ Marked Absent'}
                          </span>
                        )}
                        {loading && <span className="text-gray-600 text-[10px]">saving...</span>}
                      </>
                    );
                  })()}
                </div>

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
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [sentToday, setSentToday] = useState(() => {
    const key = `broadcast_sent_${new Date().toDateString()}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  });
  const [recoveryData, setRecoveryData] = useState({});
  const [loadingRecovery, setLoadingRecovery] = useState({});
  const [attendance, setAttendance] = useState({});
  const [markingAttendance, setMarkingAttendance] = useState({});
  const [loadError, setLoadError] = useState(false);
  const navigate = useNavigate();
  const prevCheckinsRef = useRef(null);
  const retryTimerRef = useRef(null);
  const coachSport = getCoachSport();
  const academyId = getAcademyId();

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [athletesRes, checkinsRes] = await Promise.allSettled([
        api.get(`/athletes`, { params: { academy_id: academyId } }),
        api.get(`/wellness`, { params: { academy_id: academyId } }),
      ]);

      // If athletes failed, bail out (nothing to render)
      if (athletesRes.status !== 'fulfilled') throw new Error('Athletes fetch failed');
      const athletesData = athletesRes.value.data;
      const checkinsData = checkinsRes.status === 'fulfilled' ? checkinsRes.value.data : [];

      const newCheckinsRaw = JSON.stringify(checkinsData);
      const dataChanged = newCheckinsRaw !== prevCheckinsRef.current;

      setAthletes(athletesData);
      setCheckins(checkinsData);
      setLoadError(false);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      if (dataChanged || !isSilent) {
        const insightResults = {};
        const injuryResults = {};
        await Promise.all(
          athletesData.map(async (athlete) => {
            const [insightRes, injuryRes] = await Promise.allSettled([
              api.get(`/ai/insights/${encodeURIComponent(athlete.name)}`, { params: { academy_id: academyId } }),
              api.get(`/ai/injury-risk/${encodeURIComponent(athlete.name)}`, { params: { academy_id: academyId } }),
            ]);
            insightResults[athlete.name] = insightRes.status === 'fulfilled' ? insightRes.value.data : null;
            injuryResults[athlete.name] = injuryRes.status === 'fulfilled' ? injuryRes.value.data : null;
          })
        );
        setInsights(insightResults);
        setInjuryRisks(injuryResults);
        prevCheckinsRef.current = newCheckinsRaw;
      }

      try {
        const attendanceRes = await api.get(`/attendance/today`, {
          params: { academy_id: academyId }
        });
        const attendanceMap = {};
        (attendanceRes.data || []).forEach(a => {
          attendanceMap[a.athlete_name.toLowerCase().trim()] = a.status;
        });
        setAttendance(attendanceMap);
      } catch {
        // attendance fetch failure should not block dashboard
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      // Don't clobber any previously loaded athletes — surface a soft error banner
      // instead. On first-load failure (athletes still empty) the effect below
      // schedules a fast 3s retry so the user isn't stuck on "No athletes found"
      // for 30s while the polling interval limps to the rescue.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    // Wake up Render before loading real data
    warmup().then(() => fetchData());
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fast retry on initial load failure — handles Render cold starts and
  // transient Supabase stale-connection errors without waiting for the 30s poll.
  useEffect(() => {
    if (loadError && athletes.length === 0) {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => fetchData(true), 3000);
    }
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [loadError, athletes.length, fetchData]);

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

  const buildMessage = (athlete) => {
    const insight = insights[athlete.name];
    const aiText = insight?.insight || insight?.athlete_message;
    const firstName = athlete.name.split(' ')[0];
    const academyName = localStorage.getItem('academyName') || 'Academy';

    let msg = `👋 Hello from *${academyName}*\n\n`;
    msg += `Here's a quick update on *${athlete.name}* from today's session:\n\n`;

    if (aiText && aiText !== 'No data yet') {
      msg += `📊 *Performance Note:*\n${aiText}\n\n`;
    }

    msg += `✅ ${firstName} has been monitored today using AthleteIQ — our performance tracking system.\n\n`;
    msg += `If you have any questions about ${firstName}'s training, feel free to reach out directly.\n\n`;
    msg += `— Coach, ${academyName}`;

    return msg;
  };

  const handleBroadcastSend = (athlete) => {
    if (!athlete.parent_phone) return;
    const msg = buildMessage(athlete);
    const url = `https://wa.me/91${athlete.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    const key = `broadcast_sent_${new Date().toDateString()}`;
    const updated = [...sentToday, athlete.name];
    setSentToday(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleSendRecovery = async (athlete) => {
    if (!athlete.parent_phone) return;

    const recoveryKey = `recovery_sent_${athlete.name}_${new Date().toDateString()}`;
    if (localStorage.getItem(recoveryKey)) {
      alert(`Recovery message already sent to ${athlete.name.split(' ')[0]}'s parent today.`);
      return;
    }

    setLoadingRecovery(prev => ({ ...prev, [athlete.name]: true }));
    try {
      const res = await api.get(
        `/ai/parent-recovery/${encodeURIComponent(athlete.name)}`,
        { params: { academy_id: academyId } }
      );
      const data = res.data;
      setRecoveryData(prev => ({ ...prev, [athlete.name]: data }));

      let msg = `🚨 *Recovery Alert — ${athlete.name}*\n`;
      msg += `${localStorage.getItem('academyName') || 'Academy'}\n\n`;

      if (data.coach_message) {
        msg += `*Coach's Note:*\n${data.coach_message}\n\n`;
      }

      if (data.exercises?.length > 0) {
        msg += `*Home Recovery Exercises:*\n`;
        data.exercises.forEach((ex, i) => {
          msg += `${i + 1}. *${ex.name}* (${ex.duration})\n`;
          if (ex.how) msg += `   ${ex.how}\n`;
        });
      }

      msg += `\n🔗 View detailed stats: ${window.location.origin}/login\n`;
      msg += `— AthleteIQ`;

      const url = `https://wa.me/91${athlete.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');

      localStorage.setItem(recoveryKey, 'true');
    } catch (err) {
      console.error('Recovery fetch failed:', err);
    } finally {
      setLoadingRecovery(prev => ({ ...prev, [athlete.name]: false }));
    }
  };

  const handleMarkAttendance = async (athlete, status) => {
    const key = athlete.name.toLowerCase().trim();
    setMarkingAttendance(prev => ({ ...prev, [key]: true }));
    try {
      await api.post(`/attendance`, {
        academy_id: academyId,
        athlete_name: athlete.name,
        status: status,
        date: new Date().toISOString().split('T')[0],
      });
      setAttendance(prev => ({ ...prev, [key]: status }));
    } catch (err) {
      console.error('Attendance mark failed:', err);
    } finally {
      setMarkingAttendance(prev => ({ ...prev, [key]: false }));
    }
  };

  if (loading && athletes.length === 0) return (
    <div className="min-h-screen bg-gray-950 p-6 flex items-center justify-center">
      <p className="text-gray-400">Loading dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-10">
      <TopLoader loading={loading} />
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
            <button
              onClick={() => setShowBroadcast(true)}
              className="bg-green-700 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all">
              📲 Broadcast
            </button>

            <button
              onClick={() => {
                const present = visibleAthletes.filter(a => attendance[a.name.toLowerCase().trim()] === 'present');
                if (present.length === 0) {
                  alert('Mark at least one athlete as Present before logging a session.');
                  return;
                }
                setShowBulkModal(true);
              }}
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
              <button
                onClick={() => { setShowBroadcast(true); setMenuOpen(false); }}
                className="bg-green-700 text-white px-5 py-3 rounded-xl text-sm font-bold text-center">
                📲 Broadcast
              </button>

              <button
                onClick={() => {
                  const present = visibleAthletes.filter(a => attendance[a.name.toLowerCase().trim()] === 'present');
                  if (present.length === 0) {
                    alert('Mark at least one athlete as Present before logging a session.');
                    return;
                  }
                  setMenuOpen(false);
                  setShowBulkModal(true);
                }}
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
          <StatCard
            label="Absent Today"
            value={Object.values(attendance).filter(s => s === 'absent').length}
            color="text-gray-400"
          />
        </div>

        {/* ── Athletes ── */}
        {visibleAthletes.length === 0 ? (
          loadError ? (
            <div className="bg-gray-800 rounded-2xl p-10 sm:p-16 text-center border border-dashed border-amber-500/30">
              <div className="inline-flex items-center gap-3 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-black text-white">Reconnecting…</h2>
              </div>
              <p className="text-gray-500 mb-6 font-medium text-sm">
                Couldn't reach the server. Retrying automatically.
              </p>
              <button
                onClick={() => fetchData(false)}
                className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all">
                Retry now
              </button>
            </div>
          ) : (
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
          )
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
                attendance={attendance}
                onMarkAttendance={handleMarkAttendance}
                markingAttendance={markingAttendance}
              />
            ))}
          </div>
        )}
      </div>

      {showBulkModal && (
        <BulkLogModal
          athletes={visibleAthletes.filter(a => attendance[a.name.toLowerCase().trim()] === 'present')}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => fetchData(true)}
        />
      )}

      {showBroadcast && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowBroadcast(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-700 shrink-0">
              <div>
                <h2 className="text-lg font-black text-white">📲 Parent Broadcast</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  {visibleAthletes.filter(a => checkins.find(c => norm(c.athlete_name) === norm(a.name))).length} athletes checked in today
                </p>
              </div>
              <button onClick={() => setShowBroadcast(false)}
                className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {visibleAthletes.map(athlete => {
                const checkedIn = !!checkins.find(c => norm(c.athlete_name) === norm(athlete.name));
                const hasPhone = !!athlete.parent_phone;
                const alreadySent = sentToday.includes(athlete.name);
                const insight = insights[athlete.name];
                const readiness = insight?.score ?? '—';
                const risk = insight?.risk;

                return (
                  <div key={athlete.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-black text-sm truncate">{athlete.name}</p>
                        <p className={`text-xs font-bold mt-0.5 ${!checkedIn ? 'text-gray-600' :
                          risk === 'red' ? 'text-rose-400' :
                            risk === 'yellow' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                          {!checkedIn ? 'No check-in today' :
                            (insight?.insight || insight?.athlete_message)
                              ? `${(insight.insight || insight.athlete_message).slice(0, 50)}...`
                              : 'No insight yet today'}
                        </p>
                      </div>

                      {alreadySent ? (
                        <span className="text-emerald-400 text-xs font-black shrink-0">✅ Sent</span>
                      ) : !hasPhone ? (
                        <span className="text-gray-600 text-xs font-bold shrink-0">No phone</span>
                      ) : !checkedIn ? (
                        <span className="text-gray-600 text-xs font-bold shrink-0">Skipped</span>
                      ) : risk === 'red' ? (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => handleBroadcastSend(athlete)}
                            className="bg-green-600 hover:bg-green-500 text-white text-xs font-black px-3 py-1.5 rounded-xl transition">
                            Send update →
                          </button>
                          <button
                            onClick={() => handleSendRecovery(athlete)}
                            disabled={loadingRecovery[athlete.name]}
                            className="bg-rose-600 hover:bg-rose-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-black px-3 py-1.5 rounded-xl transition">
                            {loadingRecovery[athlete.name] ? 'Loading...' : '🚨 Send recovery'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleBroadcastSend(athlete)}
                          className="bg-green-600 hover:bg-green-500 text-white text-xs font-black px-4 py-2 rounded-xl transition shrink-0">
                          Send →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer note */}
            <div className="p-4 border-t border-gray-700 shrink-0">
              <p className="text-gray-600 text-[10px] text-center">
                Only athletes who checked in today are included · Sent status resets daily
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;