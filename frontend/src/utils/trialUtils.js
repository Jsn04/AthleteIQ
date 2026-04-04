export function isTrialActive() {
    const plan = localStorage.getItem('plan');
    if (plan === 'paid') return true;

    const trialEndsAt = localStorage.getItem('trialEndsAt');
    if (!trialEndsAt) return false;

    return new Date() < new Date(trialEndsAt);
}