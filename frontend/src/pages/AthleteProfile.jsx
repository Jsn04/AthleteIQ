import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import StatCard from '../components/common/StatCard';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import BulkLogModal from './BulkLogModal';
import WeeklyReport from './WeeklyReport';
import TopLoader from '../components/common/TopLoader';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const getAcademyId = () => localStorage.getItem('academyId') || '';

function AthleteProfile() {
  const { name } = useParams();
  const navigate = useNavigate();
  const academyId = getAcademyId();

  const [history, setHistory] = useState([]);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [insight, setInsight] = useState(null);
  const [injuryRisk, setInjuryRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7D');
  const [error, setError] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [injuries, setInjuries] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [injuryForm, setInjuryForm] = useState({
    body_part: 'Knee',
    injury_type: 'Sprain',
    severity: 'mild',
    date_occurred: new Date().toISOString().split('T')[0],
    notes: '',
    status: 'active',
  });
  const [savingInjury, setSavingInjury] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  const prevCheckinsRef = useRef(null);
  const retryTimerRef = useRef(null);
  const [fetchTick, setFetchTick] = useState(0);
  const [partialLoad, setPartialLoad] = useState(false);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const params = { academy_id: academyId };
      const [historyRes, logsRes, insightRes, injuryRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/wellness/history/${encodeURIComponent(name)}`, { params }),
        axios.get(`${API_BASE_URL}/wellness/training-log/${encodeURIComponent(name)}`, { params }),
        axios.get(`${API_BASE_URL}/ai/insights/${encodeURIComponent(name)}`, { params }),
        axios.get(`${API_BASE_URL}/ai/injury-risk/${encodeURIComponent(name)}`, { params }),
      ]);

      if (historyRes.status === 'fulfilled') {
        const rawHistory = historyRes.value.data.history || [];
        const chronological = [...rawHistory].reverse();
        const formatted = chronological.map((c) => ({
          date: new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          energy: c.energy,
          sleep: c.sleep,
          soreness: c.soreness,
          mood: c.mood,
          readiness: parseFloat(((c.energy + c.sleep + (10 - c.soreness) + c.mood) / 4).toFixed(1)),
          notes: c.notes || '',
          created_at: c.created_at,
        }));
        setHistory(formatted);
        prevCheckinsRef.current = JSON.stringify(rawHistory);
      }
      if (logsRes.status === 'fulfilled') setTrainingLogs([...logsRes.value.data.logs || []].reverse());
      if (insightRes.status === 'fulfilled') setInsight(insightRes.value.data);
      if (injuryRes.status === 'fulfilled') setInjuryRisk(injuryRes.value.data);

      // Flag a partial load if any of the AI panels came back rejected. A follow-up
      // effect schedules a fast retry so readiness + injury risk don't stay blank
      // while waiting for a 429 or stale Supabase connection to clear.
      setPartialLoad(
        insightRes.status !== 'fulfilled' ||
        injuryRes.status !== 'fulfilled'
      );
      setFetchTick(t => t + 1);

      try {
        const injuriesRes = await axios.get(
          `${API_BASE_URL}/injuries/${encodeURIComponent(name)}`,
          { params: { academy_id: academyId } }
        );
        setInjuries(injuriesRes.data || []);
      } catch { setInjuries([]); }

      try {
        const attRes = await axios.get(
          `${API_BASE_URL}/attendance/${encodeURIComponent(name)}`,
          { params: { academy_id: academyId } }
        );
        setAttendanceLog(attRes.data || []);
      } catch { setAttendanceLog([]); }

    } catch (err) {
      console.error('Error fetching athlete details:', err);
      setError('Failed to load athlete data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [name, academyId]);

  const handleLogInjury = async () => {
    setSavingInjury(true);
    try {
      await axios.post(`${API_BASE_URL}/injuries/`, {
        ...injuryForm,
        athlete_name: name,
        academy_id: academyId,
      });
      setShowInjuryModal(false);
      setInjuryForm({
        body_part: 'Knee', injury_type: 'Sprain', severity: 'mild',
        date_occurred: new Date().toISOString().split('T')[0],
        notes: '', status: 'active',
      });
      fetchData(true);
    } catch (err) {
      console.error('Injury log failed:', err);
    } finally { setSavingInjury(false); }
  };

  const handleUpdateInjuryStatus = async (injuryId, newStatus, notes) => {
    try {
      await axios.patch(`${API_BASE_URL}/injuries/${injuryId}`, { status: newStatus, notes });
      fetchData(true);
    } catch (err) { console.error('Status update failed:', err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fast retry when an AI panel fails on first open (Groq 429, stale Supabase
  // connection, cold start). Without this the coach sees a blank readiness /
  // recovery card and has to manually refresh 3-4 times. Capped at 5 attempts
  // (~15s) so a broken backend doesn't turn into a request storm — after that
  // the normal 30s polling interval takes over.
  useEffect(() => {
    if (!partialLoad) return;
    if (insight && injuryRisk) return;
    if (fetchTick > 5) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => fetchData(true), 3000);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [partialLoad, fetchTick, insight, injuryRisk, fetchData]);

  const filteredHistory = (() => {
    const n = timeRange === '7D' ? 7 : timeRange === '14D' ? 14 : timeRange === '30D' ? 30 : 999;
    return history.slice(-n);
  })();

  const singleAthleteList = [{ id: name, name }];

  if (loading && history.length === 0) return (
    <div className="min-h-screen bg-gray-950 p-6 flex items-center justify-center">
      <LoadingSkeleton type="profile" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 p-6 flex items-center justify-center">
      <div className="text-center">
        <p className="text-rose-400 font-bold mb-4">{error}</p>
        <button onClick={() => fetchData(false)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <TopLoader loading={loading} />
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-white transition group flex items-center gap-2">
              <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
              <span className="font-bold text-sm uppercase">Back</span>
            </button>
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight">{name}</h1>
              <p className="text-gray-500 font-bold uppercase text-[10px] md:text-xs mt-1">
                Athlete Performance Profile · {history.length} Entries
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {insight && <RiskBadge risk={insight.risk} />}
            {injuries.filter(i => i.status === 'active').length > 0 && (
              <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black px-3 py-1 rounded-full">
                🩹 {injuries.filter(i => i.status === 'active').length} Active {injuries.filter(i => i.status === 'active').length === 1 ? 'Injury' : 'Injuries'}
              </span>
            )}
            <button onClick={() => setShowWeeklyReport(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
              📊 Weekly Report
            </button>
            <button onClick={() => setShowInjuryModal(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
              🩹 Injury Log
            </button>
            <button onClick={() => setShowBulkModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
              + Log Session
            </button>
            <button onClick={() => fetchData(false)}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
              Refresh Data
            </button>
          </div>
        </div>

        {/* Stat Cards — Readiness and Injury Risk show /100 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Avg Readiness"
            value={
              (insight?.metrics?.readiness ?? insight?.score) != null
                ? `${insight?.metrics?.readiness ?? insight?.score}/100`
                : '—'
            }
            color="text-emerald-400"
          />
          <StatCard
            label="Injury Risk"
            value={injuryRisk?.injury_risk_score != null ? `${injuryRisk.injury_risk_score}/100` : '—'}
            color={injuryRisk?.risk_level === 'red' ? 'text-rose-400' : 'text-amber-400'}
          />
          <StatCard
            label="ACWR"
            value={injuryRisk?.acwr && injuryRisk.acwr > 0 ? injuryRisk.acwr : '—'}
            color="text-blue-400"
            subtitle={!injuryRisk?.acwr || injuryRisk.acwr === 0 ? "7+ days needed" : null}
          />
          <StatCard label="Active Days" value={history.length} color="text-white" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Wellness Trends chart */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black uppercase tracking-tight">Wellness Trends</h2>
                <div className="flex bg-gray-900 rounded-lg p-1">
                  {['7D', '14D', '30D', 'All'].map(range => (
                    <button key={range} onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 rounded text-[10px] font-black transition ${timeRange === range ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              {filteredHistory.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-gray-600 text-sm italic">No wellness data yet for this range.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={filteredHistory}>
                    <defs>
                      <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="readiness" stroke="#3b82f6" strokeWidth={3}
                      fillOpacity={1} fill="url(#colorRead)" name="Readiness Score" />
                    <Line type="monotone" dataKey="energy" stroke="#3b82f660" strokeWidth={1} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Recovery Insight + Injury Prediction */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <p className="text-blue-400 text-[10px] font-black uppercase mb-3 px-1">🤖 Recovery Insight</p>
                {insight?.insight || insight?.athlete_message ? (
                  <p className="text-gray-200 text-sm leading-relaxed italic px-1">
                    "{insight.insight || insight.athlete_message}"
                  </p>
                ) : (
                  <p className="text-gray-500 text-sm italic">Gathering wellness patterns...</p>
                )}
              </div>
              <div className={`bg-gray-800 rounded-2xl p-6 border ${injuryRisk?.risk_level === 'red' ? 'border-rose-500/30' : 'border-gray-700'}`}>
                <p className="text-gray-500 text-[10px] font-black uppercase mb-3 px-1">🛡️ Injury Prediction</p>
                {injuryRisk ? (
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <p className={`text-2xl font-black ${injuryRisk.risk_level === 'red' ? 'text-rose-400' : injuryRisk.risk_level === 'yellow' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {injuryRisk.risk_level?.toUpperCase()}
                      </p>
                      <p className="text-gray-500 text-[10px] font-bold">SCORE: {injuryRisk.injury_risk_score}/100</p>
                    </div>
                    <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${injuryRisk.risk_level === 'red' ? 'bg-rose-500' : injuryRisk.risk_level === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${injuryRisk.injury_risk_score}%` }} />
                    </div>
                    {injuryRisk.verdict && <p className="text-gray-400 text-xs mt-4 leading-relaxed">{injuryRisk.verdict}</p>}
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

            {/* Wellness metrics chart */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6">Recent Wellness Metrics</h2>
              {filteredHistory.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center">
                  <p className="text-gray-600 text-sm italic">No data to display.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={filteredHistory}>
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
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-sm font-black uppercase tracking-tight mb-6">Recent Training Sessions</h2>
              {trainingLogs.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-10 italic">No logs on record.</p>
              ) : (
                <div className="space-y-4">
                  {trainingLogs.slice(0, 10).map((log, i) => (
                    <div key={i} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 hover:border-gray-500 transition">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-blue-400 uppercase">{log.intensity} Intensity</span>
                        <span className="text-[10px] font-bold text-gray-600 uppercase">{new Date(log.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-gray-400 mb-1">RPE: {log.rpe}/10</p>
                          <p className="text-white font-black text-sm">{log.duration} mins</p>
                        </div>
                      </div>
                      {log.coach_notes && (
                        <p className="text-[11px] text-gray-500 mt-2 italic leading-relaxed pt-2 border-t border-gray-700">
                          "{log.coach_notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* All Wellness Logs */}
        <div className="mt-10 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-8">All Wellness Logs</h2>
          {history.length === 0 ? (
            <p className="text-gray-600 text-sm italic text-center py-8">No check-ins recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {[...history].reverse().map((entry, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="text-gray-500 text-[10px] font-bold w-12 pt-2 uppercase">{entry.date}</div>
                  <div className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      {[
                        { key: 'energy', color: 'text-blue-400', label: 'Energy' },
                        { key: 'sleep', color: 'text-indigo-400', label: 'Sleep' },
                        { key: 'soreness', color: 'text-rose-400', label: 'Soreness' },
                        { key: 'mood', color: 'text-amber-400', label: 'Mood' },
                      ].map(m => (
                        <div key={m.key}>
                          <p className={`${m.color} font-black`}>{entry[m.key]}</p>
                          <p className="text-gray-600 text-[8px] uppercase font-bold">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    {entry.notes && (
                      <p className="text-gray-400 text-xs mt-3 border-t border-gray-800 pt-2 italic">"{entry.notes}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance */}
        <div className="mt-10 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">📅 Attendance (Last 30 Days)</h2>
            {attendanceLog.length > 0 && (
              <span className="text-xs font-black text-emerald-400">
                {Math.round((attendanceLog.filter(a => a.status === 'present').length / attendanceLog.length) * 100)}% attendance rate
              </span>
            )}
          </div>
          {attendanceLog.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-4">No attendance logged yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attendanceLog.map((a, i) => (
                <div key={i} className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center ${a.status === 'present' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'
                  }`}>
                  <span className={`text-xs font-black ${a.status === 'present' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {a.status === 'present' ? '✓' : '✗'}
                  </span>
                  <span className="text-gray-500 text-[9px] mt-0.5">
                    {new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Injury History */}
        <div className="mt-10 bg-gray-800 rounded-2xl p-6 border border-gray-700 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">🩹 Injury History</h2>
            <button onClick={() => setShowInjuryModal(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-black px-4 py-2 rounded-xl transition">
              + Log Injury
            </button>
          </div>
          {injuries.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-4">No injuries logged yet.</p>
          ) : (
            <div className="space-y-3">
              {injuries.map(inj => (
                <div key={inj.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-white font-black text-sm">{inj.body_part} — {inj.injury_type}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{inj.date_occurred}</p>
                      {inj.notes && <p className="text-gray-400 text-xs mt-1 italic">"{inj.notes}"</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-black px-3 py-1 rounded-full border ${inj.severity === 'severe' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                        inj.severity === 'moderate' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                          'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>{inj.severity.toUpperCase()}</span>
                      <select value={inj.status}
                        onChange={e => handleUpdateInjuryStatus(inj.id, e.target.value, inj.notes)}
                        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs font-bold px-2 py-1 rounded-lg focus:outline-none">
                        <option value="active">Active</option>
                        <option value="recovering">Recovering</option>
                        <option value="cleared">Cleared</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Injury Modal */}
      {showInjuryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowInjuryModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="text-white font-black text-lg">Log Injury</h2>
              <button onClick={() => setShowInjuryModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">Body Part</p>
                <select value={injuryForm.body_part}
                  onChange={e => setInjuryForm(f => ({ ...f, body_part: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-rose-500">
                  {['Knee', 'Ankle', 'Shoulder', 'Hamstring', 'Back', 'Groin', 'Wrist', 'Other'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">Injury Type</p>
                <select value={injuryForm.injury_type}
                  onChange={e => setInjuryForm(f => ({ ...f, injury_type: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-rose-500">
                  {['Sprain', 'Strain', 'Fracture', 'Bruise', 'Overuse', 'Other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Severity</p>
              <div className="flex gap-2">
                {['mild', 'moderate', 'severe'].map(s => (
                  <button key={s} onClick={() => setInjuryForm(f => ({ ...f, severity: s }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition border ${injuryForm.severity === s
                      ? s === 'severe' ? 'bg-rose-600 border-rose-500 text-white'
                        : s === 'moderate' ? 'bg-amber-600 border-amber-500 text-white'
                          : 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-gray-700 text-gray-500 hover:border-gray-500'
                      }`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">Date Occurred</p>
              <input type="date" value={injuryForm.date_occurred}
                onChange={e => setInjuryForm(f => ({ ...f, date_occurred: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-rose-500" />
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">Notes (optional)</p>
              <textarea rows={2} value={injuryForm.notes}
                onChange={e => setInjuryForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Happened during sprint drill..."
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-rose-500 resize-none placeholder-gray-600" />
            </div>
            <button onClick={handleLogInjury} disabled={savingInjury}
              className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition">
              {savingInjury ? 'Saving...' : 'Log Injury →'}
            </button>
          </div>
        </div>
      )}

      {showBulkModal && (
        <BulkLogModal athletes={singleAthleteList} onClose={() => setShowBulkModal(false)} onSuccess={() => fetchData(false)} />
      )}
      {showWeeklyReport && (
        <WeeklyReport athleteName={name} academyId={academyId} onClose={() => setShowWeeklyReport(false)} />
      )}
    </div>
  );
}

export default AthleteProfile;