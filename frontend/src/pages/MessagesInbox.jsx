import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import ChatPanel from '../components/common/ChatPanel';

const getAcademyId = () => localStorage.getItem('academyId') || '';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MessagesInbox() {
  const navigate = useNavigate();
  const academyId = getAcademyId();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAthlete, setOpenAthlete] = useState(null);

  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [athletesRes, threadsRes] = await Promise.allSettled([
        api.get('/athletes', { params: { academy_id: academyId } }),
        api.get('/messages/threads', { params: { academy_id: academyId } }),
      ]);
      const athletes = athletesRes.status === 'fulfilled' ? (athletesRes.value.data || []) : [];
      const existing = threadsRes.status === 'fulfilled' ? (threadsRes.value.data?.threads || []) : [];
      const byName = {};
      existing.forEach(t => { byName[t.athlete_name] = t; });

      // Every athlete gets a row so the coach can start a conversation,
      // not just reply to ones the athlete messaged first.
      const merged = athletes.map(a => byName[a.name] || {
        athlete_name: a.name,
        last_text: null,
        last_sender: null,
        last_at: null,
        unread_count: 0,
      });
      merged.sort((a, b) => {
        if (!a.last_at && !b.last_at) return a.athlete_name.localeCompare(b.athlete_name);
        if (!a.last_at) return 1;
        if (!b.last_at) return -1;
        return new Date(b.last_at) - new Date(a.last_at);
      });
      setThreads(merged);
    } catch (err) {
      console.error('Fetch threads failed:', err);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    if (!academyId) { navigate('/'); return; }
    fetchThreads();
    const iv = setInterval(() => fetchThreads(true), 8000);
    return () => clearInterval(iv);
  }, [academyId, navigate, fetchThreads]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Messages</h1>
            <p className="text-gray-500 text-sm mt-1">Direct messages with your athletes</p>
          </div>
          <Link to="/dashboard"
            className="border border-gray-600 text-gray-400 px-4 py-2 rounded-xl text-sm hover:border-purple-500 hover:text-purple-400 transition">
            ← Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
            <p className="text-gray-400 font-bold mb-1">No conversations yet</p>
            <p className="text-gray-600 text-sm">Messages from athletes will show up here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map(t => (
              <button key={t.athlete_name} onClick={() => setOpenAthlete(t.athlete_name)}
                className="w-full text-left bg-gray-800 hover:bg-gray-800/70 border border-gray-700 hover:border-gray-600 rounded-2xl p-4 flex items-center justify-between gap-3 transition">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-black text-sm truncate">{t.athlete_name}</p>
                    {t.unread_count > 0 && (
                      <span className="bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                        {t.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs truncate mt-0.5">
                    {t.last_text
                      ? `${t.last_sender === 'coach' ? 'You: ' : ''}${t.last_text}`
                      : <span className="text-gray-600 italic">No messages yet · tap to start</span>}
                  </p>
                </div>
                {t.last_at && (
                  <span className="text-gray-600 text-[10px] font-bold uppercase shrink-0">{timeAgo(t.last_at)}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {openAthlete && (
        <ChatPanel
          academyId={academyId}
          athleteName={openAthlete}
          sender="coach"
          onClose={() => { setOpenAthlete(null); fetchThreads(true); }}
        />
      )}
    </div>
  );
}
