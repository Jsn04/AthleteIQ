import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function AthleteDashboard() {
  const navigate = useNavigate();
  const athleteName = localStorage.getItem('athleteName') || '';
  const athleteSport = localStorage.getItem('athleteSport') || '';

  const [history, setHistory] = useState([]);
  const [insight, setInsight] = useState(null);
  const [injuryRisk, setInjuryRisk] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [historyRes, insightRes, injuryRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/wellness/history/${encodeURIComponent(athleteName)}`),
        axios.get(`${API_BASE_URL}/ai/insights/${encodeURIComponent(athleteName)}`),
        axios.get(`${API_BASE_URL}/ai/injury-risk/${encodeURIComponent(athleteName)}`),
      ]);

      const raw = historyRes.data.history.slice().reverse();
      const formatted = raw.map((c, i) => ({
        day: `Day ${i + 1}`,
        date: new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        energy: c.energy,
        sleep: c.sleep,
        soreness: c.soreness,
        mood: c.mood,
      }));

      setHistory(formatted);
      setInsight(insightRes.data);
      setInjuryRisk(injuryRes.data);
    } catch (err) {
      console.error('Error fetching athlete dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [athleteName]);

  useEffect(() => {
    if (!athleteName) {
      navigate('/login');
      return;
    }
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [athleteName, navigate, fetchData]);

  const handleLogout = () => {
    localStorage.removeItem('role');
    localStorage.removeItem('athleteName');
    localStorage.removeItem('athleteSport');
    navigate('/login');
  };

  const avgOf = (key) => {
    if (!history.length) return '—';
    const vals = history.map(h => h[key]).filter(v => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
  };

  if (loading && history.length === 0) return (
    <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
      <LoadingSkeleton type="profile" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Hey {athleteName.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-500 text-xs mt-1 uppercase font-bold tracking-widest leading-relaxed">
              {athleteSport || 'Elite Squad'} · My Wellness Portal
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/checkin')}
              className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-lg active:scale-95 text-sm">
              + Check-in
            </button>
            <button
              onClick={() => navigate('/meditation')}
              className="border border-gray-600 text-gray-500 px-4 py-2.5 rounded-xl font-bold transition hover:border-indigo-500 hover:text-indigo-400 text-xs">
              🧘 Meditate
            </button>
            <button
              onClick={handleLogout}
              className="border border-gray-600 text-gray-400 px-4 py-2.5 rounded-xl font-bold transition hover:border-red-500 hover:text-red-400 text-xs">
              Logout
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-12 text-center border border-dashed border-gray-700">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-2xl font-black text-white mb-2">Ready to start?</h2>
            <p className="text-gray-500 mb-8 font-medium">Submit your first daily check-in to see your performance metrics.</p>
            <button
              onClick={() => navigate('/checkin')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold text-sm transition">
              Launch Check-in
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Readiness Summary */}
            {insight?.score != null && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 flex justify-between items-center group">
                <div className="flex items-center gap-6">
                  <div className="text-center group-hover:scale-105 transition-transform">
                    <p className={`text-5xl font-black leading-none mb-1 ${insight.risk === 'red' ? 'text-rose-400' : 'text-emerald-400'}`}>{insight.score}</p>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Readiness</p>
                  </div>
                  <div className="w-[1px] h-12 bg-gray-700 hidden sm:block" />
                  <div>
                    <p className="text-gray-400 text-xs mb-1 font-bold uppercase tracking-widest">Status Verdict</p>
                    <RiskBadge risk={insight.risk} />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="w-32 bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-700">
                    <div className={`h-full transition-all duration-1000 ${insight.risk === 'red' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${insight.score}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* AI Coach Update */}
            {insight?.athlete_message && insight.athlete_message !== 'No data yet' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 mb-5">
                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">
                  🤖 Today's Tip for You
                </p>
                <p className="text-gray-200 text-sm leading-relaxed italic">"{insight.athlete_message}"</p>
              </div>
            )}

            {/* Summary Averages */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Energy', val: avgOf('energy'), color: 'text-blue-400' },
                { label: 'Sleep', val: avgOf('sleep'), color: 'text-purple-400' },
                { label: 'Soreness', val: avgOf('soreness'), color: 'text-rose-400' },
                { label: 'Mood', val: avgOf('mood'), color: 'text-amber-400' },
              ].map(m => (
                <div key={m.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                  <p className={`text-2xl font-black ${m.color}`}>{m.val}</p>
                  <p className="text-gray-500 text-[10px] uppercase font-bold mt-1">Avg {m.label}</p>
                </div>
              ))}
            </div>

            {/* Performance Trend */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Weekly Progress (Current Snapshot)</h2>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.slice(-7)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }} />
                    <Line type="monotone" dataKey="energy" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Energy" />
                    <Line type="monotone" dataKey="sleep" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Sleep" />
                    <Line type="monotone" dataKey="soreness" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} name="Soreness" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Recent Check-ins</h2>
              <div className="space-y-4">
                {[...history].reverse().slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="text-gray-600 text-[10px] font-bold w-12 pt-1">{entry.date}</div>
                    <div className="flex-1 bg-gray-900/50 rounded-xl p-3 border border-gray-700 transition hover:border-gray-500">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div><p className="text-blue-400 font-bold text-sm">{entry.energy}</p><p className="text-[8px] text-gray-600">ENRG</p></div>
                        <div><p className="text-purple-400 font-bold text-sm">{entry.sleep}</p><p className="text-[8px] text-gray-600">SLEE</p></div>
                        <div><p className="text-rose-400 font-bold text-sm">{entry.soreness}</p><p className="text-[8px] text-gray-600">SORE</p></div>
                        <div><p className="text-amber-400 font-bold text-sm">{entry.mood}</p><p className="text-[8px] text-gray-600">MOOD</p></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default AthleteDashboard;