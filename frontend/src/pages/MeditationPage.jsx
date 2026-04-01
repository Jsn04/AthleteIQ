import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const EXERCISES = [
    {
        id: 'box',
        name: 'Box Breathing',
        tag: 'FOCUS',
        emoji: '⬛',
        description: 'Used by Navy SEALs to reduce stress and sharpen focus.',
        rounds: 6,
        accentColor: '#6366f1',
        phases: [
            { label: 'Inhale', duration: 4, color: '#6366f1' },
            { label: 'Hold', duration: 4, color: '#8b5cf6' },
            { label: 'Exhale', duration: 4, color: '#06b6d4' },
            { label: 'Hold', duration: 4, color: '#8b5cf6' },
        ],
    },
    {
        id: '478',
        name: '4-7-8 Breathing',
        tag: 'CALM',
        emoji: '🌙',
        description: "Dr. Andrew Weil's technique for anxiety relief and sleep.",
        rounds: 4,
        accentColor: '#8b5cf6',
        phases: [
            { label: 'Inhale', duration: 4, color: '#6366f1' },
            { label: 'Hold', duration: 7, color: '#8b5cf6' },
            { label: 'Exhale', duration: 8, color: '#06b6d4' },
        ],
    },
    {
        id: 'sigh',
        name: 'Physiological Sigh',
        tag: 'RESET',
        emoji: '💨',
        description: 'Stanford research — fastest known way to reduce stress in real time.',
        rounds: 5,
        accentColor: '#06b6d4',
        phases: [
            { label: 'Inhale deeply', duration: 3, color: '#6366f1' },
            { label: 'Sniff to top up', duration: 1, color: '#818cf8' },
            { label: 'Long exhale', duration: 6, color: '#06b6d4' },
        ],
    },
    {
        id: 'bodyscan',
        name: 'Body Scan',
        tag: 'RELEASE',
        emoji: '🧘',
        description: 'Sports psych technique to release tension before competition.',
        rounds: 1,
        accentColor: '#10b981',
        phases: [
            { label: 'Find a comfortable position and close your eyes. Take a slow breath in through your nose... and release it gently. Let your body begin to settle.', duration: 12, color: '#10b981' },
            { label: 'Bring your attention down to your feet. Feel the weight of them. Let every muscle in your feet soften and release completely.', duration: 10, color: '#10b981' },
            { label: 'Now move up to your calves and shins. Notice any tightness there. With your next exhale, let that tension melt away.', duration: 10, color: '#10b981' },
            { label: 'Shift your focus to your thighs. Let them feel heavy. Imagine them sinking downward, fully relaxed and at ease.', duration: 10, color: '#10b981' },
            { label: 'Now your hips and core. This is where athletes hold a lot of stress. Consciously release it now. Let your lower body go completely limp.', duration: 12, color: '#10b981' },
            { label: 'Bring awareness to your chest. Let your breathing slow naturally. Feel your chest rise... and fall... rise... and fall. Open and easy.', duration: 12, color: '#10b981' },
            { label: 'Your arms and hands now. Let your shoulders drop away from your ears. Uncurl your fingers. Let your arms hang loose and heavy.', duration: 10, color: '#10b981' },
            { label: 'Soften your neck. Unclench your jaw. Let your tongue relax away from the roof of your mouth. Your face is completely at rest.', duration: 10, color: '#10b981' },
            { label: 'Your whole body is now relaxed. You are calm, present, and in control. Carry this stillness with you into your performance.', duration: 12, color: '#10b981' },
        ],
    },
    {
        id: 'visualise',
        name: 'Pre-Competition Visualisation',
        tag: 'PERFORM',
        emoji: '🏆',
        description: 'Used by Olympic athletes — mentally rehearse your perfect performance.',
        rounds: 1,
        accentColor: '#f59e0b',
        phases: [
            { label: 'Close your eyes. Take three slow, deep breaths. You are safe. You are prepared. This moment belongs to you.', duration: 12, color: '#f59e0b' },
            { label: 'Picture yourself arriving at your competition venue. Notice the atmosphere. The sounds, the energy. You feel calm and completely ready.', duration: 12, color: '#f59e0b' },
            { label: 'See yourself in your warm-up. Your body feels fluid and strong. Every movement is smooth and effortless. This is your body at its best.', duration: 12, color: '#f59e0b' },
            { label: 'Now step into your performance. Feel the ground beneath you. Your breathing is controlled. Your mind is sharp and focused on this moment only.', duration: 14, color: '#f59e0b' },
            { label: 'See yourself executing your technique flawlessly. Every detail is perfect. Your training is showing. You have done this a thousand times before.', duration: 14, color: '#f59e0b' },
            { label: 'You encounter a difficult moment. And you respond with composure. You adapt. You push through. Nothing can break your focus today.', duration: 12, color: '#f59e0b' },
            { label: 'See yourself finishing strong. Every ounce of effort poured in. The performance you trained for. Feel the satisfaction of giving everything you have.', duration: 14, color: '#f59e0b' },
            { label: 'Take a deep breath in... and slowly out. Open your awareness. You are ready. Your mind and body are aligned. Go perform.', duration: 12, color: '#f59e0b' },
        ],
    },
];

