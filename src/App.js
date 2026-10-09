// App.js — application router shell. Composes the auth + toast providers, the
// boot Gate (configure / loading / login / routed), the authenticated AppShell
// (sidebar + Outlet), the route table, and the manager-only RBAC guard.
import './App.css';
import './stylessheets/screens.css';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { ToastProvider } from './components/Toast';
import { NavGuardProvider } from './components/NavGuard';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Reports from './screens/Reports';
import UserManagement from './screens/UserManagement';
import Profile from './screens/Profile';
import ResetPassword from './screens/ResetPassword';
import Welcome from './screens/Welcome';
import SetupSignature from './screens/SetupSignature';
import SignatureScreen from './screens/SignatureScreen';
import Templates from './screens/Templates';
import ServiceLocater from './tools/ServiceLocater';
import PhotoReport from './tools/PhotoReport';
import SharedDriveManager from './tools/sharedDrive/SharedDriveManager';
import Swms from './tools/Swms';

// Authenticated chrome: the left sidebar plus the routed page rendered via <Outlet>.
// Passes auth context down to every screen.
const AppShell = () => {
  const { userName, role, signOut } = useAuth();
  return (
    <div className="App app-with-sidebar">
      <Sidebar />
      <main className="app-main">
        {/* Outlet context is consumed by screens via useOutletContext(). */}
        <Outlet context={{ userName, signOut, role }} />
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
const SwmsRoute = withBack(Swms);

// Only managers/admins may reach user management; everyone else is bounced to the dashboard.
const RequireManager = ({ children }) => {
  const { role } = useAuth();
  return ['admin', 'manager'].includes(String(role).toLowerCase())
    ? children
    : <Navigate to="/dashboard" replace />;
};

// Stricter guard: MANAGERS ONLY (the top role). Admins are bounced too. Used for the
// Shared Drive Manager, which is manager-exclusive.
const RequireStrictManager = ({ children }) => {
  const { role } = useAuth();
  return String(role).toLowerCase() === 'manager'
    ? children
    : <Navigate to="/dashboard" replace />;
};

// Gate a tool route by the user's tool allowlist (set by a manager/admin). Unrestricted
// users pass; a restricted user hitting a disallowed tool is bounced to the dashboard.
const RequireTool = ({ id, children }) => {
  const { canUseTool } = useAuth();
  return canUseTool(id) ? children : <Navigate to="/dashboard" replace />;
};

// Route table for an authenticated session. All routes nest under AppShell so
// they share the nav + Outlet; unknown paths and the index redirect to /dashboard.
const Routed = () => (
  <Routes>
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reports" element={<Reports />} />
      {/* Users screen is gated behind the manager/admin RBAC guard. */}
      <Route path="/users" element={<RequireManager><UserManagement /></RequireManager>} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/signature" element={<SignatureScreen />} />
      <Route path="/templates" element={<RequireManager><Templates /></RequireManager>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/setup-signature" element={<SetupSignature />} />
      <Route path="/tools/photo-report" element={<RequireTool id="photo-report"><PhotoReportRoute /></RequireTool>} />
      <Route path="/tools/service-location" element={<RequireTool id="service-location"><ServiceLocaterRoute /></RequireTool>} />
      <Route path="/tools/swms" element={<RequireTool id="swms"><SwmsRoute /></RequireTool>} />
      <Route path="/tools/shared-drive-manager" element={<RequireStrictManager><SharedDriveManager /></RequireStrictManager>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>
);

// Shown when Supabase env vars are missing so the app can't talk to a backend.
const ConfigureNotice = () => (
  <div className="boot-notice">
    <h2>Connect Supabase</h2>
    <p>Set <code>REACT_APP_SUPABASE_URL</code> and <code>REACT_APP_SUPABASE_PUBLISHABLE_KEY</code> in a
      <code>.env</code> file, then restart. See <code>supabase/SETUP.md</code>.</p>
  </div>
);

// Boot gate deciding what to render based on auth state, in priority order:
// no env config -> setup notice; restoring session -> spinner; signed out -> Login;
// authenticated -> the full routed app.
const Gate = () => {
  const { configured, loading, session, mustSetPassword } = useAuth();
  if (!configured) return <ConfigureNotice />;
  if (loading) return <div className="boot-notice"><p>Loading…</p></div>;
  if (!session) return <Login />;
  // Invite/recovery landing: force setting a password before anything else — rendered
  // WITHOUT the nav shell so it can't be skipped by navigating away or refreshing.
  if (mustSetPassword) return <ResetPassword />;
  return <NavGuardProvider><Routed /></NavGuardProvider>;
};

// Provider composition: router > auth > toast > gate. Auth must wrap Toast/Gate
// because both consume useAuth; the router wraps everything for navigation.
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
