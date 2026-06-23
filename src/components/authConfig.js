import React from 'react';
import { createTheme } from '@aws-amplify/ui-react';

// Brand theme for the Amplify Authenticator (login screen).
export const authTheme = createTheme({
    name: 'es-tools-auth',
    tokens: {
        fonts: {
            default: {
                variable: { value: "'Plus Jakarta Sans', sans-serif" },
                static: { value: "'Plus Jakarta Sans', sans-serif" },
            },
        },
        components: {
            authenticator: {
                router: {
                    borderColor: { value: '#ece7dd' },
                    boxShadow: { value: '0 10px 24px rgba(27,34,48,.09)' },
                    backgroundColor: { value: '#ffffff' },
                },
            },
            button: {
                primary: {
                    backgroundColor: { value: '#f5a623' },
                    color: { value: '#1b2230' },
                    _hover: { backgroundColor: { value: '#e89712' }, color: { value: '#1b2230' } },
                    _active: { backgroundColor: { value: '#e89712' }, color: { value: '#1b2230' } },
                    _focus: { backgroundColor: { value: '#e89712' }, color: { value: '#1b2230' } },
                },
                link: { color: { value: '#c8870c' } },
            },
            fieldcontrol: {
                _focus: { borderColor: { value: '#f5a623' }, boxShadow: { value: '0 0 0 2px rgba(245,166,35,.25)' } },
            },
            tabs: {
                item: {
                    color: { value: '#6b7280' },
                    _active: { color: { value: '#1b2230' }, borderColor: { value: '#f5a623' } },
                    _hover: { color: { value: '#1b2230' } },
                },
            },
        },
    },
});

// Branded header shown above the Authenticator form.
export const AuthHeader = () => (
    <div className="auth-header">
        <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
            <path d="M20 22 L11 36 M20 22 L29 36 M20 22 L20 33" stroke="#1B2230" strokeWidth="2.6" strokeLinecap="round" />
            <rect x="17" y="15" width="6" height="9" rx="1.5" fill="#1B2230" />
            <rect x="8" y="8" width="23" height="8" rx="4" fill="#F5A623" />
            <circle cx="20" cy="12" r="2.4" fill="#1B2230" />
        </svg>
        <div className="auth-wordmark">ES Tools</div>
        <div className="auth-tagline">Every field tool, one login.</div>
    </div>
);
