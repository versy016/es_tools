import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

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
        signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
        signUp: (email, password, fullName) =>
            supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } }),
        signInWithMicrosoft: () =>
            supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo: window.location.origin } }),
        signOut: async () => { if (supabase) await supabase.auth.signOut(); },
        reloadProfile: () => loadProfile(session?.user?.id),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
