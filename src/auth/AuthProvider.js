import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Returned by auth actions when Supabase isn't configured, so callers (e.g. the Login
// screen) show a friendly message instead of crashing on a null-deref.
const NOT_CONFIGURED = {
    error: { message: 'Backend not configured — set REACT_APP_SUPABASE_URL and the publishable key.' },
};

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async (userId) => {
        if (!supabase || !userId) { setProfile(null); return; }
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
            setProfile(data || null);
        } catch { setProfile(null); }
    }, []);

    useEffect(() => {
        if (!isSupabaseConfigured()) { setLoading(false); return; }
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            loadProfile(data.session?.user?.id).finally(() => setLoading(false));
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
            setSession(s);
            loadProfile(s?.user?.id);
        });
        return () => sub.subscription.unsubscribe();
    }, [loadProfile]);

    const value = {
        configured: isSupabaseConfigured(),
        session,
        user: session?.user || null,
        profile,
        loading,
        userName: profile?.full_name || session?.user?.email || 'User',
        role: profile?.role || 'surveyor',
        signIn: (email, password) =>
            supabase
                ? supabase.auth.signInWithPassword({ email, password })
                : Promise.resolve(NOT_CONFIGURED),
        signUp: (email, password, fullName) =>
            supabase
                ? supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
                : Promise.resolve(NOT_CONFIGURED),
        signInWithMicrosoft: () =>
            supabase
                ? supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo: window.location.origin } })
                : Promise.resolve(NOT_CONFIGURED),
        signOut: async () => { if (supabase) await supabase.auth.signOut(); },
        reloadProfile: () => loadProfile(session?.user?.id),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
