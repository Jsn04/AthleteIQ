import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';
import StatCard from '../components/common/StatCard';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import TopLoader from '../components/common/TopLoader';
import logo from '../assets/athleteiq_logo.svg';

function SportDashboard() {
  const { sport: sportName } = useParams();
  const academyId = localStorage.getItem('academyId') || '';
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState([]);
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const athletesRes = await axios.get(`${API_BASE_URL}/athletes`, { params: { academy_id: academyId } });
      const filtered = athletesRes.data.filter(a => a.sport.toLowerCase() === sportName.toLowerCase());
      setAthletes(filtered);
      setLoading(false); // ← show athletes immediately, don't wait for AI

      // load insights in background one by one
      filtered.forEach(async (athlete) => {
        try {
          const res = await axios.get(`${API_BASE_URL}/ai/insights/${encodeURIComponent(athlete.name)}`, { params: { academy_id: academyId } });
          setInsights(prev => ({ ...prev, [athlete.name]: res.data }));
        } catch {
          setInsights(prev => ({ ...prev, [athlete.name]: null }));
        }
      });
    } catch (err) {
      console.error('Error fetching sport data:', err);
      setLoading(false);
    }
  }, [sportName, academyId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && athletes.length === 0) return (
    <div className="min-h-screen bg-gray-900 p-8 flex items-center justify-center">
      <LoadingSkeleton type="dashboard" />
    </div>
  );

  const sportRed = athletes.filter(a => insights[a.name]?.risk === 'red').length;
  const sportYellow = athletes.filter(a => insights[a.name]?.risk === 'yellow').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <TopLoader loading={loading} />
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="AthleteIQ" className="h-8 w-auto cursor-pointer" onClick={() => navigate('/dashboard')} />
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight">{sportName} Dashboard</h1>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Live Wellness Updates</p>
              </div>
            </div>
          <div className="flex gap-2">
            {sportRed > 0 && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-black">{sportRed} Critical</span>}
            {sportYellow > 0 && <span className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-black">{sportYellow} Caution</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Athletes" value={athletes.length} color="text-white" />
          <StatCard label="At Risk" value={sportRed} color="text-red-400" />
          <StatCard label="Caution" value={sportYellow} color="text-yellow-400" />
          <StatCard label="Status" value="Live" color="text-green-400" />
        </div>

        {/* Athlete Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletes.map(athlete => (
            <div
              key={athlete.id}
              onClick={() => navigate(`/athlete/${encodeURIComponent(athlete.name)}`)}
              className="bg-gray-800 rounded-2xl p-5 border border-gray-700 hover:border-gray-500 transition cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">{athlete.name}</h3>
                  <p className="text-gray-500 text-xs font-bold uppercase">{athlete.age} Years Old</p>
                </div>
                <RiskBadge risk={insights[athlete.name]?.risk} />
              </div>

              {insights[athlete.name]?.score != null ? (
                <div className="flex items-center justify-between bg-gray-900 rounded-xl p-3 border border-gray-700">
                  <span className="text-xs font-bold text-gray-500 uppercase">Readiness</span>
                  <span className={`text-2xl font-black ${insights[athlete.name]?.risk === 'red' ? 'text-red-400' : 'text-green-400'}`}>
                    {insights[athlete.name].score}
                  </span>
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-900 rounded-xl border border-dashed border-gray-700">
                  <p className="text-gray-600 text-xs uppercase font-bold">Waiting for Check-in</p>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default SportDashboard;