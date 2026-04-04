import React, { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';
import { isTrialActive } from '../utils/trialUtils';


const EFFORT_OPTIONS = [
    {
        label: 'Light',
        sub: 'Easy session',
        intensity: 'Low',
        rpe: 4,
        color: 'border-teal-500 bg-teal-500/10 text-teal-700',
        dot: 'bg-teal-500',
    },
    {
        label: 'Medium',
        sub: 'Normal session',
        intensity: 'Medium',
        rpe: 6,
        color: 'border-amber-500 bg-amber-500/10 text-amber-700',
        dot: 'bg-amber-500',
    },
    {
        label: 'Heavy',
        sub: 'Pushed hard',
        intensity: 'High',
        rpe: 8,
        color: 'border-rose-500 bg-rose-500/10 text-rose-700',
        dot: 'bg-rose-500',
    },
];

const INACTIVE = 'border-gray-700 bg-gray-800/60 text-gray-400';

function AthleteCard({ athlete, index, total, data, onChange }) {
    const [showNote, setShowNote] = useState(false);

    const selected = EFFORT_OPTIONS.find(o => o.intensity === data.intensity);

    return (
        <div className="flex flex-col gap-4">

            {/* Progress indicator */}
            <div className="flex items-center justify-between">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                    Athlete {index + 1} of {total}
                </p>
                <div className="flex gap-1.5">
                    {Array.from({ length: total }).map((_, i) => (
                        <div
                            key={i}
                            className={`rounded-full transition-all ${i < index
                                    ? 'w-2 h-2 bg-teal-500'
                                    : i === index
                                        ? 'w-4 h-2 bg-purple-500'
                                        : 'w-2 h-2 bg-gray-700'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Athlete identity */}
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-2xl shrink-0">
                    {athlete.name[0]}
                </div>
                <div>
                    <h3 className="text-xl font-black text-white">{athlete.name}</h3>
                    <p className="text-gray-500 text-xs font-bold uppercase mt-0.5">
                        {athlete.sport}{athlete.age ? ` · Age ${athlete.age}` : ''}
                    </p>
                </div>
            </div>

            {/* Question */}
            <p className="text-gray-300 text-sm font-bold">
                How hard did {athlete.name.split(' ')[0]} work today?
            </p>

            {/* Effort buttons */}
            <div className="grid grid-cols-3 gap-3">
                {EFFORT_OPTIONS.map(opt => (
                    <button
                        key={opt.label}
                        onClick={() => onChange({ ...data, intensity: opt.intensity, rpe: opt.rpe, sat_out: false })}
                        className={`py-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-1 ${data.intensity === opt.intensity && !data.sat_out
                                ? opt.color
                                : INACTIVE
                            }`}
                    >
                        <span className="text-base font-black">{opt.label}</span>
                        <span className="text-xs opacity-70 font-normal">{opt.sub}</span>
                    </button>
                ))}
            </div>

            {/* Sat out button */}
            <button
                onClick={() => onChange({ ...data, sat_out: !data.sat_out, intensity: data.sat_out ? 'Medium' : null, rpe: data.sat_out ? 6 : 0 })}
                className={`w-full py-3 rounded-xl border-2 text-sm font-bold transition-all ${data.sat_out
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-gray-700 bg-gray-800/60 text-gray-500 hover:border-gray-500'
                    }`}
            >
                {data.sat_out ? '✕ Marked as sat out / injured' : 'Sat out or injured today'}
            </button>

            {/* Optional note */}
            {!showNote ? (
                <button
                    onClick={() => setShowNote(true)}
                    className="text-gray-600 hover:text-gray-400 text-xs font-bold uppercase tracking-widest transition text-left"
                >
                    + Add a note (optional)
                </button>
            ) : (
                <textarea
                    value={data.note}
                    onChange={e => onChange({ ...data, note: e.target.value })}
                    rows={2}
                    placeholder={`Any observation about ${athlete.name.split(' ')[0]} today...`}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition resize-none text-sm"
                    autoFocus
                />
            )}
        </div>
    );
}

export default function BulkLogModal({ athletes, duration, onClose, onSuccess }) {
    const [step, setStep] = useState('setup'); // 'setup' | 'swipe' | 'review' | 'done'
    const [duration_, setDuration] = useState(duration || 90);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Per-athlete data keyed by athlete id
    const [athleteData, setAthleteData] = useState(() =>
        Object.fromEntries(
            athletes.map(a => [a.id, { intensity: 'Medium', rpe: 6, note: '', sat_out: false }])
        )
    );

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');


    const updateAthlete = (id, data) => {
        setAthleteData(prev => ({ ...prev, [id]: data }));
    };

    const currentAthlete = athletes[currentIndex];
    const currentData = athleteData[currentAthlete?.id];

    const canAdvance = currentData && (currentData.sat_out || currentData.intensity != null);

    const handleNext = () => {
        if (currentIndex < athletes.length - 1) {
            setCurrentIndex(i => i + 1);
        } else {
            setStep('review');
        }
    };

    const handleBack = () => {
        if (currentIndex > 0) setCurrentIndex(i => i - 1);
    };

    const handleSubmit = async () => {
        if (!isTrialActive()) {
            setSubmitError('Your 14-day free trial has expired. Contact us to upgrade.');
            return;
        }
        setSubmitting(true);
        const academyId = localStorage.getItem('academyId') || '';

        try {
            await axios.post(
                `${API_BASE_URL}/wellness/bulk-training-log?academy_id=${academyId}`,
                {
                    duration: parseInt(duration_),
                    logs: athletes.map(a => {
                        const d = athleteData[a.id];
                        return {
                            athlete_name: a.name.trim(),
                            intensity: d.sat_out ? 'Low' : d.intensity,
                            duration: d.sat_out ? 0 : parseInt(duration_),
                            rpe: d.sat_out ? 0 : d.rpe,
                            coach_notes: d.sat_out
                                ? `Sat out. ${d.note || ''}`.trim()
                                : d.note || '',
                            attended: !d.sat_out,
                        };
                    }),
                }
            );
            setStep('done');
            setTimeout(() => { onSuccess(); onClose(); }, 1800);
        } catch (err) {
            console.error('Bulk log error:', err);
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800">
                    <div>
                        <p className="text-white font-black text-base">Log Today's Session</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                            {step === 'setup' && 'Set session details'}
                            {step === 'swipe' && `${athletes.length} athletes · swipe through each`}
                            {step === 'review' && 'Check before saving'}
                            {step === 'done' && 'All saved!'}
                        </p>
                    </div>
                    {step !== 'done' && (
                        <button onClick={onClose} className="text-gray-600 hover:text-white transition text-xl leading-none">✕</button>
                    )}
                </div>

                <div className="px-6 py-5">

                    {/* ── STEP 1: Setup ── */}
                    {step === 'setup' && (
                        <div className="flex flex-col gap-5">
                            <div>
                                <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-3">
                                    How long was today's session?
                                </p>
                                <div className="grid grid-cols-4 gap-2">
                                    {[45, 60, 90, 120].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDuration(d)}
                                            className={`py-3 rounded-xl border-2 text-sm font-black transition-all ${duration_ === d
                                                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                                                    : 'border-gray-700 text-gray-500 hover:border-gray-500'
                                                }`}
                                        >
                                            {d}m
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-3 flex items-center gap-3">
                                    <span className="text-gray-600 text-xs">Custom:</span>
                                    <input
                                        type="number"
                                        value={duration_}
                                        onChange={e => setDuration(Number(e.target.value))}
                                        className="w-24 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition"
                                        min="10"
                                        max="300"
                                    />
                                    <span className="text-gray-600 text-xs">minutes</span>
                                </div>
                            </div>

                            <div className="bg-gray-800/60 rounded-xl px-4 py-3 border border-gray-700">
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    You'll go through each athlete one by one and pick their effort level.
                                    Takes about <span className="text-white font-bold">2–3 minutes</span> for {athletes.length} athletes.
                                </p>
                            </div>

                            <button
                                onClick={() => setStep('swipe')}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-black text-base transition-all"
                            >
                                Start logging  →
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: Swipe ── */}
                    {step === 'swipe' && currentAthlete && (
                        <div className="flex flex-col gap-5">
                            <AthleteCard
                                athlete={currentAthlete}
                                index={currentIndex}
                                total={athletes.length}
                                data={currentData}
                                onChange={data => updateAthlete(currentAthlete.id, data)}
                            />

                            <div className="flex gap-3 pt-1">
                                {currentIndex > 0 && (
                                    <button
                                        onClick={handleBack}
                                        className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-bold text-sm hover:border-gray-500 transition"
                                    >
                                        ← Back
                                    </button>
                                )}
                                <button
                                    onClick={handleNext}
                                    disabled={!canAdvance}
                                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${canAdvance
                                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                        }`}
                                >
                                    {currentIndex === athletes.length - 1 ? 'Review all →' : 'Next athlete →'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: Review ── */}
                    {step === 'review' && (
                        <div className="flex flex-col gap-4">
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                                Review — {athletes.length} athletes
                            </p>

                            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                                {athletes.map((a, i) => {
                                    const d = athleteData[a.id];
                                    const effort = EFFORT_OPTIONS.find(o => o.intensity === d.intensity);
                                    return (
                                        <div
                                            key={a.id}
                                            className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 border border-gray-700"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                                                    {a.name[0]}
                                                </div>
                                                <div>
                                                    <p className="text-white text-sm font-bold">{a.name}</p>
                                                    {d.note && (
                                                        <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[160px]">
                                                            {d.note}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {d.sat_out ? (
                                                    <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
                                                        Sat out
                                                    </span>
                                                ) : (
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${effort?.color || ''}`}>
                                                        {d.intensity}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => { setCurrentIndex(i); setStep('swipe'); }}
                                                    className="text-gray-600 hover:text-gray-300 text-xs transition"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {submitError && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                    <p className="text-red-400 text-sm font-bold">⚠️ {submitError}</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => { setCurrentIndex(athletes.length - 1); setStep('swipe'); }}
                                    className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-bold text-sm hover:border-gray-500 transition"
                                >
                                    ← Go back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black text-sm transition-all"
                                >
                                    {submitting ? 'Saving...' : `Save all ${athletes.length} athletes`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Done ── */}
                    {step === 'done' && (
                        <div className="text-center py-8">
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-white font-black text-xl mb-1">All logged!</p>
                            <p className="text-gray-400 text-sm">
                                {athletes.length} athletes saved · AI is updating now
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}