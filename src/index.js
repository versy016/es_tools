import React from 'react';
import ReactDOM from 'react-dom/client';

import { Amplify } from 'aws-amplify';
import awsconfig from './aws-exports';
import App from './App';
import './index.css';

Amplify.configure(awsconfig);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
