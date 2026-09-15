import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import logo from '../assets/athleteiq_logo.svg';

const getAcademyId = () => localStorage.getItem('academyId') || '';

const INTENSITY_COLORS = {
  Light:    'bg-green-500/10 border-green-500/20 text-green-400',
  Moderate: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  Intense:  'bg-red-500/10 border-red-500/20 text-red-400',
};

const GOAL_COLORS = {
  'On Track':        'bg-green-500/10 border-green-500/20 text-green-400',
  'Progressing':     'bg-blue-500/10 border-blue-500/20 text-blue-400',
  'Needs Attention': 'bg-amber-500/10 border-amber-500/20 text-amber-400',
};

const PROGRESSION_COLORS = {
  Heavier: 'text-purple-400',
  Same:    'text-gray-400',
  Lighter: 'text-blue-400',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function GymTrainingLog() {
  const navigate  = useNavigate();
  const academyId = getAcademyId();

  const [logs, setLogs]           = useState([]);
  const [members, setMembers]     = useState([]);
  const [filter, setFilter]       = useState('all');
  const [loading, setLoading]     = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [membRes, logRes] = await Promise.allSettled([
        api.get('/athletes', { params: { academy_id: academyId } }),
        api.get('/wellness/all', { params: { academy_id: academyId } }),
      ]);

      if (membRes.status === 'fulfilled') setMembers(membRes.value.data || []);

      if (logRes.status === 'fulfilled') {
        const all = logRes.value.data?.checkins || logRes.value.data || [];
        const trainerLogs = all
          .filter(c => c.logged_by === 'trainer')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setLogs(trainerLogs);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    if (!academyId) { navigate('/'); return; }
    fetchLogs();
  }, [academyId, navigate, fetchLogs]);

  const filtered = filter === 'all'
    ? logs
    : logs.filter(l => (l.athlete_name || '').toLowerCase() === filter.toLowerCase());

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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img src={logo} alt="AthleteIQ" className="h-7 w-auto opacity-80 cursor-pointer"
                onClick={() => navigate('/gym-dashboard')} />
              <span className="bg-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-purple-500/30">
                Training Log
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-2">
              All sessions logged · {logs.length} total
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/gym-dashboard"
              className="border border-gray-600 text-gray-400 px-4 py-2 rounded-xl text-sm hover:border-purple-500 hover:text-purple-400 transition">
              ← Dashboard
            </Link>
            <button onClick={handleLogout}
              className="text-rose-500 font-bold px-4 py-2 rounded-xl text-sm hover:bg-rose-500/10 transition">
              Logout
            </button>
          </div>
        </div>

        {/* Member filter tabs */}
        {members.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            <button onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${filter === 'all' ? 'border-purple-500/70 bg-purple-500/15 text-purple-300' : 'border-gray-700 text-gray-500 hover:border-gray-600'}`}>
              All Members
            </button>
            {members.map(m => (
              <button key={m.id} onClick={() => setFilter(m.name)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${filter === m.name ? 'border-purple-500/70 bg-purple-500/15 text-purple-300' : 'border-gray-700 text-gray-500 hover:border-gray-600'}`}>
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Log entries */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
            <p className="text-gray-400 font-bold mb-1">No sessions logged yet</p>
            <p className="text-gray-600 text-sm">
              Use the "+ Log Session" button on a member card to log your first session.
            </p>
            <Link to="/gym-dashboard"
              className="inline-block mt-6 bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition">
              Go to Dashboard →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((log, i) => (
              <div key={i}
                className="bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-2xl p-5 transition">

                {/* Top row: member + date */}
                <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-white font-black text-base">{log.athlete_name}</h3>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {log.workout_type && (
                      <span className="text-xs font-bold bg-purple-500/15 text-purple-300 px-3 py-1 rounded-lg border border-purple-500/20">
                        {log.workout_type}
                      </span>
                    )}
                    {log.session_duration && (
                      <span className="text-xs font-bold bg-gray-700 text-gray-300 px-3 py-1 rounded-lg">
                        {log.session_duration} min
                      </span>
                    )}
                  </div>
                </div>

                {/* Body parts */}
                {log.muscle_groups?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">Body Part Trained</p>
                    <div className="flex flex-wrap gap-1.5">
                      {log.muscle_groups.map(mg => (
                        <span key={mg}
                          className="text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                          {mg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {log.intensity && (
                    <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/50">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Intensity</p>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${INTENSITY_COLORS[log.intensity] || 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                        {log.intensity}
                      </span>
                    </div>
                  )}
                  {log.progression && (
                    <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/50">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Weight</p>
                      <p className={`text-sm font-black ${PROGRESSION_COLORS[log.progression] || 'text-gray-400'}`}>
                        {log.progression}
                      </p>
                    </div>
                  )}
                  {log.goal_progress && (
                    <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/50">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Goal Progress</p>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${GOAL_COLORS[log.goal_progress] || 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                        {log.goal_progress}
                      </span>
                    </div>
                  )}
                </div>

                {/* Trainer notes */}
                {log.notes && (
                  <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-3">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Trainer Notes</p>
                    <p className="text-gray-300 text-sm italic">"{log.notes}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
