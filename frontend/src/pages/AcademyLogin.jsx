import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

const API = API_BASE_URL;

const ACADEMIES = [
    { name: 'Delhi Skating Academy', sport: '⛸️', athletes: 24, status: 'Live' },
    { name: 'Mumbai Cricket Club', sport: '🏏', athletes: 31, status: 'Live' },
    { name: 'Pune Athletics Hub', sport: '🏃', athletes: 18, status: 'Active' },
    { name: 'Chennai Badminton Pro', sport: '🏸', athletes: 12, status: 'Live' },
];

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
    const navigate = useNavigate();

    useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

    const switchTab = (t) => {
        setTab(t); setError(''); setSuccess('');
        setName(''); setEmail(''); setPassword(''); setConfirmPw('');
    };

    const handleSignIn = async () => {
        if (!email.trim() || !password.trim()) { setError('Email or Academy Name and password are required.'); return; }
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API}/auth/academy-login`, {
                email: email.trim(), // ← no forced lowercase — backend handles both email and name
                password,
            });
            storeAndGo(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
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
            setError(err.response?.data?.detail || 'Could not create academy.');
        } finally { setLoading(false); }
    };

    const storeAndGo = (data) => {
        localStorage.setItem('academyId', data.academy_id);
        localStorage.setItem('academyName', data.academy_name);
        localStorage.setItem('plan', data.plan);
        localStorage.setItem('trialEndsAt', data.trial_ends_at || '');
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
        .anim-1{animation:fadeUp .7s ease both} .anim-2{animation:fadeUp .7s ease .1s both}
        .anim-3{animation:fadeUp .7s ease .2s both} .anim-4{animation:fadeUp .7s ease .3s both}
        .anim-5{animation:fadeUp .7s ease .4s both}
        .shimmer-text {
          background:linear-gradient(90deg,#6366f1,#a78bfa,#60a5fa,#6366f1);
          background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;
          background-clip:text;animation:shimmer 3s linear infinite;
        }
        .marquee-wrap{overflow:hidden}
        .marquee-track{display:flex;width:max-content;animation:marquee 28s linear infinite;gap:2.5rem}
        .input-field{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);transition:all .2s}
        .input-field:hover{border-color:rgba(255,255,255,0.15)}
        .input-field:focus{outline:none;border-color:rgba(99,102,241,0.5);background:rgba(99,102,241,0.03)}
        .btn-indigo{background:linear-gradient(135deg,#6366f1,#4f46e5);transition:all .2s}
        .btn-indigo:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(99,102,241,0.35)}
        .live-dot::before{content:'';position:absolute;inset:0;border-radius:50%;background:#22c55e;animation:pulse-ring 1.5s ease-out infinite}
        .scan{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(99,102,241,0.15),transparent);animation:scanline 6s linear infinite;pointer-events:none}
      `}</style>

            {/* BG */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div style={{ background: 'radial-gradient(ellipse 80% 60% at 60% 0%,rgba(99,102,241,0.07) 0%,transparent 60%)' }} className="absolute inset-0" />
                <div style={{ background: 'radial-gradient(ellipse 60% 50% at 10% 80%,rgba(59,130,246,0.05) 0%,transparent 60%)' }} className="absolute inset-0" />
                <div className="absolute inset-0 opacity-[0.025]" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
                    backgroundSize: '60px 60px'
                }} />
                <div className="scan" />
                {[
                    { e: '⚽', x: 8, y: 15, d: 7 }, { e: '🏏', x: 88, y: 20, d: 9 }, { e: '⛸️', x: 15, y: 70, d: 11 },
                    { e: '🏸', x: 82, y: 65, d: 8 }, { e: '🏀', x: 50, y: 8, d: 10 }, { e: '🤸', x: 5, y: 45, d: 13 },
                    { e: '🎾', x: 92, y: 45, d: 7 }, { e: '🏊', x: 45, y: 85, d: 9 },
                ].map((p, i) => (
                    <div key={i} className="absolute text-2xl select-none opacity-[0.06]"
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
                    <span className="hidden sm:inline">Platform </span>Live
                </span>
            </nav>

            {/* Marquee */}
            <div className="relative z-10 border-b border-white/5 py-2.5 marquee-wrap">
                <div className="marquee-track text-[11px] text-gray-600 uppercase tracking-[0.15em] font-semibold">
                    {[...Array(2)].map((_, gi) =>
                        ['AI Injury Prediction', 'Real-time Wellness', 'Squad Management', 'ACWR Tracking', 'Drill Generation', 'Parent Portal', 'Deception Detection', 'Match Readiness', 'Performance Analytics'].map((t, i) => (
                            <span key={`${gi}-${i}`} className="flex items-center gap-2.5 whitespace-nowrap">
                                <span className="w-1 h-1 bg-indigo-500 rounded-full opacity-60" />
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
                        <div className="anim-1 inline-flex items-center gap-2 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full mb-8">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                            AI Sports Performance Platform
                        </div>
                        <h1 className="anim-2 display text-[5.5rem] lg:text-[7rem] leading-none tracking-wider text-white mb-6">
                            YOUR<br /><span className="shimmer-text">ACADEMY.</span><br />YOUR DATA.
                        </h1>
                        <p className="anim-3 text-gray-400 text-lg leading-relaxed max-w-md mb-10 font-light">
                            One platform for your entire academy. Track every athlete's wellness, predict injuries with AI, and make smarter coaching decisions — every single day.
                        </p>
                        <div className="anim-4 grid grid-cols-3 gap-4 mb-12">
                            {[
                                { val: '15+', label: 'Sports', color: 'text-indigo-400' },
                                { val: 'AI', label: 'Injury Alerts', color: 'text-blue-400' },
                                { val: '∞', label: 'Athletes', color: 'text-green-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center hover:border-indigo-500/20 transition-all">
                                    <p className={`display text-4xl ${s.color} tracking-wider`}>{s.val}</p>
                                    <p className="text-gray-600 text-[11px] uppercase tracking-widest mt-1 font-semibold">{s.label}</p>
                                </div>
                            ))}
                        </div>
                        <div className="anim-5">
                            <p className="text-gray-600 text-[11px] uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                                <span className="w-1 h-1 bg-indigo-500 rounded-full" />
                                Academies on the platform
                            </p>
                            <div className="space-y-2">
                                {ACADEMIES.map((a, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 hover:bg-indigo-500/[0.03] rounded-xl px-4 py-3 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{a.sport}</span>
                                            <div>
                                                <p className="text-white text-sm font-semibold group-hover:text-indigo-300 transition-colors">{a.name}</p>
                                                <p className="text-gray-600 text-[11px]">{a.athletes} athletes</p>
                                            </div>
                                        </div>
                                        <span className="flex items-center gap-1.5 text-green-400 text-[11px] font-bold uppercase">
                                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                            {a.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Mobile hero */}
                    <div className="lg:hidden text-center mb-2">
                        <div className="inline-flex items-center gap-2 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full mb-4">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                            AI Sports Performance Platform
                        </div>
                        <h1 className="display text-5xl leading-none tracking-wider text-white mb-3">
                            YOUR <span className="shimmer-text">ACADEMY.</span>
                        </h1>
                        <p className="text-gray-500 text-sm mb-4 font-light px-2">Track wellness, predict injuries with AI, and coach smarter.</p>
                        <div className="grid grid-cols-3 gap-2 mb-2 max-w-xs mx-auto">
                            {[
                                { val: '15+', label: 'Sports', color: 'text-indigo-400' },
                                { val: 'AI', label: 'Alerts', color: 'text-blue-400' },
                                { val: '∞', label: 'Athletes', color: 'text-green-400' },
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
                        <div className="bg-white/[0.02] rounded-3xl overflow-hidden backdrop-blur-sm" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-white/5">
                                <p className="text-gray-500 text-[11px] uppercase tracking-[0.2em] font-bold mb-1">Academy Portal</p>
                                <h2 className="display text-3xl sm:text-4xl text-white tracking-wider">
                                    {tab === 'signin' ? 'ENTER WORKSPACE' : 'REGISTER ACADEMY'}
                                </h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    {tab === 'signin'
                                        ? 'Sign in with your email or academy name.'
                                        : 'Create your academy — fully isolated, instantly ready.'}
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
                                {/* Academy Name — register only */}
                                {tab === 'signup' && (
                                    <div>
                                        <label className="text-gray-500 text-[11px] uppercase tracking-widest font-bold block mb-2">Academy Name</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKey}
                                            placeholder="e.g. Mumbai Athletic Club"
                                            className="input-field w-full rounded-xl px-4 py-3 sm:py-3.5 text-white placeholder-gray-700 text-sm" />
                                    </div>
                                )}

                                {/* ── KEY CHANGE: Email OR Academy Name for sign-in ── */}
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

                                {/* Password */}
                                <div>
                                    <label className="text-gray-500 text-[11px] uppercase tracking-widest font-bold block mb-2">Password</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey}
                                        placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
                                        className="input-field w-full rounded-xl px-4 py-3 sm:py-3.5 text-white placeholder-gray-700 text-sm" />
                                </div>

                                {/* Confirm Password — register only */}
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
                                        <span className="text-red-400 shrink-0">⚠</span>
                                        <p className="text-red-400 text-sm">{error}</p>
                                    </div>
                                )}
                                {success && (
                                    <div className="flex gap-2.5 items-start bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                                        <span className="text-green-400 shrink-0">✅</span>
                                        <p className="text-green-400 text-sm">{success}</p>
                                    </div>
                                )}

                                <button onClick={tab === 'signin' ? handleSignIn : handleSignUp} disabled={loading}
                                    className="btn-indigo w-full text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
                                    {loading
                                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{tab === 'signin' ? 'Signing in...' : 'Creating...'}</>
                                        : tab === 'signin' ? 'Enter Workspace →' : 'Create Academy →'
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
                                    <p className="text-gray-700 text-[10px] uppercase tracking-widest font-bold whitespace-nowrap">Why AthleteIQ</p>
                                    <div className="flex-1 h-px bg-white/5" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { icon: '🔒', text: 'Fully isolated data per academy' },
                                        { icon: '⚡', text: 'Live dashboard, 30s check-ins' },
                                        { icon: '🤖', text: 'AI injury risk & drill plans' },
                                        { icon: '👨‍👩‍👧', text: 'Parent portal included' },
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-start gap-2 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                                            <span className="text-base shrink-0">{f.icon}</span>
                                            <p className="text-gray-500 text-[11px] leading-tight font-medium">{f.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-gray-800 text-[11px] uppercase tracking-widest font-bold mt-6">
                            AthleteIQ · Built for serious sports academies · © 2026
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}