// ── Web Audio ─────────────────────────────────────────────────────────────────
function createAmbientAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Convolver for reverb feel
    const bufferSize = ctx.sampleRate * 3;
    const impulse = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const ch = impulse.getChannelData(c);
        for (let i = 0; i < bufferSize; i++) {
            ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.5);
        }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    const reverbGain = ctx.createGain();
    reverbGain.gain.setValueAtTime(0.35, ctx.currentTime);
    convolver.connect(reverbGain);
    reverbGain.connect(masterGain);

    // Soft low-pass filter on master
    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(1200, ctx.currentTime);
    masterFilter.connect(masterGain);

    // Pads: triangle waves (softer than sine) at pentatonic-ish intervals
    const pads = [
        { freq: 130.8, gain: 0.10, lfoRate: 0.05, lfoDepth: 0.8 }, // C3
        { freq: 196.0, gain: 0.07, lfoRate: 0.04, lfoDepth: 0.6 }, // G3
        { freq: 261.6, gain: 0.06, lfoRate: 0.06, lfoDepth: 0.5 }, // C4
        { freq: 329.6, gain: 0.04, lfoRate: 0.03, lfoDepth: 0.4 }, // E4
        { freq: 392.0, gain: 0.03, lfoRate: 0.05, lfoDepth: 0.3 }, // G4
    ];

    const oscillators = pads.map(({ freq, gain, lfoRate, lfoDepth }) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Gentle tremolo via LFO on gain
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(lfoRate, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(lfoDepth, ctx.currentTime);
        lfo.connect(lfoGain);

        const g = ctx.createGain();
        g.gain.setValueAtTime(gain, ctx.currentTime);
        lfoGain.connect(g.gain); // tremolo modulates volume

        // Each pad goes through soft filter + dry path + reverb
        const padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.setValueAtTime(600 + freq * 0.8, ctx.currentTime);

        osc.connect(padFilter);
        padFilter.connect(g);
        g.connect(masterFilter);   // dry
        g.connect(convolver);       // wet (reverb)

        lfo.start();
        osc.start();
        return osc;
    });

    // Slow sub-bass pulse for depth
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(65.4, ctx.currentTime); // C2
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.06, ctx.currentTime);
    sub.connect(subGain);
    subGain.connect(masterGain);
    sub.start();

    return {
        fadeIn: () => masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 5),
        fadeOut: () => masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3),
        stop: () => { try { [...oscillators, sub].forEach(o => o.stop()); ctx.close(); } catch { } },
        setVolume: (v) => masterGain.gain.setValueAtTime(v, ctx.currentTime),
    };
}

