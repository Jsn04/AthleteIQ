import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AcademyLogin from './pages/AcademyLogin';
import Dashboard from './pages/Dashboard';
import AthleteCheckIn from './pages/AthleteCheckIn';
import AthleteList from './pages/AthleteList';
import AthleteProfile from './pages/AthleteProfile';
import ParentView from './pages/ParentView';
import SportDashboard from './pages/SportDashboard';
import AthleteDashboard from './pages/AthleteDashboard';
import SessionPlannerPage from './pages/SessionPlannerPage';
import MeditationPage from './pages/MeditationPage';
import AcademyProfile from './pages/AcademyProfile';


const ProtectedRoute = ({ children, allowedRole }) => {
  const role = localStorage.getItem('role');
  const academyId = localStorage.getItem('academyId');

  if (!academyId) return <Navigate to="/" />;
  if (!role) return <Navigate to="/login" />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/login" />;
  return children;
};

const AcademyRoute = ({ children }) => {
  const academyId = localStorage.getItem('academyId');
  if (!academyId) return <Navigate to="/" />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AcademyLogin />} />

        <Route path="/login" element={
          <AcademyRoute><Login /></AcademyRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute allowedRole="coach"><Dashboard /></ProtectedRoute>
        } />
        <Route path="/athletes" element={
          <ProtectedRoute allowedRole="coach"><AthleteList /></ProtectedRoute>
        } />
        <Route path="/athlete/:name" element={
          <ProtectedRoute allowedRole="coach"><AthleteProfile /></ProtectedRoute>
        } />
        <Route path="/sport/:sport" element={
          <ProtectedRoute allowedRole="coach"><SportDashboard /></ProtectedRoute>
        } />
        <Route path="/session-planner" element={
          <ProtectedRoute allowedRole="coach"><SessionPlannerPage /></ProtectedRoute>
        } />

        <Route path="/checkin" element={
          <ProtectedRoute allowedRole="athlete"><AthleteCheckIn /></ProtectedRoute>
        } />
        <Route path="/athlete-dashboard" element={
          <ProtectedRoute allowedRole="athlete"><AthleteDashboard /></ProtectedRoute>
        } />

        <Route path="/parent" element={
          <AcademyRoute><ParentView /></AcademyRoute>
        } />

        <Route path="/meditation" element={
          <AcademyRoute><MeditationPage /></AcademyRoute>
        } />
        <Route path="/academy-profile" element={
          <AcademyRoute><AcademyProfile /></AcademyRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;