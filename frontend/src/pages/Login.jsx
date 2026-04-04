import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

const API = API_BASE_URL;

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  duration: Math.random() * 10 + 8,
  delay: Math.random() * 5,
}));

const KNOWN_SPORTS = [
  'Skating', 'Athletics', 'Swimming', 'Badminton', 'Cricket',
  'Football', 'Basketball', 'Wrestling', 'Kabaddi', 'Tennis',
  'Volleyball', 'Boxing', 'Cycling', 'Gymnastics', 'Other'
];

function detectSportCoach(password) {
  const lower = password.trim().toLowerCase();
  if (lower === 'coach123') return null;
  for (const sport of KNOWN_SPORTS) {
    if (lower === `${sport.toLowerCase()}coach123`) return sport;
  }
  const match = lower.match(/^([a-z]+)coach123$/);
  if (match) {
    const raw = match[1];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return undefined;
}

function Login() {
  const [role, setRole] = useState(null);
  const [password, setPassword] = useState('');
  const [athleteName, setAthleteName] = useState('');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { }, []);

  const getAthletePassword = (athlete) => {
    const parts = athlete.name.trim().split(' ');
    const firstName = parts[0].toLowerCase();
    const lastInitial = parts[1]?.[0]?.toLowerCase() || '';
    return `${firstName}${lastInitial}123`;
  };

  const handleLogin = async () => {
    setError('');
    if (role === 'coach') {
      const sportCoach = detectSportCoach(password);
      if (sportCoach === null) {
        localStorage.setItem('role', 'coach');
        localStorage.setItem('coachId', 'coach_' + (localStorage.getItem('academyId') || 'default'));
        localStorage.removeItem('coachSport');
        navigate('/dashboard');
      } else if (sportCoach) {
        localStorage.setItem('role', 'coach');
        localStorage.setItem('coachId', 'coach_' + (localStorage.getItem('academyId') || 'default'));
        localStorage.setItem('coachSport', sportCoach);
        navigate('/dashboard');
      } else {
        setError('Wrong password. Use coach123 for admin, or sportcoach123 (e.g. skatingcoach123).');
      }
    } else if (role === 'athlete') {
      try {
        const academyId = localStorage.getItem('academyId') || '';
        const res = await axios.get(`${API}/athletes`, { params: { academy_id: academyId } });
        const athletes = res.data;
        const matched = athletes.find(
          a => getAthletePassword(a) === password.trim().toLowerCase()
        );
        if (matched) {
          localStorage.setItem('role', 'athlete');
          localStorage.setItem('athleteName', matched.name);
          localStorage.setItem('athleteSport', matched.sport || '');
          localStorage.setItem('academyId', academyId);
          navigate('/checkin');
        } else {
          setError('Invalid password. Use firstname + last initial + 123 (e.g. jineshn123)');
        }
      } catch {
        setError('Could not verify athletes. Check your connection.');
      }
    } else if (role === 'parent') {
      if (!athleteName.trim()) {
        setError("Please enter your child's name.");
        return;
      }
      localStorage.setItem('role', 'parent');
      localStorage.setItem('parentChildName', athleteName.trim());
      navigate('/parent');
    } else {
      setError('Wrong password. Try again.');
    }
  };

  const openRole = (r) => {
    setRole(r);
    setError('');
    setPassword('');
    setAthleteName('');
    setMenuOpen(false);
  };

  return (
    <div style={{ fontFamily: "'Bebas Neue', 'Arial Black', sans-serif" }}
      className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        .body-font { font-family: 'DM Sans', sans-serif; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.3); } 50% { box-shadow: 0 0 40px rgba(59,130,246,0.6); } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes particle-float { 0% { transform: translateY(0px) translateX(0px); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-100px) translateX(20px); opacity: 0; } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        .hero-title { animation: fadeUp 0.8s ease forwards; }
        .hero-sub { animation: fadeUp 0.8s ease 0.2s both; }
        .hero-cta { animation: fadeUp 0.8s ease 0.4s both; }
        .stats-bar { animation: fadeUp 0.8s ease 0.6s both; }
        .glow-blue { animation: pulse-glow 3s ease-in-out infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, #60a5fa, #a78bfa, #34d399, #60a5fa);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .marquee-track { display: flex; animation: marquee 20s linear infinite; width: max-content; }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); border-color: rgba(59,130,246,0.4); }
        .btn-primary { position: relative; overflow: hidden; transition: all 0.3s ease; }
        .btn-primary::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent); transform: translateX(-100%); transition: transform 0.5s ease; }
        .btn-primary:hover::after { transform: translateX(100%); }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 10px 30px rgba(59,130,246,0.4); }
        .modal-animate { animation: modal-in 0.3s ease forwards; }
        .noise-bg { position: relative; }
        .noise-bg::before { content: ''; position: fixed; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E"); pointer-events: none; z-index: 0; }
        .gradient-orb-1 { position: fixed; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%); top: -200px; right: -100px; pointer-events: none; animation: float 12s ease-in-out infinite; }
        .gradient-orb-2 { position: fixed; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%); bottom: -100px; left: -100px; pointer-events: none; animation: float 15s ease-in-out infinite reverse; }
        .diagonal-line { position: absolute; width: 1px; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.05), transparent); top: 0; bottom: 0; }

        /* ── Mobile menu ── */
        .mobile-menu {
          display: none;
          position: absolute;
          top: 100%;
          right: 0;
          left: 0;
          background: #030712;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 1rem 1.25rem;
          flex-direction: column;
          gap: 0.75rem;
          z-index: 50;
        }
        .mobile-menu.open { display: flex; }

        /* ── Responsive overrides ── */
        @media (max-width: 768px) {
          .desktop-nav-links { display: none !important; }
          .hamburger { display: flex !important; }

          .hero-grid { grid-template-columns: 1fr !important; gap: 2rem !important; }
          .hero-title-text { font-size: 4.5rem !important; line-height: 1 !important; }
          .hero-card { display: none; }

          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 1.5rem !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .roles-grid { grid-template-columns: 1fr !important; }

          .section-px { padding-left: 1.25rem !important; padding-right: 1.25rem !important; }
          .hero-pt { padding-top: 5rem !important; }
          .hero-pb { padding-bottom: 3rem !important; }

          .modal-box { padding: 1.5rem !important; border-radius: 1.25rem !important; }
          .modal-title { font-size: 1.75rem !important; }
        }

        @media (min-width: 769px) {
          .hamburger { display: none !important; }
          .mobile-menu { display: none !important; }
        }
      `}</style>

      {/* Background */}
      <div className="noise-bg">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        {[15, 30, 45, 60, 75].map(left => (
          <div key={left} className="diagonal-line" style={{ left: `${left}%` }} />
        ))}
        {PARTICLES.map(p => (
          <div key={p.id} style={{
            position: 'fixed', left: `${p.x}%`, top: `${p.y}%`,
            width: `${p.size}px`, height: `${p.size}px`, borderRadius: '50%',
            background: 'rgba(59,130,246,0.4)',
            animation: `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
            pointerEvents: 'none',
          }} />
        ))}
      </div>

      {/* ── NAV ── */}
      <nav className="relative z-10 border-b border-white/5" style={{ position: 'relative' }}>
        <div className="flex justify-between items-center px-5 py-4" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
          {/* Logo + Switch Academy */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center glow-blue">
              <span className="text-sm">⚡</span>
            </div>
            <span className="text-xl tracking-wider">ATHLETEIQ</span>
            <button
              onClick={() => {
                localStorage.removeItem('role');
                localStorage.removeItem('athleteName');
                localStorage.removeItem('athleteSport');
                localStorage.removeItem('coachSport');
                localStorage.removeItem('parentChildName');
                navigate('/');
              }}
              className="body-font text-xs text-gray-600 hover:text-red-400 border border-gray-800 hover:border-red-500/40 px-3 py-1.5 rounded-lg transition ml-2">
              ← Switch Academy
            </button>
            <button
              onClick={() => navigate('/academy-profile')}
              className="body-font text-xs text-gray-500 hover:text-indigo-400 border border-gray-800 hover:border-indigo-500/40 px-3 py-1.5 rounded-lg transition ml-1">
              🏛️ {localStorage.getItem('academyName') || 'Academy'}
            </button>
          </div>

          {/* Desktop nav links */}
          <div className="desktop-nav-links flex items-center gap-4 body-font">
            <button onClick={() => openRole('parent')}
              className="text-gray-400 text-sm hover:text-purple-400 transition-colors duration-200">
              Parent View
            </button>
            <button onClick={() => openRole('athlete')}
              className="text-gray-400 text-sm hover:text-white transition-colors duration-200">
              Athlete Portal
            </button>
            <button onClick={() => openRole('coach')}
              className="btn-primary bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold">
              Coach Login
            </button>
          </div>

          {/* Hamburger */}
          <button
            className="hamburger flex-col gap-1.5 p-2"
            style={{ display: 'none' }}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu">
            <span style={{ width: 22, height: 2, background: menuOpen ? '#60a5fa' : '#9ca3af', display: 'block', borderRadius: 2, transition: 'all 0.2s' }} />
            <span style={{ width: 22, height: 2, background: menuOpen ? '#60a5fa' : '#9ca3af', display: 'block', borderRadius: 2, transition: 'all 0.2s' }} />
            <span style={{ width: 22, height: 2, background: menuOpen ? '#60a5fa' : '#9ca3af', display: 'block', borderRadius: 2, transition: 'all 0.2s' }} />
          </button>
        </div>

        {/* Mobile dropdown */}
        <div className={`mobile-menu body-font${menuOpen ? ' open' : ''}`}>
          <button onClick={() => openRole('coach')}
            className="btn-primary bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-semibold w-full text-center">
            🧑‍💼 Coach Login
          </button>
          <button onClick={() => openRole('athlete')}
            className="border border-white/10 text-gray-300 px-5 py-3 rounded-xl text-sm w-full text-center hover:border-green-500/40 hover:text-green-400 transition">
            🏃 Athlete Portal
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openRole('parent'); }}
            style={{ pointerEvents: 'auto', zIndex: 100, position: 'relative' }}
            className="border border-white/10 text-gray-300 px-5 py-3 rounded-xl text-sm w-full text-center hover:border-purple-500/40 hover:text-purple-400 transition">
            👨‍👩‍👧 Parent View
          </button>
        </div>
      </nav>

      {/* Marquee */}
      <div className="relative z-10 border-b border-white/5 py-2 overflow-hidden">
        <div className="marquee-track text-xs text-gray-600 uppercase tracking-widest" style={{ display: 'flex', gap: '3rem' }}>
          {['Daily Wellness Tracking', 'AI Powered Insights', 'Injury Prevention', 'Match Readiness', 'Performance Analytics', 'Real-time Monitoring', 'Squad Management', 'Recovery Optimization',
            'Daily Wellness Tracking', 'AI Powered Insights', 'Injury Prevention', 'Match Readiness', 'Performance Analytics', 'Real-time Monitoring', 'Squad Management', 'Recovery Optimization'].map((t, i) => (
              <span key={i} className="whitespace-nowrap flex items-center gap-3">
                <span className="w-1 h-1 bg-blue-500 rounded-full inline-block" />
                {t}
              </span>
            ))}
        </div>
      </div>

      {/* ── HERO ── */}
      <div className="relative z-10 max-w-7xl mx-auto section-px hero-pt hero-pb"
        style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', paddingTop: '7rem', paddingBottom: '5rem' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div className="hero-title inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs uppercase tracking-widest mb-8 body-font font-semibold">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              AI Sports Performance Platform
            </div>
            <h1 className="hero-title-text leading-none tracking-wider mb-6"
              style={{ fontSize: '5rem' }}>
              <span className="block hero-title">TRAIN</span>
              <span className="block shimmer-text">SMARTER.</span>
              <span className="block hero-title">WIN MORE.</span>
            </h1>
            <p className="hero-sub body-font text-gray-400 text-lg leading-relaxed mb-10 max-w-md font-light">
              The AI-powered wellness platform built for serious coaches. Track your squad's readiness in real-time and get actionable insights before every session.
            </p>
            <div className="hero-cta flex gap-4 flex-wrap">
              <button onClick={() => openRole('coach')}
                className="btn-primary bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold body-font text-sm">
                Start as Coach →
              </button>
              <button onClick={() => openRole('athlete')}
                className="border border-white/10 text-gray-300 px-8 py-4 rounded-2xl text-sm body-font hover:border-green-500/50 hover:text-green-400 transition-all duration-300">
                Athlete Check-in ↗
              </button>
            </div>
          </div>

          {/* Right — hidden on mobile via CSS */}
          <div className="hero-card relative" style={{ animation: 'float 6s ease-in-out infinite' }}>
            <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest body-font">Today's Squad</p>
                  <p className="text-xl tracking-wide">WELLNESS OVERVIEW</p>
                </div>
                <span className="flex items-center gap-1.5 bg-green-500/10 text-green-400 text-xs px-3 py-1 rounded-full body-font">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Live
                </span>
              </div>
              {[
                { name: 'Rahul Sharma', sport: 'Cricket', energy: 8, status: 'Ready', color: 'text-green-400', bg: 'bg-green-500/20' },
                { name: 'Priya Patel', sport: 'Badminton', energy: 5, status: 'Rest', color: 'text-red-400', bg: 'bg-red-500/20' },
                { name: 'Arjun Singh', sport: 'Football', energy: 9, status: 'Ready', color: 'text-green-400', bg: 'bg-green-500/20' },
              ].map((a, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-800 rounded-xl flex items-center justify-center text-sm">
                      {a.sport === 'Cricket' ? '🏏' : a.sport === 'Badminton' ? '🏸' : '⚽'}
                    </div>
                    <div>
                      <p className="text-sm tracking-wide body-font font-medium">{a.name}</p>
                      <p className="text-xs text-gray-600 body-font">{a.sport}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${a.energy * 10}%` }} />
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg body-font ${a.bg} ${a.color}`}>{a.status}</span>
                  </div>
                </div>
              ))}
              <div className="mt-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl p-3">
                <p className="text-xs text-gray-500 body-font mb-1">🤖 AI Insight</p>
                <p className="text-xs text-gray-300 body-font leading-relaxed">Priya shows high soreness for 2 days. Recommend reducing intensity by 30% today.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="stats-bar relative z-10 border-t border-b border-white/5 py-10 mb-20">
        <div className="max-w-7xl mx-auto section-px stats-grid"
          style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem', textAlign: 'center' }}>
          {[
            { val: '2x', label: 'Faster Recovery', color: 'text-blue-400' },
            { val: '98%', label: 'Check-in Rate', color: 'text-green-400' },
            { val: 'AI', label: 'Daily Insights', color: 'text-purple-400' },
            { val: '0', label: 'Preventable Injuries', color: 'text-yellow-400' },
          ].map(({ val, label, color }) => (
            <div key={label}>
              <p className={`text-4xl tracking-wider ${color}`}>{val}</p>
              <p className="text-gray-500 text-xs uppercase tracking-widest body-font mt-2">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div className="relative z-10 max-w-7xl mx-auto section-px mb-24"
        style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}>
        <div className="text-center mb-14">
          <p className="text-xs text-blue-400 uppercase tracking-widest body-font mb-3">Platform Features</p>
          <h2 className="text-4xl tracking-wider">BUILT FOR CHAMPIONS</h2>
        </div>
        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
          {[
            { icon: '📊', title: 'REAL-TIME DASHBOARD', desc: "See every athlete's wellness the moment they check in. Energy, sleep, soreness — all in one view." },
            { icon: '🤖', title: 'AI COACHING INSIGHTS', desc: "Claude AI analyzes your squad and tells you who needs rest and who's ready to go hard." },
            { icon: '⚡', title: '30-SECOND CHECK-IN', desc: 'Athletes submit wellness data in under a minute. Simple sliders, zero friction.' },
            { icon: '🚨', title: 'INJURY RISK ALERTS', desc: 'Get flagged automatically when an athlete shows signs of overtraining.' },
            { icon: '📈', title: 'PERFORMANCE TRENDS', desc: 'Track wellness across weeks and months to optimize your training cycles.' },
            { icon: '👨‍👩‍👧', title: 'PARENT VISIBILITY', desc: "Parents get a read-only view of their child's wellness and AI coach messages." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="card-hover bg-gray-900 border border-white/5 rounded-2xl p-6 cursor-default">
              <div className="text-2xl mb-4">{icon}</div>
              <h3 className="text-lg tracking-wider mb-3">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed body-font font-light">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── ROLE CARDS ── */}
      <div className="relative z-10 max-w-7xl mx-auto section-px mb-24"
        style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}>
        <div className="roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          <div className="card-hover bg-gradient-to-br from-blue-950/50 to-gray-900 border border-blue-500/20 rounded-3xl p-8 cursor-pointer"
            onClick={() => openRole('coach')}>
            <div className="text-4xl mb-5">🧑‍💼</div>
            <h3 className="text-2xl tracking-wider mb-3">FOR COACHES</h3>
            <p className="text-gray-400 body-font text-sm leading-relaxed mb-5 font-light">
              Track your entire squad. Get AI-powered recommendations before every session and match day.
            </p>
            <ul className="space-y-2 mb-6 body-font text-sm text-gray-300">
              {['Real-time athlete dashboard', 'AI insights and injury alerts', 'Match readiness overview'].map(item => (
                <li key={item} className="flex items-center gap-2"><span className="text-blue-400">→</span> {item}</li>
              ))}
            </ul>
            <button className="btn-primary bg-blue-600 text-white px-6 py-3 rounded-xl text-sm body-font font-semibold w-full">
              Login as Coach →
            </button>
          </div>

          <div className="card-hover bg-gradient-to-br from-green-950/50 to-gray-900 border border-green-500/20 rounded-3xl p-8 cursor-pointer"
            onClick={() => openRole('athlete')}>
            <div className="text-4xl mb-5">🏃</div>
            <h3 className="text-2xl tracking-wider mb-3">FOR ATHLETES</h3>
            <p className="text-gray-400 body-font text-sm leading-relaxed mb-5 font-light">
              Check in daily in 30 seconds. Let your coach know how your body feels every day.
            </p>
            <ul className="space-y-2 mb-6 body-font text-sm text-gray-300">
              {['30 second daily check-in', 'Track your own wellness trends', 'Personal readiness score'].map(item => (
                <li key={item} className="flex items-center gap-2"><span className="text-green-400">→</span> {item}</li>
              ))}
            </ul>
            <button className="btn-primary bg-green-600 text-white px-6 py-3 rounded-xl text-sm body-font font-semibold w-full">
              Athlete Check-in →
            </button>
          </div>

          <div className="card-hover bg-gradient-to-br from-purple-950/50 to-gray-900 border border-purple-500/20 rounded-3xl p-8 cursor-pointer"
            onClick={() => openRole('parent')}>
            <div className="text-4xl mb-5">👨‍👩‍👧</div>
            <h3 className="text-2xl tracking-wider mb-3">FOR PARENTS</h3>
            <p className="text-gray-400 body-font text-sm leading-relaxed mb-5 font-light">
              Stay informed about your child's training wellness and get the AI coach's message for them.
            </p>
            <ul className="space-y-2 mb-6 body-font text-sm text-gray-300">
              {["7-day wellness trend chart", 'AI readiness score', "Coach AI message for your child"].map(item => (
                <li key={item} className="flex items-center gap-2"><span className="text-purple-400">→</span> {item}</li>
              ))}
            </ul>
            <button className="btn-primary bg-purple-600 text-white px-6 py-3 rounded-xl text-sm body-font font-semibold w-full">
              Parent View →
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/5 py-8 text-center">
        <p className="text-2xl tracking-wider mb-2">ATHLETEIQ</p>
        <p className="text-gray-600 text-xs body-font">Built for serious coaches and athletes · © 2026</p>
      </div>

      {/* ── LOGIN MODAL ── */}
      {role && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && (setRole(null), setError(''), setPassword(''), setAthleteName(''))}>
          <div className="modal-animate modal-box bg-gray-950 border border-white/10 rounded-3xl w-full shadow-2xl"
            style={{ maxWidth: '28rem', padding: '2rem' }}>
            <div className="flex justify-between items-center mb-8">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest body-font mb-1">
                  {role === 'coach' ? 'Coach Portal' : role === 'athlete' ? 'Athlete Portal' : 'Parent View'}
                </p>
                <h2 className="modal-title tracking-wider" style={{ fontSize: '2rem' }}>
                  {role === 'coach' ? 'WELCOME BACK' : role === 'athlete' ? 'CHECK IN' : 'VIEW PROGRESS'}
                </h2>
              </div>
              <button onClick={() => { setRole(null); setError(''); setPassword(''); setAthleteName(''); }}
                className="w-8 h-8 bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition body-font">
                ✕
              </button>
            </div>

            {role === 'parent' ? (
              <div className="mb-5">
                <label className="block text-gray-500 text-xs uppercase tracking-widest body-font mb-3">
                  Child's Name
                </label>
                <input type="text" value={athleteName}
                  onChange={(e) => { setAthleteName(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Full name" autoFocus
                  className="w-full bg-gray-900 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition body-font text-sm"
                />

              </div>
            ) : (
              <div className="mb-5">
                <label className="block text-gray-500 text-xs uppercase tracking-widest body-font mb-3">Password</label>
                <input type="password" value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter password" autoFocus
                  className="w-full bg-gray-900 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition body-font text-sm"
                />

              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm body-font px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <button onClick={handleLogin}
              className={`btn-primary w-full py-4 rounded-2xl font-semibold body-font text-sm text-white ${role === 'coach' ? 'bg-blue-600' : role === 'athlete' ? 'bg-green-600' : 'bg-purple-600'}`}>
              {role === 'coach' ? 'Access Dashboard →' : role === 'athlete' ? 'Submit Check-in →' : 'View My Child →'}
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
