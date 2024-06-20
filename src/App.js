import './App.css';
import '@aws-amplify/ui-react/styles.css';
import { fetchUserAttributes } from 'aws-amplify/auth';
import React, { useEffect, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { ThemeProvider } from '@aws-amplify/ui-react';
import amplifyconfig from './amplifyconfiguration.json';
import studioTheme from './ui-components/studioTheme';
import NavBar from './components/Navbar';
import ToolCard  from './components/ToolCard';
import ServiceLocater from './tools/ServiceLocater';
import ServiceLocaterpdf from './tools/ServiceLocaterpdf';

Amplify.configure(amplifyconfig);

const styles = {
 
};

const App = ({ signOut }) => {
  const [userName, setUserName] = useState(null);
  const [currentTool, setCurrentTool] = useState(null);

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
  const goBack = () => {
    setCurrentTool(null);
  };
  const renderTool = () => {
    switch (currentTool) {
      case 'service-locater':
        return <ServiceLocater goBack={goBack} />;
      case 'service-locater-pdf':
        return <ServiceLocaterpdf goBack={goBack} />;
      default:
        return (
          <>
            <div className="tool-cards-container">
              <ToolCard 
                image="/images/Service_Location_Report.png" 
                title="Service Location Field Report" 
                description="This tool helps you with creating Service Location Field Report" 
                onClick={() => setCurrentTool('service-locater')}
              />
              <ToolCard 
                image="/images/Service_Location_Report.png" 
                title="Service Location Field Report PDF" 
                description="This tool helps you with creating Service Location Field Report" 
                onClick={() => setCurrentTool('service-locater-pdf')}
              />
            </div>
    
          </>
          
        );
    }
  };
  return (
    <div className="App">
      <NavBar userName={userName} signOut={signOut} />
           {renderTool()}

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
