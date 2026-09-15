import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { warmup } from '../api';
import StatCard from '../components/common/StatCard';
import CheckinSignals from '../components/common/CheckinSignals';

const getAcademyId   = () => localStorage.getItem('academyId') || '';
const getAcademyName = () => localStorage.getItem('academyName') || 'Academy';
const norm = s => (s || '').toLowerCase().trim();

const LiveIndicator = () => {
  const [time, setTime] = React.useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }));
  React.useEffect(() => {
    const iv = setInterval(() => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })), 30000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-3 py-1">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live · {time}</span>
    </div>
  );
};

// ── Log Session Modal ─────────────────────────────────────────────────────────

const MUSCLE_OPTIONS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body'];
const WORKOUT_TYPES  = ['Strength', 'Cardio', 'HIIT', 'Flexibility', 'Mobility'];
const DURATIONS      = [30, 45, 60, 90];
const INTENSITIES    = ['Light', 'Moderate', 'Intense'];
const PROGRESSIONS   = ['Lighter', 'Same', 'Heavier'];
const GOAL_PROGRESS  = ['On Track', 'Progressing', 'Needs Attention'];

const PILL_COLORS = {
  Strength: 'purple', Cardio: 'blue', HIIT: 'red', Flexibility: 'green', Mobility: 'amber',
  Light: 'green', Moderate: 'amber', Intense: 'red',
  Lighter: 'blue', Same: 'amber', Heavier: 'purple',
  'On Track': 'green', Progressing: 'blue', 'Needs Attention': 'red',
};

const ACTIVE_CLS = {
  purple: 'border-purple-500/70 bg-purple-500/15 text-purple-300',
  blue:   'border-blue-500/70 bg-blue-500/15 text-blue-300',
  green:  'border-green-500/70 bg-green-500/15 text-green-300',
  amber:  'border-amber-500/70 bg-amber-500/15 text-amber-300',
  red:    'border-red-500/70 bg-red-500/15 text-red-300',
};

