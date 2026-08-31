import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api';

const POLL_MS = 4000;

export default function ChatPanel({ academyId, athleteName, sender, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef(null);

  const fetchThread = useCallback(async () => {
    try {
      const res = await api.get(`/messages/${encodeURIComponent(athleteName)}`, { params: { academy_id: academyId } });
      setMessages(res.data?.messages || []);
      api.post(`/messages/read?academy_id=${academyId}`, { athlete_name: athleteName, reader: sender }).catch(() => {});
    } catch { /* silent, poll will retry */ }
  }, [academyId, athleteName, sender]);

  useEffect(() => {
    fetchThread();
    const iv = setInterval(fetchThread, POLL_MS);
    return () => clearInterval(iv);
  }, [fetchThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError('');
    setText('');
    try {
      await api.post(`/messages?academy_id=${academyId}`, { athlete_name: athleteName, sender, text: body });
      fetchThread();
    } catch {
      setText(body);
      setSendError('Message failed to send. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg h-[600px] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-between items-center p-4 border-b border-gray-700 shrink-0">
          <div>
            <p className="text-white font-black text-sm">
              {sender === 'coach' ? athleteName : 'Coach'}
            </p>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">Messages</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {messages.length === 0 ? (
            <p className="text-gray-600 text-xs text-center mt-8">No messages yet. Say hello.</p>
          ) : (
            messages.map(m => {
              const mine = m.sender === sender;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                    mine ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                  }`}>
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {sendError && (
          <p className="text-rose-400 text-xs px-4 pb-1 shrink-0">{sendError}</p>
        )}
        <div className="p-3 border-t border-gray-700 shrink-0 flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/50"
          />
          <button onClick={handleSend} disabled={!text.trim() || sending}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 rounded-xl text-sm font-bold transition">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
