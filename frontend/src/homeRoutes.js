// Gym academies run a parallel set of dashboards. Every "back to dashboard"
// link has to resolve against the academy type, otherwise a gym trainer lands
// on the sport dashboard and gets bounced back out to login.

export const isGymAcademy = () =>
  (localStorage.getItem('academyType') || 'sport') === 'gym';

export const coachHome = () => (isGymAcademy() ? '/gym-dashboard' : '/dashboard');

export const athleteHome = () =>
  isGymAcademy() ? '/gym-member-dashboard' : '/athlete-dashboard';

export const homeForRole = (role) =>
  role === 'coach' ? coachHome() : athleteHome();