// `multi` turns the group into a toggleable set — value is an array and every
// tap adds or removes that option instead of replacing the selection.
function PillGroup({ options, value, onChange, multi = false }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => {
        const active = multi ? value.includes(opt) : value === opt;
        const cls = active ? ACTIVE_CLS[PILL_COLORS[opt] || 'purple'] : 'border-gray-700 text-gray-500 hover:border-gray-600';
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(
              multi
                ? (active ? value.filter(v => v !== opt) : [...value, opt])
                : opt
            )}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${cls}`}>
            {multi && active ? '✓ ' : ''}{opt}
          </button>
        );
      })}
    </div>
  );
}

export function GymLogModal({ member, academyId, onClose, onSaved }) {
  const [muscles, setMuscles]           = useState([]);
  const [workoutTypes, setWorkoutTypes] = useState(['Strength']);
  const [duration, setDuration]         = useState(60);
  const [intensity, setIntensity]       = useState('Moderate');
  const [progression, setProgression]   = useState('Same');
  const [goalProgress, setGoalProgress] = useState('On Track');
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState('');

  const toggleMuscle = mg =>
    setMuscles(prev => prev.includes(mg) ? prev.filter(x => x !== mg) : [...prev, mg]);

  const handleSave = async () => {
    if (!muscles.length || !workoutTypes.length) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.post(`/wellness?academy_id=${academyId}`, {
        athlete_name:  member.name,
        muscle_groups: muscles,
        workout_type:  workoutTypes.join(', '),
        session_duration: duration,
        intensity,
        progression,
        goal_progress: goalProgress,
        notes:         notes.trim() || null,
        logged_by:     'trainer',
      });
      // Wait for the dashboard to pull the new session in before closing, so the
      // trainer lands back on a list that already shows what they just logged.
      await onSaved();
      onClose();
    } catch (err) {
      console.error('Session log failed:', err);
      setSaveError('Could not save the session. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl p-7 my-4"
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-white font-black text-xl">Log Session</h3>
            <p className="text-gray-500 text-sm mt-0.5">{member.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2.5">
              Body Part Trained <span className="text-red-400">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_OPTIONS.map(mg => (
                <button key={mg} type="button" onClick={() => toggleMuscle(mg)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${muscles.includes(mg) ? ACTIVE_CLS.blue : 'border-gray-700 text-gray-500 hover:border-gray-600'}`}>
                  {mg}
                </button>
              ))}
            </div>
            {!muscles.length && <p className="text-gray-600 text-[10px] mt-1.5">Select at least one</p>}
          </div>

          <div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2.5">
              Workout Type <span className="text-red-400">*</span>
              <span className="text-gray-600 font-bold normal-case tracking-normal"> · pick one or more</span>
            </p>
            <PillGroup options={WORKOUT_TYPES} value={workoutTypes} onChange={setWorkoutTypes} multi />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2.5">Duration</p>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map(d => (
                  <button key={d} type="button" onClick={() => setDuration(d)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${duration === d ? ACTIVE_CLS.green : 'border-gray-700 text-gray-500 hover:border-gray-600'}`}>
                    {d}m
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2.5">Intensity</p>
              <PillGroup options={INTENSITIES} value={intensity} onChange={setIntensity} />
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2.5">Weight vs Last Session</p>
            <PillGroup options={PROGRESSIONS} value={progression} onChange={setProgression} />
          </div>

          <div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2.5">Goal Progress</p>
            <PillGroup options={GOAL_PROGRESS} value={goalProgress} onChange={setGoalProgress} />
          </div>

          <div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2.5">
              Trainer Notes <span className="text-gray-600 font-normal normal-case tracking-normal">(optional)</span>
            </p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="PB hit, form issue, injury flag, anything to remember..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition resize-none text-sm" />
          </div>
        </div>

        {saveError && (
          <div className="mt-5 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            <p className="text-rose-400 text-sm font-bold">⚠️ {saveError}</p>
          </div>
        )}

        <button onClick={handleSave} disabled={saving || !muscles.length || !workoutTypes.length}
          className="w-full mt-7 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-4 rounded-xl font-black text-base transition">
          {saving ? 'Saving...' : 'Save Session ✓'}
        </button>
      </div>
    </div>
  );
}

// ── Main Trainer Dashboard ────────────────────────────────────────────────────

export default function GymTrainerDashboard() {
  const navigate   = useNavigate();
  const academyId  = getAcademyId();

  const [members, setMembers]               = useState([]);
  const [checkins, setCheckins]             = useState([]);
  const [trainerLogs, setTrainerLogs]       = useState([]);
  const [attendance, setAttendance]         = useState({});
  const [markingAtt, setMarkingAtt]         = useState({});
  const [logModal, setLogModal]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [menuOpen, setMenuOpen]             = useState(false);

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [membRes, checkinRes, logRes, attRes] = await Promise.allSettled([
        api.get('/athletes', { params: { academy_id: academyId } }),
        // Same endpoint the sport dashboard uses — today's check-ins for this academy.
        api.get('/wellness', { params: { academy_id: academyId } }),
        api.get('/wellness/all', { params: { academy_id: academyId } }),
        api.get('/attendance/today', { params: { academy_id: academyId } }),
      ]);
      if (membRes.status === 'fulfilled') setMembers(membRes.value.data || []);
      if (checkinRes.status === 'fulfilled') {
        const rows = checkinRes.value.data?.checkins || checkinRes.value.data || [];
        setCheckins(Array.isArray(rows) ? rows : []);
      }
      if (logRes.status === 'fulfilled') {
        setTrainerLogs(logRes.value.data?.checkins || logRes.value.data || []);
      }
      // Attendance has to be read back, not just written, or marks vanish on
      // refresh and "Absent Today" stays stuck at zero.
      if (attRes.status === 'fulfilled') {
        const map = {};
        (attRes.value.data || []).forEach(a => { map[norm(a.athlete_name)] = a.status; });
        setAttendance(map);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    if (!academyId) { navigate('/'); return; }
    warmup().then(() => fetchData());
    const iv = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(iv);
  }, [academyId, navigate, fetchData]);

  const handleLogout = () => {
    // Match the sport dashboard: sign out of the trainer session but stay inside
    // the academy, so Logout lands on the academy portal rather than kicking the
    // user all the way out to academy selection.
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('unlocked_')) sessionStorage.removeItem(key);
    });
    ['role', 'athleteName', 'athleteSport', 'coachSport', 'parentChildName', 'userId', 'coachId']
      .forEach(k => localStorage.removeItem(k));
    navigate('/login');
  };

  const markAttendance = async (member, status) => {
    const key = norm(member.name);
    setMarkingAtt(p => ({ ...p, [key]: true }));
    try {
      // academy_id goes in the body — POST /attendance reads it from the payload,
      // not the query string, so a query param silently wrote a null-academy row.
      await api.post(`/attendance`, {
        academy_id: academyId,
        athlete_name: member.name,
        status,
        date: new Date().toISOString().slice(0, 10),
      });
      setAttendance(p => ({ ...p, [key]: status }));
    } catch (err) {
      console.error('Attendance error:', err);
    } finally {
      setMarkingAtt(p => ({ ...p, [key]: false }));
    }
  };

  const getLatestCheckin = name => checkins.find(c => norm(c.athlete_name) === norm(name) && !c.logged_by);
  // Trainer logs come from the all-time endpoint, so the last session still shows
  // on a day the trainer hasn't logged anything yet.
  const getLastTrainerLog = name => trainerLogs.find(c => norm(c.athlete_name) === norm(name));

  const todayStr = new Date().toISOString().slice(0, 10);
  const checkedInToday   = members.filter(m => getLatestCheckin(m.name)).length;
  const absentToday      = Object.values(attendance).filter(s => s === 'absent').length;
  const sessionsLoggedToday = trainerLogs.filter(l => (l.created_at || '').slice(0, 10) === todayStr).length;

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight">AthleteIQ</h1>
                <LiveIndicator />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
                  Trainer
                </span>
                <span className="bg-gray-800 border border-gray-700 text-gray-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
                  {getAcademyName()}
                </span>
              </div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{dateLabel}</p>
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(o => !o)}
              className="sm:hidden flex flex-col gap-1.5 p-2 rounded-xl bg-gray-800 border border-gray-700 shrink-0 mt-1">
              <span className={`block w-5 h-0.5 bg-gray-400 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-400 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-400 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex gap-2 flex-wrap">
            <Link to="/athletes"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              Manage Members
            </Link>
            <Link to="/gym-training-log"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              📒 Training Log
            </Link>
            <Link to="/session-planner"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              📋 Session Planner
            </Link>
            <Link to="/meditation"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              🧘 Meditate
            </Link>
            <Link to="/messages"
              className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              💬 Messages
            </Link>
            <button onClick={handleLogout}
              className="text-rose-500 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-rose-500/10 transition-all">
              Logout
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="sm:hidden mt-3 flex flex-col gap-2">
              <Link to="/athletes" className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center" onClick={() => setMenuOpen(false)}>Manage Members</Link>
              <Link to="/gym-training-log" className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center" onClick={() => setMenuOpen(false)}>📒 Training Log</Link>
              <Link to="/session-planner" className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center" onClick={() => setMenuOpen(false)}>📋 Session Planner</Link>
              <Link to="/meditation" className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center" onClick={() => setMenuOpen(false)}>🧘 Meditate</Link>
              <Link to="/messages" className="bg-gray-800 text-white px-5 py-3 rounded-xl text-sm font-bold text-center" onClick={() => setMenuOpen(false)}>💬 Messages</Link>
              <button onClick={handleLogout} className="text-rose-500 font-bold px-5 py-3 rounded-xl text-sm border border-rose-500/20">Logout</button>
            </div>
          )}
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Members"    value={members.length}  color="text-white" />
          <StatCard label="Checked In Today" value={checkedInToday}  color="text-emerald-400" />
          <StatCard label="Absent Today"     value={absentToday}     color="text-rose-400" />
          <StatCard label="Sessions Logged"  value={sessionsLoggedToday} color="text-purple-400" />
        </div>

        {/* ── Members List ── */}
        <div className="mb-4">
          <h2 className="text-white font-black text-xl tracking-tight">
            MEMBERS{' '}
            <span className="text-gray-600 font-bold text-sm">{members.length} members · {checkedInToday} checked in</span>
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
            <p className="text-gray-400 font-bold mb-2">No members yet</p>
            <p className="text-gray-600 text-sm mb-6">Add your first gym member to get started.</p>
            <Link to="/athletes"
              className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition">
              Add Members →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {members.map(member => {
              const checkin    = getLatestCheckin(member.name);
              const trainerLog = getLastTrainerLog(member.name);
              const key        = norm(member.name);
              const attStatus  = attendance[key];
              const marking    = markingAtt[key];
              const isCheckedIn = !!checkin;

              const goalColor = trainerLog?.goal_progress === 'On Track' ? 'text-emerald-400'
                : trainerLog?.goal_progress === 'Progressing' ? 'text-blue-400'
                : trainerLog?.goal_progress === 'Needs Attention' ? 'text-amber-400'
                : 'text-gray-500';

              return (
                <div key={member.id}
                  className="bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-700 transition-all hover:border-gray-600">

                  {/* ── Top row: avatar + name + score box + badge ── */}
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <div
                      className="flex items-center gap-3 min-w-0 cursor-pointer group"
                      onClick={() => navigate(`/athlete/${encodeURIComponent(member.name)}`)}
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black text-lg shrink-0">
                        {member.name[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-white truncate group-hover:text-purple-400 transition-colors">
                          {member.name}
                        </h3>
                        <p className="text-gray-500 text-xs font-bold uppercase mt-0.5">
                          Gym Member{member.sport ? ` · ${member.sport}` : ''}{member.age ? ` · Age ${member.age}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {trainerLog?.goal_progress && isCheckedIn && (
                        <div className="text-center bg-gray-900 rounded-xl px-3 py-1.5 border border-gray-700">
                          <p className={`text-xl sm:text-2xl font-black ${goalColor}`}>
                            {trainerLog.goal_progress === 'On Track' ? '✓' : trainerLog.goal_progress === 'Progressing' ? '↑' : '!'}
                          </p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase">
                            {trainerLog.goal_progress === 'On Track' ? 'On Track' : trainerLog.goal_progress === 'Progressing' ? 'Progress' : 'Attention'}
                          </p>
                        </div>
                      )}
                      {isCheckedIn ? (
                        <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg">
                          ✓ Checked In
                        </span>
                      ) : (
                        <span className="bg-gray-700/30 border border-gray-700 text-gray-500 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg">
                          Not Checked In
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Wellness tiles (matching sport dashboard grid style) ── */}
                  {isCheckedIn ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: 'Energy',   val: checkin?.energy,   color: 'bg-blue-500' },
                        { label: 'Sleep',    val: checkin?.sleep,    color: 'bg-indigo-500' },
                        { label: 'Soreness', val: checkin?.soreness, color: 'bg-rose-500' },
                        { label: 'Mood',     val: checkin?.mood,     color: 'bg-amber-500' },
                      ].map(m => (
                        <div key={m.label} className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
                          <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                            <span>{m.label}</span>
                            <span className="text-gray-400">{m.val != null ? `${m.val}/10` : '—'}</span>
                          </div>
                          <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-1 overflow-hidden">
                            {m.val != null && (
                              <div className={`h-full rounded-full transition-all duration-1000 ease-out ${m.color}`}
                                style={{ width: `${m.val * 10}%` }} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-900/50 rounded-xl px-4 py-3 mb-4 border border-dashed border-gray-700 flex items-center gap-3">
                      <span className="text-gray-600">⏳</span>
                      <p className="text-gray-500 text-xs">No check-in today — remind {member.name.split(' ')[0]}.</p>
                    </div>
                  )}

                  <CheckinSignals analysis={checkin?.text_analysis} />


                  {/* ── Attendance row ── */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Attendance:</span>
                    <button onClick={() => markAttendance(member, 'present')} disabled={marking}
                      className={`text-[10px] font-black px-3 py-1 rounded-lg border transition ${attStatus === 'present' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-gray-700 text-gray-600 hover:border-emerald-500/40 hover:text-emerald-400'}`}>
                      ✓ Present
                    </button>
                    <button onClick={() => markAttendance(member, 'absent')} disabled={marking}
                      className={`text-[10px] font-black px-3 py-1 rounded-lg border transition ${attStatus === 'absent' ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'border-gray-700 text-gray-600 hover:border-rose-500/40 hover:text-rose-400'}`}>
                      ✗ Absent
                    </button>
                    {attStatus && (
                      <span className={`text-[10px] font-black uppercase tracking-widest ${attStatus === 'present' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {attStatus === 'present' ? '✓ Marked Present' : '✗ Marked Absent'}
                      </span>
                    )}
                    {marking && <span className="text-gray-600 text-[10px]">saving...</span>}
                  </div>

                  {/* ── Last session pills (equivalent of ACWR + baseline row) ── */}
                  {trainerLog && (
                    <div className="flex items-center gap-3 flex-wrap mt-3">
                      {trainerLog.workout_type && (
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg">
                          {trainerLog.workout_type}
                        </span>
                      )}
                      {trainerLog.session_duration && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-900 border border-gray-700 px-2 py-0.5 rounded-lg">
                          {trainerLog.session_duration} min
                        </span>
                      )}
                      {trainerLog.intensity && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                          trainerLog.intensity === 'Intense' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          : trainerLog.intensity === 'Moderate' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        }`}>
                          {trainerLog.intensity}
                        </span>
                      )}
                      {trainerLog.muscle_groups?.map(mg => (
                        <span key={mg} className="text-[10px] font-bold text-gray-400 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-lg">
                          {mg}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ── Log Session button ── */}
                  <button onClick={() => setLogModal(member)}
                    className="w-full mt-3 border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 py-2 rounded-xl text-xs font-black transition">
                    + Log Session
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Session Modal */}
      {logModal && (
        <GymLogModal
          member={logModal}
          academyId={academyId}
          onClose={() => setLogModal(null)}
          onSaved={() => fetchData(true)}
        />
      )}
    </div>
  );
}
