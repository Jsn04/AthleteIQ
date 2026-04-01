import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://127.0.0.1:8000';
const getAcademyId = () => localStorage.getItem('academyId') || '';

const SPORTS = [
  'Skating', 'Athletics', 'Swimming', 'Badminton', 'Cricket',
  'Football', 'Basketball', 'Wrestling', 'Kabaddi', 'Tennis',
  'Volleyball', 'Boxing', 'Cycling', 'Gymnastics', 'Other'
];

const getCoachSport = () => localStorage.getItem('coachSport') || null;

const RiskBadge = ({ risk, checkedIn }) => {
  if (!checkedIn) return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-700 text-gray-500 border border-gray-600">
      No check-in
    </span>
  );
  const styles = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    unknown: 'bg-gray-700 text-gray-400 border-gray-600',
  };
  const labels = { green: '✅ Low Risk', yellow: '⚠️ Caution', red: '🚨 High Risk', unknown: '—' };
  const key = risk || 'unknown';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${styles[key]}`}>
      {labels[key]}
    </span>
  );
};

const SportIcon = ({ sport }) => {
  const icons = {
    Skating: '⛸️', Athletics: '🏃', Swimming: '🏊', Badminton: '🏸',
    Cricket: '🏏', Football: '⚽', Basketball: '🏀', Wrestling: '🤼',
    Kabaddi: '🤸', Tennis: '🎾', Volleyball: '🏐', Boxing: '🥊',
    Cycling: '🚴', Gymnastics: '🤸', Other: '🏅',
  };
  return <span>{icons[sport] || '🏅'}</span>;
};

function ConfirmModal({ name, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-black text-white mb-2">Remove athlete?</h3>
        <p className="text-gray-400 text-sm mb-6">
          This will permanently remove <span className="text-white font-bold">{name}</span> and all their wellness data.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 border border-gray-600 text-gray-400 py-2.5 rounded-xl text-sm font-bold hover:border-gray-500 hover:text-white transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-black transition">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function AthleteList() {
  const [athletes, setAthletes] = useState([]);
  const [riskMap, setRiskMap] = useState({});
  const [form, setForm] = useState({ name: '', sport: SPORTS[0], age: '' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSport, setFilterSport] = useState('All');
  const navigate = useNavigate();
  const coachSport = getCoachSport();
  const academyId = getAcademyId();

  useEffect(() => {
    if (coachSport) {
      setForm(f => ({ ...f, sport: coachSport }));
      setFilterSport(coachSport);
    }
  }, [coachSport]);

  const fetchAthletes = async () => {
    try {
      const res = await axios.get(`${API}/athletes`, { params: { academy_id: academyId } });
      setAthletes(res.data);
      const risks = await Promise.allSettled(
        res.data.map(a =>
          axios.get(`${API}/ai/injury-risk/${encodeURIComponent(a.name)}`, { params: { academy_id: academyId } })
            .then(r => ({ name: a.name, data: r.data }))
            .catch(() => ({ name: a.name, data: null }))
        )
      );
      const map = {};
      risks.forEach(r => {
        if (r.status === 'fulfilled' && r.value.data) map[r.value.name] = r.value.data;
      });
      setRiskMap(map);
    } catch (err) {
      console.error('Error fetching athletes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAthletes(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleAdd = async () => {
    if (!form.name.trim() || !form.sport.trim()) return;
    setAdding(true);
    try {
      await axios.post(`${API}/athletes?academy_id=${academyId}`, {
        name: form.name.trim(),
        sport: form.sport.trim(),
        age: form.age ? parseInt(form.age) : null,
      });
      setForm({ name: '', sport: coachSport || SPORTS[0], age: '' });
      await fetchAthletes();
    } catch (err) {
      console.error('Error adding athlete:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    setConfirmDelete(null);
    try {
      await axios.delete(`${API}/athletes/${confirmDelete.id}?academy_id=${academyId}`);
      await fetchAthletes();
    } catch (err) {
      console.error('Error deleting athlete:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const norm = (s) => (s || '').trim().toLowerCase();
  const visibleAthletes = coachSport
    ? athletes.filter(a => norm(a.sport) === norm(coachSport))
    : athletes;

  const sportOptions = coachSport
    ? [coachSport]
    : ['All', ...Array.from(new Set(athletes.map(a => a.sport).filter(Boolean)))];

  const filtered = visibleAthletes.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSport = coachSport ? true : (filterSport === 'All' || a.sport === filterSport);
    return matchSearch && matchSport;
  });

  const checkedInCount = visibleAthletes.filter(a => riskMap[a.name]?.risk_level).length;
  const highRiskCount = visibleAthletes.filter(a => riskMap[a.name]?.risk_level === 'red').length;
  const cautionCount = visibleAthletes.filter(a => riskMap[a.name]?.risk_level === 'yellow').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black tracking-tight">Manage Athletes</h1>
              {coachSport && (
                <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
                  {coachSport} only
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {visibleAthletes.length} total · {checkedInCount} checked in today
            </p>
          </div>
          <button onClick={() => navigate('/dashboard')}
            className="border border-gray-600 text-gray-400 px-4 py-2 rounded-xl text-sm hover:border-blue-500 hover:text-blue-400 transition">
            ← Dashboard
          </button>
        </div>

        {visibleAthletes.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-white">{visibleAthletes.length}</p>
              <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">{coachSport || 'Total'}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-red-400">{highRiskCount}</p>
              <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">High Risk</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-yellow-400">{cautionCount}</p>
              <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">Caution</p>
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Add New Athlete</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input type="text" name="name" value={form.name} onChange={handleChange}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Full name"
              className="bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition text-sm"
            />
            <select name="sport" value={form.sport} onChange={handleChange} disabled={!!coachSport}
              className="bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition text-sm appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
              {(coachSport ? [coachSport] : SPORTS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" name="age" value={form.age} onChange={handleChange}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Age (optional)"
              className="bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition text-sm"
            />
          </div>
          <button onClick={handleAdd} disabled={adding || !form.name.trim()}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-black transition text-sm">
            {adding ? 'Adding...' : '+ Add Athlete'}
          </button>
        </div>

        {visibleAthletes.length > 0 && (
          <div className="flex gap-3 mb-4">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search athletes..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
            />
            {!coachSport && (
              <select value={filterSport} onChange={e => setFilterSport(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition text-sm appearance-none cursor-pointer">
                {sportOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Athletes
              <span className="ml-2 bg-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded-full font-normal">
                {filtered.length}
              </span>
            </h2>
            {(searchQuery || (!coachSport && filterSport !== 'All')) && (
              <button onClick={() => { setSearchQuery(''); if (!coachSport) setFilterSport('All'); }}
                className="text-gray-600 hover:text-gray-400 text-xs transition">
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500 text-sm">Loading athletes...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-gray-500 text-sm">
                {visibleAthletes.length === 0
                  ? coachSport ? `No ${coachSport} athletes added yet.` : 'No athletes added yet.'
                  : 'No athletes match your search.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/60">
              {filtered.map(athlete => {
                const risk = riskMap[athlete.name];
                const checkedIn = !!risk?.risk_level;
                return (
                  <div key={athlete.id}
                    onClick={() => navigate(`/athlete/${encodeURIComponent(athlete.name)}`)}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-700/40 transition cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                        {athlete.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-blue-400 transition text-sm">{athlete.name}</p>
                        <p className="text-gray-500 text-xs flex items-center gap-1.5 mt-0.5">
                          <SportIcon sport={athlete.sport} />
                          {athlete.sport}{athlete.age ? ` · Age ${athlete.age}` : ''}
                          {risk?.injury_risk_score != null && (
                            <span className="text-gray-600">· Risk {risk.injury_risk_score}/100</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RiskBadge risk={risk?.risk_level} checkedIn={checkedIn} />
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete({ id: athlete.id, name: athlete.name }); }}
                        disabled={deletingId === athlete.id}
                        className="text-gray-600 hover:text-red-400 disabled:text-gray-700 text-xs border border-gray-700 hover:border-red-500/50 px-3 py-1.5 rounded-lg transition opacity-0 group-hover:opacity-100">
                        {deletingId === athlete.id ? '...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {confirmDelete && (
          <ConfirmModal name={confirmDelete.name} onConfirm={handleDeleteConfirmed} onCancel={() => setConfirmDelete(null)} />
        )}
      </div>
    </div>
  );
}

export default AthleteList;