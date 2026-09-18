import { PAYMENT_REQUIRED_EVENT } from '../api';

export function isTrialActive() {
    const plan = localStorage.getItem('plan');
    if (plan === 'paid') return true;

    const trialEndsAt = localStorage.getItem('trialEndsAt');
    if (!trialEndsAt) return false;

    return new Date() < new Date(trialEndsAt);
}
/**
 * Client-side guard for actions the server will reject with a 402 anyway.
 * Returns false and opens the upgrade prompt, so the user gets a way to pay
 * instead of a dead-end "contact us" message.
 */
export function requireTrial() {
    if (isTrialActive()) return true;
    window.dispatchEvent(
        new CustomEvent(PAYMENT_REQUIRED_EVENT, {
            detail: 'Your free trial has expired.',
        })
    );
    return false;
}
