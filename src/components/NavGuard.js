import React, { createContext, useContext, useRef } from 'react';

// Lightweight navigation guard so a tool can intercept ANY in-app navigation
// (navbar links, brand/profile button, sign-out) — not just its own back button —
// to offer "save as draft?" before leaving.
//
// A tool registers a blocker via setBlocker(fn). When something wants to navigate
// it calls runGuarded(proceed): if a blocker is registered and returns true it has
// taken over (it will call proceed() itself once the user decides); otherwise the
// navigation proceeds immediately.
const NavGuardContext = createContext({ runGuarded: (proceed) => proceed(), setBlocker: () => {} });

export const NavGuardProvider = ({ children }) => {
    const blockerRef = useRef(null);
    const setBlocker = (fn) => { blockerRef.current = fn; };
    const runGuarded = (proceed) => {
        const b = blockerRef.current;
        if (b && b(proceed)) return;   // blocker handled it (will proceed or cancel)
        proceed();
    };
    return (
        <NavGuardContext.Provider value={{ runGuarded, setBlocker }}>
            {children}
        </NavGuardContext.Provider>
    );
};

export const useNavGuard = () => useContext(NavGuardContext);
