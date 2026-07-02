import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Supabase auth context for the whole app. Holds the live session, the signed-in
// user's profile row, and a loading flag, and exposes the auth actions (sign in/up,
// Google OAuth, sign out, profile reload). Wrap the tree in <AuthProvider> and read
// state via useAuth(). When Supabase isn't configured the actions no-op gracefully
// (see NOT_CONFIGURED) so the app still renders.

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Returned by auth actions when Supabase isn't configured, so callers (e.g. the Login
// screen) show a friendly message instead of crashing on a null-deref.
const NOT_CONFIGURED = {
    error: { message: 'Backend not configured — set REACT_APP_SUPABASE_URL and the publishable key.' },
};

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);   // current Supabase session (null = signed out)
    const [profile, setProfile] = useState(null);   // matching row from public.profiles
    const [loading, setLoading] = useState(true);    // true until the initial session check resolves
    // Whether the user must set a password before using the app — they arrived via an
    // invite or password-reset link. Captured from the URL hash on first render (before
    // supabase-js consumes it) and persisted per browser tab, so refreshing or clicking
    // the navbar can't skip it. Cleared once the password is set or on sign-out.
    const [pwSetupReason, setPwSetupReason] = useState(() => {
        try {
            const type = new URLSearchParams((window.location.hash || '').replace(/^#/, '')).get('type');
            if (type === 'invite' || type === 'recovery') { sessionStorage.setItem('es_tools_pw_setup', type); return type; }
            return sessionStorage.getItem('es_tools_pw_setup') || null;
        } catch { return null; }
    });
    const completePasswordSetup = useCallback(() => {
        try { sessionStorage.removeItem('es_tools_pw_setup'); } catch { /* ignore */ }
        setPwSetupReason(null);
    }, []);

    // Fetch the caller's profile row (full_name/role/etc) by auth user id. Null-guards
    // missing supabase/userId and swallows errors (e.g. RLS denial) into profile=null so
    // consumers always get a defined value.
    const loadProfile = useCallback(async (userId) => {
        if (!supabase || !userId) { setProfile(null); return; }
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
            setProfile(data || null);
        } catch { setProfile(null); }
    }, []);

    useEffect(() => {
        // No backend configured: nothing to restore, just stop the loading spinner.
        if (!isSupabaseConfigured()) { setLoading(false); return; }
        // Restore any persisted session on mount, then load its profile.
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            loadProfile(data.session?.user?.id).finally(() => setLoading(false));
        });
        // Keep session/profile in sync on every auth change (sign in/out, token refresh,
        // OAuth redirect). Unsubscribe on unmount to avoid leaks.
        const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
            setSession(s);
            loadProfile(s?.user?.id);
            // A recovery link fires this event; force the set-password screen.
            if (event === 'PASSWORD_RECOVERY') {
                try { sessionStorage.setItem('es_tools_pw_setup', 'recovery'); } catch { /* ignore */ }
                setPwSetupReason('recovery');
            }
        });
        return () => sub.subscription.unsubscribe();
    }, [loadProfile]);

    // Context value: derived view of the auth state plus the action methods. Each action
    // returns the Supabase result ({ data, error }) so callers can show errors; when
    // Supabase is absent they resolve to NOT_CONFIGURED instead of throwing. `userName`
    // and `role` fall back sensibly when the profile hasn't loaded yet.
    const value = {
        configured: isSupabaseConfigured(),
        session,
        user: session?.user || null,
        profile,
        loading,
        userName: profile?.full_name || session?.user?.email || 'User',
        role: profile?.role || 'surveyor',     // default least-privilege role
        // Allowed tool ids, or null = unrestricted (all tools). Set by a manager/admin.
        allowedTools: Array.isArray(profile?.tools) ? profile.tools : null,
        canUseTool: (id) => !Array.isArray(profile?.tools) || profile.tools.includes(id),
        // Must the user set a password right now (invite/recovery landing)? Drives the
        // blocking set-password gate; `pwSetupReason` is 'invite' | 'recovery' | null.
        mustSetPassword: Boolean(pwSetupReason),
        pwSetupReason,
        completePasswordSetup,
        // Email/password sign-in.
        signIn: (email, password) =>
            supabase
                ? supabase.auth.signInWithPassword({ email, password })
                : Promise.resolve(NOT_CONFIGURED),
        // Sign-up; full_name is stashed in user metadata and copied to the profile row
        // by the handle_new_user() trigger (see 0001_init.sql).
        signUp: (email, password, fullName) =>
            supabase
                ? supabase.auth.signUp({
                    email,
                    password,
                    // full_name -> user metadata (copied to the profile row by handle_new_user);
                    // confirming the email lands the user on the friendly /welcome screen.
                    options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/welcome` },
                })
                : Promise.resolve(NOT_CONFIGURED),
        // SSO via Google (Workspace); redirects back to this origin after auth.
        signInWithGoogle: () =>
            supabase
                ? supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
                : Promise.resolve(NOT_CONFIGURED),
        // Send a password-reset email (the branded email is sent by the send-email-hook
        // function). The link returns the user to /reset-password to choose a new one.
        resetPassword: (email) =>
            supabase
                ? supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
                : Promise.resolve(NOT_CONFIGURED),
        // Set a new password for the current (recovery/invite) session.
        updatePassword: (password) =>
            supabase ? supabase.auth.updateUser({ password }) : Promise.resolve(NOT_CONFIGURED),
        // Sign out; onAuthStateChange clears session/profile. Also clears the pw-setup gate.
        signOut: async () => {
            try { sessionStorage.removeItem('es_tools_pw_setup'); } catch { /* ignore */ }
            setPwSetupReason(null);
            if (supabase) await supabase.auth.signOut();
        },
        // Re-fetch the current user's profile (e.g. after editing it).
        reloadProfile: () => loadProfile(session?.user?.id),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
