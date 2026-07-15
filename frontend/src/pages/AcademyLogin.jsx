import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

const API = API_BASE_URL;

export default function AcademyLogin() {
    const [tab, setTab] = useState('signin');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState(null);
    const navigate = useNavigate();

    useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);
    useEffect(() => {
        axios.get(`${API}/auth/founding-status`)
            .then(res => setStats(res.data))
            .catch(() => setStats(null));
    }, []);

    const switchTab = (t) => {
        setTab(t); setError(''); setSuccess('');
        setName(''); setEmail(''); setPassword(''); setConfirmPw('');
    };

    const handleSignIn = async () => {
        if (!email.trim() || !password.trim()) { setError('Email and password are required.'); return; }
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API}/auth/academy-login`, {
                email: email.trim(),
                password,
            });
            storeAndGo(res.data);
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Login failed. Check your credentials.');
        } finally { setLoading(false); }
    };

    const handleSignUp = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) { setError('All fields are required.'); return; }
        if (password !== confirmPw) { setError('Passwords do not match.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API}/auth/register-academy`, {
                name: name.trim(), email: email.trim().toLowerCase(), password,
            });
            setSuccess(`Academy "${name.trim()}" created! Signing you in...`);
            setTimeout(() => storeAndGo(res.data), 1200);
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Could not create academy.');
        } finally { setLoading(false); }
    };

    const storeAndGo = (data) => {
        localStorage.setItem('academyId', data.academy_id);
        localStorage.setItem('academyName', data.academy_name);
        localStorage.setItem('plan', data.plan);
        localStorage.setItem('trialEndsAt', data.trial_ends_at || '');
        if (data.session_time) localStorage.setItem('sessionTime', JSON.stringify(data.session_time));
        navigate('/login');
    };

    const handleKey = (e) => { if (e.key === 'Enter') tab === 'signin' ? handleSignIn() : handleSignUp(); };

    return (
        <div className="min-h-screen bg-gray-950 overflow-x-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,300&display=swap');
        .display { font-family: 'Bebas Neue', sans-serif; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
        @keyframes marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        @keyframes shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
        @keyframes scanline{ 0% { top:-10%; } 100% { top:110%; } }
        @keyframes pulse-ring { 0% { transform:scale(1); opacity:.6; } 100% { transform:scale(1.6); opacity:0; } }
        @keyframes flicker { 0%,100%{opacity:1} 50%{opacity:.7} }
        @keyframes badge-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.4)} 50%{box-shadow:0 0 0 6px rgba(245,158,11,0)} }
        .anim-1{animation:fadeUp .7s ease both} .anim-2{animation:fadeUp .7s ease .1s both}
        .anim-3{animation:fadeUp .7s ease .2s both} .anim-4{animation:fadeUp .7s ease .3s both}
        .anim-5{animation:fadeUp .7s ease .4s both}
        .shimmer-text {
          background:linear-gradient(90deg,#6366f1,#a78bfa,#60a5fa,#6366f1);
          background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;
          background-clip:text;animation:shimmer 3s linear infinite;
        }
        .marquee-wrap{overflow:hidden}
        .marquee-track{display:flex;width:max-content;animation:marquee 32s linear infinite;gap:2.5rem}
        .input-field{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);transition:all .2s}
        .input-field:hover{border-color:rgba(255,255,255,0.15)}
        .input-field:focus{outline:none;border-color:rgba(99,102,241,0.5);background:rgba(99,102,241,0.03)}
        .btn-indigo{background:linear-gradient(135deg,#6366f1,#4f46e5);transition:all .2s}
        .btn-indigo:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(99,102,241,0.35)}
        .live-dot::before{content:'';position:absolute;inset:0;border-radius:50%;background:#22c55e;animation:pulse-ring 1.5s ease-out infinite}
        .scan{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(99,102,241,0.12),transparent);animation:scanline 8s linear infinite;pointer-events:none}
        .feature-tag{font-family:'Bebas Neue',sans-serif;letter-spacing:.05em}
      `}</style>

            {/* BG */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div style={{ background: 'radial-gradient(ellipse 80% 60% at 60% 0%,rgba(99,102,241,0.06) 0%,transparent 60%)' }} className="absolute inset-0" />
                <div style={{ background: 'radial-gradient(ellipse 60% 50% at 10% 80%,rgba(59,130,246,0.04) 0%,transparent 60%)' }} className="absolute inset-0" />
                <div className="absolute inset-0 opacity-[0.018]" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
                    backgroundSize: '60px 60px'
                }} />
                <div className="scan" />
                {[
                    { e: '⚽', x: 8, y: 15, d: 7 }, { e: '🏏', x: 88, y: 20, d: 9 }, { e: '⛸️', x: 15, y: 70, d: 11 },
                    { e: '🏸', x: 82, y: 65, d: 8 }, { e: '🏀', x: 50, y: 8, d: 10 }, { e: '🤸', x: 5, y: 45, d: 13 },
                    { e: '🎾', x: 92, y: 45, d: 7 }, { e: '🏊', x: 45, y: 85, d: 9 },
                ].map((p, i) => (
                    <div key={i} className="absolute text-2xl select-none opacity-[0.05]"
                        style={{ left: `${p.x}%`, top: `${p.y}%`, animation: `float ${p.d}s ease-in-out infinite`, animationDelay: `${i * 0.7}s` }}>
                        {p.e}
                    </div>
                ))}
            </div>

            {/* Nav */}
            <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-500/30">⚡</div>
                    <span className="display text-xl sm:text-2xl text-white tracking-wider">ATHLETEIQ</span>
                </div>
                <span className="relative flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-3 py-1.5 rounded-full font-semibold">
                    <span className="live-dot relative w-2 h-2 bg-green-400 rounded-full" />
                    <span className="hidden sm:inline">System </span>Online
                </span>
            </nav>

            {/* Marquee */}
            <div className="relative z-10 border-b border-white/5 py-2.5 marquee-wrap">
                <div className="marquee-track text-[11px] text-gray-700 uppercase tracking-[0.18em] font-semibold">
                    {[...Array(2)].map((_, gi) =>
                        ['Workload Management', 'Injury Signals', 'Session Logging', 'Readiness Scores', 'Parent Insights', 'Squad Analytics', 'ACWR Tracking', 'Mental Performance', 'Drill Planning', 'Deception Detection'].map((t, i) => (
                            <span key={`${gi}-${i}`} className="flex items-center gap-2.5 whitespace-nowrap">
                                <span className="w-1 h-1 bg-indigo-500/50 rounded-full" />
                                {t}
                            </span>
                        ))
                    )}
                </div>
            </div>

            {/* Main */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 lg:py-20">
                <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

                    {/* Left hero */}
                    <div className={`hidden lg:block ${mounted ? '' : 'opacity-0'}`}>
                        <div className="anim-1 inline-flex items-center gap-2 border border-indigo-500/25 bg-indigo-500/8 text-indigo-400 text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full mb-8">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                            Performance Intelligence · India
                        </div>
                        <h1 className="anim-2 display text-[5.5rem] lg:text-[7rem] leading-none tracking-wider text-white mb-6">
                            KNOW EVERY<br /><span className="shimmer-text">ATHLETE.</span><br />EVERY SESSION.
                        </h1>
                        <p className="anim-3 text-gray-400 text-lg leading-relaxed max-w-md mb-10 font-light">
                            Built for coaches who want more than gut feel. Full squad wellness, workload data, and injury signals — logged in under 3 minutes a session.
                        </p>
                        <div className="anim-4 grid grid-cols-3 gap-4 mb-12">
                            {[
                                { val: '3 min', label: 'Squad Logged', color: 'text-indigo-400' },
                                { val: '15+', label: 'Sports', color: 'text-blue-400' },
                                { val: '100', label: 'Readiness Scale', color: 'text-green-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center hover:border-indigo-500/20 transition-all">
                                    <p className={`display text-4xl ${s.color} tracking-wider`}>{s.val}</p>
                                    <p className="text-gray-600 text-[11px] uppercase tracking-widest mt-1 font-semibold">{s.label}</p>
                                </div>
                            ))}
                        </div>
                        {stats && stats.total_academies > 0 && (
                            <div className="anim-5">
                                <p className="text-gray-600 text-[11px] uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                                    <span className="w-1 h-1 bg-indigo-500/60 rounded-full" />
                                    On the platform
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
                                        <span className="w-2 h-2 bg-green-400 rounded-full shrink-0" />
                                        <div>
                                            <p className="display text-2xl text-white tracking-wider leading-none">{stats.total_academies}</p>
                                            <p className="text-gray-600 text-[11px] mt-0.5">{stats.total_academies === 1 ? 'academy live' : 'academies live'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
                                        <span className="w-2 h-2 bg-indigo-400 rounded-full shrink-0" />
                                        <div>
                                            <p className="display text-2xl text-white tracking-wider leading-none">{stats.total_athletes}</p>
                                            <p className="text-gray-600 text-[11px] mt-0.5">athletes tracked</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile hero */}
                    <div className="lg:hidden text-center mb-2">
                        <div className="inline-flex items-center gap-2 border border-indigo-500/25 bg-indigo-500/8 text-indigo-400 text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full mb-4">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                            Performance Intelligence
                        </div>
                        <h1 className="display text-5xl leading-none tracking-wider text-white mb-3">
                            KNOW EVERY <span className="shimmer-text">ATHLETE.</span>
                        </h1>
                        <p className="text-gray-500 text-sm mb-4 font-light px-2">Full squad wellness, workload data, and injury signals — in one place.</p>
                        <div className="grid grid-cols-3 gap-2 mb-2 max-w-xs mx-auto">
                            {[
                                { val: '3 min', label: 'Squad Log', color: 'text-indigo-400' },
                                { val: '15+', label: 'Sports', color: 'text-blue-400' },
                                { val: '100', label: 'Readiness', color: 'text-green-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-white/[0.02] border border-white/5 rounded-xl p-2 text-center">
                                    <p className={`display text-2xl ${s.color} tracking-wider`}>{s.val}</p>
                                    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-semibold">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Form */}
                    <div className="lg:sticky lg:top-8">
                        {/* Founding 15 Banner */}
                        <div className="mb-3 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.08))', border: '1px solid rgba(245,158,11,0.25)', animation: 'badge-pulse 2.5s ease-in-out infinite' }}>
                            <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl shrink-0" style={{ animation: 'flicker 2s ease-in-out infinite' }}>🔥</span>
                                    <div>
                                        <p className="text-amber-400 text-xs font-black uppercase tracking-widest leading-tight">Founding 15 — Spots Filling Fast</p>
                                        <p className="text-amber-300/60 text-[11px] font-medium mt-0.5">₹999/mo locked for life · rises to ₹2,499 after the first 15</p>
                                    </div>
                                </div>
                                <div className="shrink-0 text-right bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-1.5">
                                    <p className="text-amber-400 text-lg font-black leading-none">{stats ? stats.spots_left : 15}</p>
                                    <p className="text-amber-300/60 text-[9px] uppercase tracking-wider font-bold">spots left</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] rounded-3xl overflow-hidden backdrop-blur-sm" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-white/5">
                                <p className="text-gray-500 text-[11px] uppercase tracking-[0.2em] font-bold mb-1">Academy Portal</p>
                                <h2 className="display text-3xl sm:text-4xl text-white tracking-wider">
                                    {tab === 'signin' ? 'SIGN IN' : 'GET STARTED'}
                                </h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    {tab === 'signin'
                                        ? 'Enter your credentials to access your dashboard.'
                                        : 'Set up your academy in under 2 minutes.'}
                                </p>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-white/5">
                                {['signin', 'signup'].map(t => (
                                    <button key={t} onClick={() => switchTab(t)}
                                        className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest transition-all ${tab === t
                                            ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
                                            : 'text-gray-600 hover:text-gray-400'}`}>
                                        {t === 'signin' ? 'Sign In' : 'New Academy'}
                                    </button>
                                ))}
                            </div>

                            <div className="px-5 sm:px-8 py-6 sm:py-7 space-y-4">
                                {tab === 'signup' && (
                                    <div>
                                        <label className="text-gray-500 text-[11px] uppercase tracking-widest font-bold block mb-2">Academy Name</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKey}
                                            placeholder="e.g. Mumbai Athletic Club"
                                            className="input-field w-full rounded-xl px-4 py-3 sm:py-3.5 text-white placeholder-gray-700 text-sm" />
                                    </div>
                                )}

                                <div>
                                    <label className="text-gray-500 text-[11px] uppercase tracking-widest font-bold block mb-2">
                                        {tab === 'signin' ? 'Email or Academy Name' : 'Email'}
                                    </label>
                                    <input
                                        type="text"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        onKeyDown={handleKey}
                                        placeholder={tab === 'signin' ? 'Email or your academy name' : 'coach@youracademy.com'}
                                        className="input-field w-full rounded-xl px-4 py-3 sm:py-3.5 text-white placeholder-gray-700 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="text-gray-500 text-[11px] uppercase tracking-widest font-bold block mb-2">Password</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey}
                                        placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
                                        className="input-field w-full rounded-xl px-4 py-3 sm:py-3.5 text-white placeholder-gray-700 text-sm" />
                                </div>

                                {tab === 'signup' && (
                                    <div>
                                        <label className="text-gray-500 text-[11px] uppercase tracking-widest font-bold block mb-2">Confirm Password</label>
                                        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} onKeyDown={handleKey}
                                            placeholder="••••••••"
                                            className="input-field w-full rounded-xl px-4 py-3 sm:py-3.5 text-white placeholder-gray-700 text-sm" />
                                    </div>
                                )}

                                {error && (
                                    <div className="flex gap-2.5 items-start bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                        <span className="text-red-400 shrink-0 text-sm">—</span>
                                        <p className="text-red-400 text-sm">{error}</p>
                                    </div>
                                )}
                                {success && (
                                    <div className="flex gap-2.5 items-start bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                                        <span className="text-green-400 shrink-0 text-sm">✓</span>
                                        <p className="text-green-400 text-sm">{success}</p>
                                    </div>
                                )}

                                {tab === 'signup' && (
                                    <div className="flex items-center justify-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-2.5">
                                        <span className="text-amber-400 text-xs">🔒</span>
                                        <p className="text-amber-300/80 text-[11px] font-semibold">Your ₹999/mo rate locks in on signup — forever</p>
                                    </div>
                                )}

                                <button onClick={tab === 'signin' ? handleSignIn : handleSignUp} disabled={loading}
                                    className="btn-indigo w-full text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
                                    {loading
                                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{tab === 'signin' ? 'Signing in...' : 'Creating...'}</>
                                        : tab === 'signin' ? 'Sign In →' : 'Create Academy →'
                                    }
                                </button>

                                <p className="text-center text-gray-700 text-xs pt-1">
                                    {tab === 'signin'
                                        ? <>No academy yet?{' '}<button onClick={() => switchTab('signup')} className="text-indigo-400 hover:text-indigo-300 font-bold transition">Register here</button></>
                                        : <>Already registered?{' '}<button onClick={() => switchTab('signin')} className="text-indigo-400 hover:text-indigo-300 font-bold transition">Sign in</button></>
                                    }
                                </p>
                            </div>

                            <div className="px-5 sm:px-8 pb-6 sm:pb-7">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex-1 h-px bg-white/5" />
                                    <p className="text-gray-700 text-[10px] uppercase tracking-widest font-bold whitespace-nowrap">What's included</p>
                                    <div className="flex-1 h-px bg-white/5" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { tag: '01', text: 'Data isolated per academy — never shared' },
                                        { tag: '02', text: 'Live dashboard — squad check-ins in 30s' },
                                        { tag: '03', text: 'Injury signals, ACWR & readiness scoring' },
                                        { tag: '04', text: 'Parent recovery portal — included by default' },
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-start gap-2.5 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                                            <span className="feature-tag text-indigo-500/60 text-sm shrink-0 leading-tight">{f.tag}</span>
                                            <p className="text-gray-500 text-[11px] leading-tight font-medium">{f.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                            <a href="/terms" className="text-gray-600 hover:text-gray-400 text-[10px] uppercase tracking-widest font-bold transition">Terms</a>
                            <span className="text-gray-800 text-[10px]">·</span>
                            <a href="/privacy" className="text-gray-600 hover:text-gray-400 text-[10px] uppercase tracking-widest font-bold transition">Privacy</a>
                            <span className="text-gray-800 text-[10px]">·</span>
                            <a href="/refund" className="text-gray-600 hover:text-gray-400 text-[10px] uppercase tracking-widest font-bold transition">Refunds</a>
                            <span className="text-gray-800 text-[10px]">·</span>
                            <a href="/contact" className="text-gray-600 hover:text-gray-400 text-[10px] uppercase tracking-widest font-bold transition">Contact</a>
                        </div>
                        <p className="text-center text-gray-800 text-[11px] uppercase tracking-widest font-bold mt-3">
                            AthleteIQ · India · © 2026
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
