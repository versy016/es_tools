import './App.css';
import './stylessheets/screens.css';
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import NavBar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Reports from './screens/Reports';
import UserManagement from './screens/UserManagement';
import Profile from './screens/Profile';
import ServiceLocater from './tools/ServiceLocater';
import PhotoReport from './tools/PhotoReport';

const roleLabel = (r) => (r || 'surveyor').replace(/^./, (c) => c.toUpperCase());

const AppShell = () => {
  const { userName, role, signOut } = useAuth();
  const [search, setSearch] = useState('');
  return (
    <div className="App">
      <NavBar userName={userName} role={roleLabel(role)} search={search} onSearch={setSearch} onSignOut={signOut} />
      <main className="app-main">
        <Outlet context={{ search, userName, signOut, role }} />
      </main>
    </div>
  );
};

// Wrap a goBack-style tool so it can navigate back to the dashboard via the router.
const withBack = (Component) => function Wrapped() {
  const navigate = useNavigate();
  return <Component goBack={() => navigate('/dashboard')} />;
};
const PhotoReportRoute = withBack(PhotoReport);
const ServiceLocaterRoute = withBack(ServiceLocater);

// Only managers/admins may reach user management; everyone else is bounced to the dashboard.
const RequireManager = ({ children }) => {
  const { role } = useAuth();
  return ['admin', 'manager'].includes(String(role).toLowerCase())
    ? children
    : <Navigate to="/dashboard" replace />;
};

const Routed = () => (
  <Routes>
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/users" element={<RequireManager><UserManagement /></RequireManager>} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/tools/photo-report" element={<PhotoReportRoute />} />
      <Route path="/tools/service-location" element={<ServiceLocaterRoute />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>
);

const ConfigureNotice = () => (
  <div className="boot-notice">
    <h2>Connect Supabase</h2>
    <p>Set <code>REACT_APP_SUPABASE_URL</code> and <code>REACT_APP_SUPABASE_PUBLISHABLE_KEY</code> in a
      <code>.env</code> file, then restart. See <code>supabase/SETUP.md</code>.</p>
  </div>
);

const Gate = () => {
  const { configured, loading, session } = useAuth();
  if (!configured) return <ConfigureNotice />;
  if (loading) return <div className="boot-notice"><p>Loading…</p></div>;
  if (!session) return <Login />;
  return <Routed />;
};

const AppRoot = () => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default AppRoot;
