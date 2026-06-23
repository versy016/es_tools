import './App.css';
import './stylessheets/screens.css';
import { fetchUserAttributes } from 'aws-amplify/auth';
import React, { useEffect, useState } from 'react';
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import amplifyconfig from './amplifyconfiguration.json';
import studioTheme from './ui-components/studioTheme';
import NavBar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import { authTheme, AuthHeader } from './components/authConfig';
import Dashboard from './screens/Dashboard';
import Reports from './screens/Reports';
import UserManagement from './screens/UserManagement';
import Profile from './screens/Profile';
import ServiceLocater from './tools/ServiceLocater';
import PhotoReport from './tools/PhotoReport';

Amplify.configure(amplifyconfig);

const AppShell = ({ userName, signOut }) => {
  const [search, setSearch] = useState('');
  return (
    <div className="App">
      <NavBar userName={userName} search={search} onSearch={setSearch} />
      <main className="app-main">
        <Outlet context={{ search, userName, signOut }} />
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

const App = ({ signOut }) => {
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const attributes = await fetchUserAttributes();
        setUserName(attributes.name);
      } catch (error) {
        console.error(error);
        setUserName('User');
      }
    })();
  }, []);

  return (
    <Routes>
      <Route element={<AppShell userName={userName} signOut={signOut} />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/tools/photo-report" element={<PhotoReportRoute />} />
        <Route path="/tools/service-location" element={<ServiceLocaterRoute />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};

const AppWithAuth = () => (
  <BrowserRouter>
    <ThemeProvider theme={authTheme}>
      <Authenticator components={{ Header: AuthHeader }}>
        {({ signOut }) => (
          <ThemeProvider theme={studioTheme}>
            <ToastProvider>
              <App signOut={signOut} />
            </ToastProvider>
          </ThemeProvider>
        )}
      </Authenticator>
    </ThemeProvider>
  </BrowserRouter>
);

export default AppWithAuth;
