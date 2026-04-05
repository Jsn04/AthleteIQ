import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UpgradeModal from './UpgradeModal';

export default function AcademyProfile() {
    const navigate = useNavigate();
    const [showUpgrade, setShowUpgrade] = useState(false);

    const academyName = localStorage.getItem('academyName') || 'Unknown Academy';
    const plan = localStorage.getItem('plan') || 'free';
    const trialEndsAt = localStorage.getItem('trialEndsAt');

    const trialExpiry = trialEndsAt ? new Date(trialEndsAt) : null;
    const now = new Date();
    const daysLeft = trialExpiry ? Math.max(0, Math.ceil((trialExpiry - now) / (1000 * 60 * 60 * 24))) : 0;
    const trialActive = trialExpiry ? now < trialExpiry : false;
    const trialExpired = plan === 'free' && !trialActive;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10">
            <div className="max-w-xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Academy Profile</h1>
                        <p className="text-gray-500 text-sm mt-1">Your academy details and plan</p>
                    </div>
                    <button onClick={() => navigate('/dashboard')}
                        className="border border-gray-600 text-gray-400 px-4 py-2 rounded-xl text-sm hover:border-blue-500 hover:text-blue-400 transition">
                        ← Dashboard
                    </button>
                </div>

                {/* Academy Card */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-4">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-2xl shrink-0">
                            {academyName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">{academyName}</h2>
                            <p className="text-gray-500 text-xs uppercase tracking-widest font-bold mt-0.5">Academy</p>
                        </div>
                    </div>

                    {/* Plan */}
                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-3">
                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Current Plan</p>
                        <div className="flex items-center gap-3">
                            {plan === 'paid' ? (
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-sm px-4 py-1.5 rounded-full uppercase tracking-wider">
                                    ✅ Pro
                                </span>
                            ) : (
                                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black text-sm px-4 py-1.5 rounded-full uppercase tracking-wider">
                                    Free Trial
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Trial status */}
                    {plan === 'free' && (
                        <div className={`rounded-xl p-4 border mb-3 ${trialExpired
                            ? 'bg-red-500/10 border-red-500/20'
                            : daysLeft <= 3
                                ? 'bg-amber-500/10 border-amber-500/20'
                                : 'bg-gray-900 border-gray-700'}`}>
                            <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Trial Status</p>
                            {trialExpired ? (
                                <p className="text-red-400 font-black text-sm">❌ Trial Expired</p>
                            ) : (
                                <div>
                                    <p className={`font-black text-sm ${daysLeft <= 3 ? 'text-amber-400' : 'text-white'}`}>
                                        {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                                    </p>
                                    <p className="text-gray-500 text-xs mt-1">
                                        Expires {trialExpiry?.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Features */}
                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-3">Features</p>
                        <div className="space-y-2">
                            {[
                                { label: 'Athlete Management', active: true },
                                { label: 'Wellness Check-ins', active: trialActive || plan === 'paid' },
                                { label: 'AI Insights', active: trialActive || plan === 'paid' },
                                { label: 'Session Planner', active: trialActive || plan === 'paid' },
                                { label: 'Mental Performance', active: trialActive || plan === 'paid' },
                                { label: 'Parent Portal', active: true },
                            ].map(f => (
                                <div key={f.label} className="flex items-center justify-between">
                                    <p className={`text-sm font-bold ${f.active ? 'text-white' : 'text-gray-600'}`}>
                                        {f.label}
                                    </p>
                                    <span className={`text-xs font-black ${f.active ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {f.active ? '✅' : '🔒'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Upgrade CTA */}
                {(plan === 'free' || plan === 'paid') && (
                    <div className={`rounded-2xl p-6 border text-center ${trialExpired
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                        <p className="font-black text-white text-lg mb-1">
                            {plan === 'paid' ? 'Upgrade Your Plan' : trialExpired ? 'Your trial has ended' : 'Upgrade to Pro'}
                        </p>
                        <p className="text-gray-400 text-sm mb-4">
                            {plan === 'paid'
                                ? 'Move to a higher plan for more features and priority support.'
                                : trialExpired
                                    ? 'Your data is safe. Contact us to continue coaching.'
                                    : 'Unlock unlimited access for your academy.'}
                        </p>
                        <button onClick={() => setShowUpgrade(true)}
                            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-xl text-sm transition">
                            View Plans & Upgrade →
                        </button>
                    </div>
                )}

                {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
            </div>
        </div>
    );
}