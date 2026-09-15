import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import SessionPlanOutput from '../components/SessionPlanOutput';
import TopLoader from '../components/common/TopLoader';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const API = API_BASE_URL;
const getAcademyId = () => localStorage.getItem('academyId') || '';
const getCoachId = () =>
  localStorage.getItem('userId') ||
  localStorage.getItem('coachId') ||
  'coach_' + (localStorage.getItem('academyId') || 'default');
const getCoachSport = () => localStorage.getItem('coachSport') || null;
const getAcademyType = () => localStorage.getItem('academyType') || 'sport';

const FOCUS_OPTIONS = ['Fitness', 'Skill', 'Tactical', 'Match Prep', 'Recovery'];
const GYM_FOCUS_OPTIONS = ['Strength', 'Hypertrophy', 'Cardio', 'HIIT', 'Flexibility', 'Recovery'];
const DURATION_OPTIONS = [45, 60, 75, 90];
const MATCH_OPTIONS = [
  { label: 'No match', value: 'no_match' },
  { label: 'Match in 3+ days', value: 'match_3plus' },
  { label: 'Match tomorrow', value: 'match_tomorrow' },
  { label: 'Match today', value: 'match_today' },
];
const MUSCLE_OPTIONS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body'];

// ── Squad Banner ──────────────────────────────────────────────────────────────
function SquadBanner({ summary }) {
  if (!summary) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 mb-6">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">Squad avg readiness today:</span>
        <span className={`text-lg font-black ${summary.avgReadiness >= 70 ? 'text-green-400' :
          summary.avgReadiness >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>{summary.avgReadiness}/100</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {summary.restCount > 0 && (
          <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-lg text-xs font-bold">
            🔴 {summary.restCount} rest
          </span>
        )}
        {summary.modifiedCount > 0 && (
          <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg text-xs font-bold">
            🟡 {summary.modifiedCount} modified
          </span>
        )}
        {summary.pushCount > 0 && (
          <span className="bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1 rounded-lg text-xs font-bold">
            🟢 {summary.pushCount} push
          </span>
        )}
        {summary.restCount === 0 && summary.modifiedCount === 0 && summary.pushCount === 0 && (
          <span className="bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1 rounded-lg text-xs font-bold">
            ✅ Full squad cleared
          </span>
        )}
      </div>
    </div>
  );
}

// ── Chip Button ───────────────────────────────────────────────────────────────
function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${active
        ? 'bg-purple-600 border-purple-500 text-white'
        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-purple-500/50 hover:text-purple-400'
        }`}
    >
      {label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SessionPlannerPage() {
  const navigate = useNavigate();
  const academyId = getAcademyId();
  const coachId = getCoachId();
  const coachSport = getCoachSport();
  const isGym = getAcademyType() === 'gym';

  // Form state
  const [focus, setFocus] = useState('');
  const [duration, setDuration] = useState(60);
  const [specificArea, setSpecificArea] = useState('');
  const [matchProximity, setMatchProximity] = useState('no_match');
  const [targetMuscles, setTargetMuscles] = useState([]);

  // Gym member picker state
  const [allMembers, setAllMembers] = useState([]);
  const [primaryMember, setPrimaryMember] = useState('');
  const [extraMembers, setExtraMembers] = useState([]);
  const [showExtraPicker, setShowExtraPicker] = useState(false);

  // Data state
  const [squadSummary, setSquadSummary] = useState(null);
  const [loadingSquad, setLoadingSquad] = useState(true);

  // Plan state
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Load members / squad summary on mount ─────────────────────────────────
  useEffect(() => {
    const loadSquad = async () => {
      try {
        const res = await axios.get(`${API}/athletes`, {
          params: { academy_id: academyId }
        });

        const athletes = coachSport
          ? res.data.filter(a =>
            (a.sport || '').toLowerCase() === coachSport.toLowerCase()
          )
          : res.data;

        if (isGym) {
          setAllMembers(athletes);
          setLoadingSquad(false);
          return;
        }

        // Sport: load insights to compute readiness flags
        const insightResults = await Promise.allSettled(
          athletes.map(a =>
            axios.get(`${API}/ai/insights/${encodeURIComponent(a.name)}`, {
              params: { academy_id: academyId }
            })
          )
        );

        let restCount = 0, modifiedCount = 0, pushCount = 0;
        let totalReadiness = 0;

        insightResults.forEach(result => {
          if (result.status === 'fulfilled') {
            const score = result.value.data?.score ?? 50;
            const risk = result.value.data?.risk ?? 'unknown';
            totalReadiness += score;
            if (score < 45 || risk === 'red') restCount++;
            else if (score < 62 || risk === 'yellow') modifiedCount++;
            else if (score >= 85) pushCount++;
          }
        });

        setSquadSummary({
          total: athletes.length,
          avgReadiness: athletes.length
            ? Math.round(totalReadiness / athletes.length)
            : 0,
          restCount,
          modifiedCount,
          pushCount,
        });
      } catch (err) {
        console.error('Failed to load squad summary:', err);
      } finally {
        setLoadingSquad(false);
      }
    };

    loadSquad();
  }, [academyId, coachSport, isGym]);

  // ── Generate plan ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!focus) return;
    if (isGym && !primaryMember) { setError('Select a member to plan for.'); return; }
    setLoading(true);
    setError('');

    const selectedMembers = isGym
      ? [primaryMember, ...extraMembers].filter(Boolean)
      : null;

    try {
      const res = await axios.post(`${API}/session-planner/generate`, {
        coach_id: coachId,
        academy_id: academyId,
        coach_input: {
          focus,
          duration,
          specific_area: isGym ? (targetMuscles.length > 0 ? targetMuscles.join(', ') : null) : (specificArea || null),
          match_proximity: isGym ? 'no_match' : matchProximity,
          ...(isGym && { academy_type: 'gym', member_names: selectedMembers }),
        }
      });

      if (res.data.status === 'rate_limited') {
        setError(res.data.message);
        return;
      }
      if (res.data.status === 'trial_expired') {
        setError('Your 14-day free trial has expired. Contact us to upgrade.');
        return;
      }
      if (res.data.status === 'error') {
        setError(res.data.message || 'Something went wrong. Please try again.');
        return;
      }

      setPlan(res.data.plan);
    } catch (err) {
      setError('Failed to generate session plan. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state (only show skeleton for sport — gym is instant) ─────────
  if (loadingSquad && !isGym) return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-8">
      <TopLoader loading={loadingSquad} />
      <div className="max-w-4xl mx-auto">
        <LoadingSkeleton type="session-planner" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-8">
      <TopLoader loading={loading || loadingSquad} />
      <div className="max-w-4xl mx-auto">

        {/* Page Header */}
        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black tracking-tight">Session Planner</h1>
              {coachSport && (
                <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
                  {coachSport} only
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {isGym
                ? `AI-generated 1-to-1 workout plans · ${allMembers.length} members`
                : `AI-generated session plans · ${squadSummary?.total ?? 0} athletes`}
            </p>
          </div>
          <div className="flex gap-2">
            {isGym && (
              <button onClick={() => navigate('/gym-training-log')}
                className="border border-gray-600 text-gray-400 px-4 py-2 rounded-xl text-sm hover:border-purple-500 hover:text-purple-400 transition">
                📒 Training Log
              </button>
            )}
            <button
              onClick={() => navigate(isGym ? '/gym-dashboard' : '/dashboard')}
              className="border border-gray-600 text-gray-400 px-4 py-2 rounded-xl text-sm hover:border-blue-500 hover:text-blue-400 transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {/* Gym: member picker | Sport: squad banner */}
        {isGym ? (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 mb-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
              Who are you training? <span className="text-red-400">*</span>
            </label>
            <select
              value={primaryMember}
              onChange={e => setPrimaryMember(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition text-sm"
            >
              <option value="">— Select a member —</option>
              {allMembers.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>

            {/* Optional extra members */}
            {primaryMember && (
              <div className="mt-3">
                {extraMembers.map((em, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <select
                      value={em}
                      onChange={e => {
                        const updated = [...extraMembers];
                        updated[i] = e.target.value;
                        setExtraMembers(updated);
                      }}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition text-sm"
                    >
                      <option value="">— Select member —</option>
                      {allMembers.filter(m => m.name !== primaryMember && !extraMembers.includes(m.name)).map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <button onClick={() => setExtraMembers(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-500 hover:text-red-400 text-sm px-2">✕</button>
                  </div>
                ))}
                {extraMembers.length < 3 && (
                  <button onClick={() => setExtraMembers(prev => [...prev, ''])}
                    className="text-xs font-bold text-purple-400 hover:text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg transition mt-1">
                    + Add another member
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <SquadBanner summary={squadSummary} />
        )}

        {/* Plan Output — shown after generation */}
        {plan ? (
          <SessionPlanOutput
            plan={plan}
            onReset={() => { setPlan(null); setError(''); }}
            squadSummary={squadSummary}
          />
        ) : (

          /* ── Setup Form ── */
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex flex-col gap-7">

            {/* Focus */}
            <div>
              <label className="block text-sm font-black text-gray-300 uppercase tracking-widest mb-3">
                Session Focus <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {(isGym ? GYM_FOCUS_OPTIONS : FOCUS_OPTIONS).map(f => (
                  <Chip key={f} label={f} active={focus === f} onClick={() => setFocus(f)} />
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-black text-gray-300 uppercase tracking-widest mb-3">
                Duration
              </label>
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map(d => (
                  <Chip key={d} label={`${d} min`} active={duration === d} onClick={() => setDuration(d)} />
                ))}
              </div>
            </div>

            {/* Gym: target muscles | Sport: specific area */}
            {isGym ? (
              <div>
                <label className="block text-sm font-black text-gray-300 uppercase tracking-widest mb-3">
                  Target Muscle Groups{' '}
                  <span className="text-gray-500 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {MUSCLE_OPTIONS.map(mg => (
                    <button key={mg} type="button"
                      onClick={() => setTargetMuscles(prev =>
                        prev.includes(mg) ? prev.filter(x => x !== mg) : [...prev, mg]
                      )}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${targetMuscles.includes(mg)
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-purple-500/50 hover:text-purple-400'}`}>
                      {mg}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-black text-gray-300 uppercase tracking-widest mb-3">
                  Anything specific to work on?{' '}
                  <span className="text-gray-500 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <input type="text" value={specificArea} onChange={e => setSpecificArea(e.target.value)}
                  placeholder="e.g. backhand clears, set pieces, net play, finishing..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition text-sm"
                />
              </div>
            )}

            {/* Match Proximity — sport only */}
            {!isGym && (
              <div>
                <label className="block text-sm font-black text-gray-300 uppercase tracking-widest mb-3">
                  Match coming up?
                </label>
                <div className="flex gap-2 flex-wrap">
                  {MATCH_OPTIONS.map(m => (
                    <Chip key={m.value} label={m.label} active={matchProximity === m.value} onClick={() => setMatchProximity(m.value)} />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm font-bold">⚠️ {error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!focus || loading}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black text-base transition"
            >
              {loading
                ? '⏳ Building your session plan...'
                : '✨ Generate Session Plan'}
            </button>

            {!focus && (
              <p className="text-gray-600 text-xs text-center -mt-4">
                Select a session focus to continue
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}