// ── Voice guidance ────────────────────────────────────────────────────────────
function speakPhase(text, enabled) {
    if (!enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.72;
    utter.pitch = 0.9;
    utter.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('karen') ||
        v.name.toLowerCase().includes('moira') ||
        v.name.toLowerCase().includes('victoria') ||
        v.lang === 'en-GB'
    );
    if (preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
}

// ── BOX BREATHING ─────────────────────────────────────────────────────────────
function BoxBreathingVisual({ phaseIndex, secondsLeft, currentPhase, totalPhaseDuration, running }) {
    const SIZE = 180;
    const R = 14;
    const progress = running ? (totalPhaseDuration - secondsLeft) / totalPhaseDuration : 0;
    const sideStart = phaseIndex * SIZE;
    const dotOffset = sideStart + progress * SIZE;
    const perim = SIZE * 4;
    const o = Math.min(dotOffset, perim - 0.1);

    let dx, dy;
    if (o < SIZE) { dx = o; dy = 0; }
    else if (o < SIZE * 2) { dx = SIZE; dy = o - SIZE; }
    else if (o < SIZE * 3) { dx = SIZE - (o - SIZE * 2); dy = SIZE; }
    else { dx = 0; dy = SIZE - (o - SIZE * 3); }

    const color = currentPhase?.color || '#6366f1';
    const labels = ['breathe in', 'hold', 'breathe out', 'hold'];
    const active = phaseIndex % 4;

    return (
        <div className="flex items-center justify-center" style={{ height: '280px' }}>
            <svg width="300" height="280" viewBox="-55 -45 290 270">
                <defs>
                    <filter id="boxGlow">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
                <rect x={0} y={0} width={SIZE} height={SIZE} rx={R}
                    fill="none" stroke="#1e293b" strokeWidth="2" />
                {[
                    [[0, 0], [SIZE, 0]],
                    [[SIZE, 0], [SIZE, SIZE]],
                    [[SIZE, SIZE], [0, SIZE]],
                    [[0, SIZE], [0, 0]],
                ].map(([[x1, y1], [x2, y2]], i) => (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke={color}
                        strokeWidth={active === i ? 2.5 : 1}
                        opacity={active === i ? 1 : 0.15}
                        strokeLinecap="round"
                        style={{ transition: 'opacity 0.5s, stroke-width 0.5s' }}
                    />
                ))}
                {[[0, 0], [SIZE, 0], [SIZE, SIZE], [0, SIZE]].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="4" fill={color} opacity={0.3} />
                ))}
                {[
                    { text: labels[0], x: SIZE / 2, y: -20, anchor: 'middle' },
                    { text: labels[1], x: SIZE + 22, y: SIZE / 2 + 4, anchor: 'start' },
                    { text: labels[2], x: SIZE / 2, y: SIZE + 24, anchor: 'middle' },
                    { text: labels[3], x: -22, y: SIZE / 2 + 4, anchor: 'end' },
                ].map((l, i) => (
                    <text key={i} x={l.x} y={l.y} textAnchor={l.anchor}
                        fontSize="10" fontWeight={active === i ? '800' : '500'}
                        fill={active === i ? color : '#475569'}
                        letterSpacing="0.08em"
                        style={{ transition: 'fill 0.4s' }}>
                        {l.text}
                    </text>
                ))}
                <text x={SIZE / 2} y={SIZE / 2 - 6} textAnchor="middle"
                    fontSize="42" fontWeight="900" fill="white">{secondsLeft}</text>
                <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle"
                    fontSize="9" fontWeight="700" fill={color} letterSpacing="0.18em">SECONDS</text>
                <circle cx={dx} cy={dy} r="8" fill={color} filter="url(#boxGlow)" />
                <circle cx={dx} cy={dy} r="4" fill="white" opacity="0.9" />
            </svg>
        </div>
    );
}

