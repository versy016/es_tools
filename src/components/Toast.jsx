// Toast.jsx — app-wide transient notification context. Provides a showToast(msg)
// function via context; any component calls it through the useToast() hook.
import React, { createContext, useCallback, useContext, useState } from 'react';
import '../stylessheets/screens.css';

// Context value is the showToast function itself (no-op until the provider mounts).
const ToastContext = createContext(() => {});

// Hook returning showToast(message) — the canonical way screens trigger a toast.
export const useToast = () => useContext(ToastContext);

// Bottom-centre confirmation toasts that auto-dismiss (~2.6s), per the design.
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message) => {
        setToast({ message, id: Date.now() });
        // Reset any pending dismiss so rapid calls don't clear the newest toast early.
        window.clearTimeout(showToast._t);
        showToast._t = window.setTimeout(() => setToast(null), 2600);
    }, []);

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            {toast && (
                <div className="toast" role="status" key={toast.id}>{toast.message}</div>
            )}
        </ToastContext.Provider>
    );
};
