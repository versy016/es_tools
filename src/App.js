import './App.css';
import { Button, Heading } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { fetchUserAttributes } from 'aws-amplify/auth';
import React, { useEffect, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { ThemeProvider } from '@aws-amplify/ui-react';
import amplifyconfig from './amplifyconfiguration.json';
import studioTheme from './ui-components/studioTheme';

Amplify.configure(amplifyconfig);

const styles = {
  container: {
    padding: '20px',
  },
};

const App = ({ signOut }) => {
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const attributes = await fetchUserAttributes();
        setUserName(attributes.name);
      } catch (error) {
        console.error(error);
        setUserName('User');
      }
    };
    fetchUserName();
  }, []);

  return (
    <div style={styles.container}>
      <Heading level={1}>Hello {userName || 'Loading...'}</Heading>
      <Button onClick={signOut}>Sign out</Button>
      <h2>ES Tools</h2>
    </div>
  );
};

const AppWithAuth = () => (
  <div style={styles.container}>
    <Authenticator >
      {({ signOut }) => (
        <ThemeProvider theme={studioTheme}>
          <App signOut={signOut} />
        </ThemeProvider>
      )}
    </Authenticator>
  </div>
);

export default AppWithAuth;