// ── 4-7-8 CIRCLE — no rings ───────────────────────────────────────────────────
function CircleBreathingVisual({ phaseIndex, secondsLeft, currentPhase, totalPhaseDuration, running }) {
    const progress = running ? (totalPhaseDuration - secondsLeft) / totalPhaseDuration : 0;
    const isInhale = currentPhase?.label?.toLowerCase().includes('inhale');
    const isHold = currentPhase?.label?.toLowerCase().includes('hold');
    const scale = isInhale ? 0.5 + progress * 0.5
        : isHold ? 1.0
            : 1.0 - progress * 0.5;
    const color = currentPhase?.color || '#6366f1';

    return (
        <div className="flex items-center justify-center" style={{ height: '280px' }}>
            <div className="relative flex items-center justify-center"
                style={{ width: '240px', height: '240px' }}>
                <div className="absolute rounded-full"
                    style={{
                        width: '200px', height: '200px',
                        background: `radial-gradient(circle at 40% 35%, ${color}40 0%, ${color}10 60%, transparent 80%)`,
                        border: `1.5px solid ${color}50`,
                        transform: `scale(${scale})`,
                        transition: `transform ${totalPhaseDuration * 0.95}s ease-in-out`,
                        boxShadow: `0 0 40px ${color}20, inset 0 0 30px ${color}10`,
                    }} />
                <div className="absolute rounded-full"
                    style={{
                        width: '60px', height: '60px',
                        background: `radial-gradient(circle, ${color}60 0%, transparent 70%)`,
                        transform: `scale(${scale})`,
                        transition: `transform ${totalPhaseDuration * 0.95}s ease-in-out`,
                    }} />
                <div className="relative text-center z-10">
                    <p className="text-6xl font-black text-white leading-none">{secondsLeft}</p>
                    <p className="text-[10px] uppercase tracking-widest mt-1 font-bold" style={{ color }}>sec</p>
                </div>
            </div>
        </div>
    );
}

// ── SIGH — lung bars ──────────────────────────────────────────────────────────
function SighVisual({ phaseIndex, secondsLeft, currentPhase, totalPhaseDuration, running }) {
    const progress = running ? (totalPhaseDuration - secondsLeft) / totalPhaseDuration : 0;
    const isExhale = currentPhase?.label?.toLowerCase().includes('exhale');
    const isSniff = phaseIndex === 1;
    const color = currentPhase?.color || '#6366f1';
    const leftFill = isExhale ? (1 - progress) * 100 : progress * 100;
    const rightFill = isSniff
        ? Math.min(progress * 40 + 60, 100)
        : isExhale ? (1 - progress) * 100 : progress * 100;

    return (
        <div className="flex flex-col items-center justify-center gap-6" style={{ height: '280px' }}>
            <div className="text-center">
                <p className="text-6xl font-black text-white leading-none">{secondsLeft}</p>
                <p className="text-[10px] uppercase tracking-widest mt-1 font-bold" style={{ color }}>sec</p>
            </div>
            <div className="flex gap-5 items-end">
                {[leftFill, rightFill].map((fill, i) => (
                    <div key={i}>
                        <p className="text-[9px] text-center mb-2 font-bold uppercase tracking-widest"
                            style={{ color: '#475569' }}>{i === 0 ? 'L' : 'R'}</p>
                        <div className="relative rounded-2xl overflow-hidden"
                            style={{ width: '40px', height: '110px', background: '#0f172a', border: `1px solid ${color}25` }}>
                            <div className="absolute bottom-0 w-full rounded-2xl"
                                style={{
                                    height: `${fill}%`,
                                    background: `linear-gradient(to top, ${color}, ${color}70)`,
                                    transition: `height ${totalPhaseDuration * 0.95}s ease-in-out`,
                                    boxShadow: `0 -4px 20px ${color}50`,
                                }} />
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
                {isExhale ? 'releasing air' : isSniff ? 'topping up' : 'filling lungs'}
            </p>
        </div>
    );
}

// ── BODY SCAN ─────────────────────────────────────────────────────────────────
function BodyScanVisual({ phaseIndex, secondsLeft, currentPhase }) {
    const color = currentPhase?.color || '#10b981';
    const active = Math.min(phaseIndex, 7);
    const bodyPartLabels = ['Feet', 'Calves', 'Thighs', 'Hips & Core', 'Chest', 'Arms & Hands', 'Neck & Jaw', 'Face & Scalp'];

    return (
        <div className="flex items-center justify-center gap-8" style={{ height: '280px' }}>
            <svg width="100" height="220" viewBox="0 0 90 210">
                <defs>
                    <filter id="scanGlow">
                        <feGaussianBlur stdDeviation="3.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <radialGradient id="scanGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={color} stopOpacity="0.75" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.2" />
                    </radialGradient>
                </defs>
                {/* Base body */}
                <circle cx="45" cy="15" r="13" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="39" y="27" width="12" height="10" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                <rect x="25" y="36" width="40" height="48" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="8" y="38" width="15" height="48" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="67" y="38" width="15" height="48" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="23" y="82" width="44" height="18" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="24" y="97" width="18" height="34" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="48" y="97" width="18" height="34" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="24" y="129" width="18" height="38" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="48" y="129" width="18" height="38" rx="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <ellipse cx="33" cy="171" rx="13" ry="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <ellipse cx="57" cy="171" rx="13" ry="7" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                {/* Highlights */}
                {active === 0 && <>
                    <ellipse cx="33" cy="171" rx="13" ry="7" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                    <ellipse cx="57" cy="171" rx="13" ry="7" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                    <ellipse cx="45" cy="174" rx="22" ry="10" fill="none" stroke={color} strokeWidth="1" opacity="0.25">
                        <animate attributeName="rx" values="18;26;18" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                    </ellipse>
                </>}
                {active === 1 && <>
                    <rect x="24" y="129" width="18" height="38" rx="7" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                    <rect x="48" y="129" width="18" height="38" rx="7" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                </>}
                {active === 2 && <>
                    <rect x="24" y="97" width="18" height="34" rx="7" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                    <rect x="48" y="97" width="18" height="34" rx="7" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                </>}
                {active === 3 &&
                    <rect x="23" y="82" width="44" height="18" rx="8" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />}
                {active === 4 &&
                    <rect x="25" y="36" width="40" height="48" rx="10" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />}
                {active === 5 && <>
                    <rect x="8" y="38" width="15" height="48" rx="7" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                    <rect x="67" y="38" width="15" height="48" rx="7" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                </>}
                {active === 6 && <>
                    <rect x="39" y="27" width="12" height="10" rx="4" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                    <ellipse cx="45" cy="25" rx="11" ry="6" fill="url(#scanGrad)" stroke={color} strokeWidth="1.5" filter="url(#scanGlow)" />
                </>}
                {active === 7 && <>
                    <circle cx="45" cy="15" r="13" fill="url(#scanGrad)" stroke={color} strokeWidth="2" filter="url(#scanGlow)" />
                    <circle cx="45" cy="15" r="13" fill="none" stroke={color} strokeWidth="1.5" opacity="0.3">
                        <animate attributeName="r" values="13;20;13" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                    </circle>
                </>}
            </svg>

            {/* Right side */}
            <div className="flex flex-col gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>Releasing</p>
                    <p className="text-lg font-black text-white">{bodyPartLabels[active]}</p>
                </div>
                <div className="text-center">
                    <p className="text-5xl font-black text-white leading-none">{secondsLeft}</p>
                    <p className="text-[9px] uppercase tracking-widest mt-1 font-bold" style={{ color }}>sec</p>
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                    {bodyPartLabels.map((l, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="rounded-full transition-all duration-500"
                                style={{
                                    width: i === active ? '16px' : '6px',
                                    height: '6px',
                                    backgroundColor: i <= active ? color : '#1e293b',
                                    opacity: i < active ? 0.4 : i === active ? 1 : 0.3,
                                    border: `1px solid ${i <= active ? color : '#334155'}`,
                                }} />
                            <p className="text-[9px] font-bold uppercase tracking-wider"
                                style={{ color: i === active ? color : i < active ? '#475569' : '#1e293b' }}>
                                {l}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── VISUALISE ─────────────────────────────────────────────────────────────────
function VisualiseVisual({ phaseIndex, secondsLeft, currentPhase, totalPhaseDuration, running }) {
    const progress = running ? (totalPhaseDuration - secondsLeft) / totalPhaseDuration : 0;
    const color = currentPhase?.color || '#f59e0b';
    const total = 7;

    return (
        <div className="relative flex items-center justify-center" style={{ height: '280px', width: '100%' }}>
            <svg className="absolute" width="220" height="220" viewBox="0 0 220 220">
                <circle cx="110" cy="110" r="90" fill="none" stroke="#1e293b" strokeWidth="1.5" />
                <circle cx="110" cy="110" r="90" fill="none"
                    stroke={color} strokeWidth="2" opacity="0.6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 90}`}
                    strokeDashoffset={`${2 * Math.PI * 90 * (1 - (phaseIndex + progress) / total)}`}
                    transform="rotate(-90 110 110)"
                    style={{ transition: `stroke-dashoffset ${totalPhaseDuration}s linear` }}
                />
                {Array.from({ length: total }).map((_, i) => {
                    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
                    const mx = 110 + 90 * Math.cos(angle);
                    const my = 110 + 90 * Math.sin(angle);
                    return (
                        <circle key={i} cx={mx} cy={my} r="4"
                            fill={i <= phaseIndex ? color : '#1e293b'}
                            stroke={color} strokeWidth="1"
                            opacity={i <= phaseIndex ? 1 : 0.3}
                        />
                    );
                })}
            </svg>
            <div className="relative text-center z-10">
                <div className="text-3xl mb-2">🏆</div>
                <p className="text-5xl font-black text-white leading-none">{secondsLeft}</p>
                <p className="text-[10px] uppercase tracking-widest mt-1 font-bold" style={{ color }}>sec</p>
                <p className="text-[10px] uppercase tracking-widest mt-3 font-bold text-gray-600">
                    step {phaseIndex + 1} of {total}
                </p>
            </div>
        </div>
    );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function MeditationPage() {
    const navigate = useNavigate();
    const role = localStorage.getItem('role');

    const [selected, setSelected] = useState(null);
    const [running, setRunning] = useState(false);
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [round, setRound] = useState(1);
    const [done, setDone] = useState(false);
    const [musicOn, setMusicOn] = useState(true);
    const [voiceOn, setVoiceOn] = useState(true);
    const [volume, setVolume] = useState(0.6);

    const audioRef = useRef(null);
    const timerRef = useRef(null);

    // preload voices on mount
    useEffect(() => { window.speechSynthesis?.getVoices(); }, []);

    const startMusic = useCallback(() => {
        if (!musicOn) return;
        try {
            if (!audioRef.current) audioRef.current = createAmbientAudio();
            audioRef.current.setVolume(volume);
            audioRef.current.fadeIn();
        } catch { }
    }, [musicOn, volume]);

    const stopMusic = useCallback(() => {
        try {
            audioRef.current?.fadeOut();
            setTimeout(() => { audioRef.current?.stop(); audioRef.current = null; }, 2500);
        } catch { }
    }, []);

    useEffect(() => {
        if (audioRef.current) audioRef.current.setVolume(volume);
    }, [volume]);

    // ── Timer + voice ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!running || !selected) return;
        const phases = selected.phases;
        const phase = phases[phaseIndex];
        setSecondsLeft(phase.duration);

        // speak for bodyscan and visualise
        if (selected.id === 'bodyscan' || selected.id === 'visualise') {
            speakPhase(phase.label, voiceOn);
        }

        timerRef.current = setInterval(() => {
            setSecondsLeft(s => {
                if (s <= 1) {
                    clearInterval(timerRef.current);
                    const next = phaseIndex + 1;
                    if (next < phases.length) {
                        setPhaseIndex(next);
                    } else {
                        if (round < selected.rounds) {
                            setRound(r => r + 1);
                            setPhaseIndex(0);
                        } else {
                            setRunning(false);
                            setDone(true);
                            stopMusic();
                            window.speechSynthesis?.cancel();
                        }
                    }
                    return 0;
                }
                return s - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [running, phaseIndex, round, selected]);

    const handleStart = (ex) => {
        setSelected(ex); setPhaseIndex(0); setRound(1);
        setDone(false); setRunning(true); startMusic();
    };

    const handleStop = () => {
        clearInterval(timerRef.current);
        window.speechSynthesis?.cancel();
        setRunning(false); setSelected(null); setDone(false); stopMusic();
    };

    const currentPhase = selected?.phases[phaseIndex];
    const totalPhaseDuration = currentPhase?.duration || 1;
    const backPath = role === 'coach' ? '/dashboard' : '/athlete-dashboard';
    const isVoiceExercise = selected?.id === 'bodyscan' || selected?.id === 'visualise';

    const renderVisual = () => {
        switch (selected?.id) {
            case 'box':
                return <BoxBreathingVisual phaseIndex={phaseIndex} secondsLeft={secondsLeft}
                    currentPhase={currentPhase} totalPhaseDuration={totalPhaseDuration} running={running} />;
            case '478':
                return <CircleBreathingVisual phaseIndex={phaseIndex} secondsLeft={secondsLeft}
                    currentPhase={currentPhase} totalPhaseDuration={totalPhaseDuration} running={running} />;
            case 'sigh':
                return <SighVisual phaseIndex={phaseIndex} secondsLeft={secondsLeft}
                    currentPhase={currentPhase} totalPhaseDuration={totalPhaseDuration} running={running} />;
            case 'bodyscan':
                return <BodyScanVisual phaseIndex={phaseIndex} secondsLeft={secondsLeft}
                    currentPhase={currentPhase} />;
            case 'visualise':
                return <VisualiseVisual phaseIndex={phaseIndex} secondsLeft={secondsLeft}
                    currentPhase={currentPhase} totalPhaseDuration={totalPhaseDuration} running={running} />;
            default: return null;
        }
    };

    // ── Done ──────────────────────────────────────────────────────────────────
    if (done) return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
                <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-4xl mx-auto mb-6">✨</div>
                <h2 className="text-3xl font-black text-white mb-2">Session Complete</h2>
                <p className="text-gray-400 text-sm mb-1">{selected?.name}</p>
                <p className="text-gray-600 text-sm mb-8">
                    {selected?.rounds > 1 ? `${selected.rounds} rounds` : 'Sequence complete'} · Well done.
                </p>
                <div className="flex gap-3 justify-center">
                    <button onClick={() => { setDone(false); setSelected(null); }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition">
                        Try Another
                    </button>
                    <button onClick={() => navigate(backPath)}
                        className="border border-gray-700 text-gray-400 hover:text-white px-6 py-3 rounded-xl font-bold text-sm transition">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Active session ────────────────────────────────────────────────────────
    if (running && selected) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6"
            style={{ background: '#111827' }}>
            <div className="w-full max-w-lg">

                {/* Top bar */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">{selected.name}</p>
                        {selected.rounds > 1 && (
                            <p className="text-xs text-gray-500 mt-0.5">Round {round} of {selected.rounds}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Voice toggle during session */}
                        {isVoiceExercise && (
                            <button onClick={() => {
                                setVoiceOn(v => {
                                    if (v) window.speechSynthesis?.cancel();
                                    return !v;
                                });
                            }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition ${voiceOn
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                                {voiceOn ? '🔊 Voice' : '🔇 Voice'}
                            </button>
                        )}
                        {/* Round pips */}
                        {selected.rounds > 1 && (
                            <div className="flex gap-1.5">
                                {Array.from({ length: selected.rounds }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300"
                                        style={{
                                            width: '6px', height: '6px',
                                            backgroundColor: i <= round - 1 ? currentPhase?.color : '#1e293b',
                                            opacity: i < round - 1 ? 0.35 : 1,
                                            border: `1px solid ${i <= round - 1 ? currentPhase?.color : '#334155'}`,
                                        }} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Visual */}
                {renderVisual()}

                {/* Phase label — hidden for voice exercises (eyes closed) */}
                {!isVoiceExercise && (
                    <div className="text-center mt-4 mb-2">
                        <p className="text-xl font-black text-white tracking-tight">{currentPhase?.label}</p>
                    </div>
                )}

                {/* Voice exercises: show subtle "listening" indicator instead */}
                {isVoiceExercise && (
                    <div className="text-center mt-4 mb-2">
                        {voiceOn ? (
                            <div className="flex items-center justify-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600">
                                    audio guidance active
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs font-black text-white tracking-tight">{currentPhase?.label}</p>
                        )}
                    </div>
                )}

                {/* Phase dots */}
                <div className="flex justify-center gap-2 mb-8 mt-3">
                    {selected.phases.map((_, i) => (
                        <div key={i} className="rounded-full transition-all duration-400"
                            style={{
                                height: '6px',
                                width: i === phaseIndex ? '24px' : '6px',
                                backgroundColor: i === phaseIndex ? currentPhase?.color : '#1e293b',
                                border: `1px solid ${i === phaseIndex ? currentPhase?.color : '#334155'}`,
                            }} />
                    ))}
                </div>

                <div className="flex justify-center">
                    <button onClick={handleStop}
                        className="border border-gray-700 hover:border-gray-600 text-gray-600 hover:text-gray-300 px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition">
                        End Session
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Selection screen ──────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10">
            <div className="max-w-2xl mx-auto">

                <div className="flex items-start justify-between mb-10 gap-4">
                    <div>
                        <button onClick={() => navigate(backPath)}
                            className="text-gray-600 hover:text-white text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 transition">
                            ← Back
                        </button>
                        <h1 className="text-3xl font-black tracking-tight">Mental Performance</h1>
                        <p className="text-gray-500 text-sm mt-1">Science-backed breathing & focus techniques.</p>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-end gap-2 mt-8">
                        <button onClick={() => setMusicOn(m => !m)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${musicOn ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                                : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                            {musicOn ? '🎵 Music On' : '🔇 Music Off'}
                        </button>
                        <button onClick={() => setVoiceOn(v => !v)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${voiceOn ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                            {voiceOn ? '🔊 Voice On' : '🔇 Voice Off'}
                        </button>
                        {musicOn && (
                            <input type="range" min="0" max="1" step="0.05" value={volume}
                                onChange={e => setVolume(parseFloat(e.target.value))}
                                className="w-20 accent-indigo-500" />
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {EXERCISES.map(ex => (
                        <div key={ex.id}
                            className="bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-2xl p-5 transition-all cursor-pointer group"
                            onClick={() => handleStart(ex)}>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="w-1 self-stretch rounded-full flex-shrink-0"
                                        style={{ backgroundColor: ex.accentColor, opacity: 0.7 }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <h3 className="text-white font-black text-base">{ex.name}</h3>
                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                                                style={{ backgroundColor: `${ex.accentColor}20`, color: ex.accentColor }}>
                                                {ex.tag}
                                            </span>
                                            {(ex.id === 'bodyscan' || ex.id === 'visualise') && (
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    🔊 voice
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-500 text-xs mb-3 leading-relaxed">{ex.description}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {ex.phases.map((p, i) => (
                                                <span key={i} className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg"
                                                    style={{ backgroundColor: `${p.color}12`, color: p.color, border: `1px solid ${p.color}25` }}>
                                                    {p.label} {p.duration}s
                                                </span>
                                            ))}
                                            {ex.rounds > 1 && (
                                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-gray-700 text-gray-400 border border-gray-600">
                                                    ×{ex.rounds}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button className="shrink-0 text-xs font-black px-4 py-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 text-white"
                                    style={{ backgroundColor: ex.accentColor }}>
                                    Start →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="text-gray-800 text-[10px] text-center mt-10 uppercase tracking-widest font-bold">
                    AthleteIQ · Mental Performance
                </p>
            </div>
        </div>
    );
}