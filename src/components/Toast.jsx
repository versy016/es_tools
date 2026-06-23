import React, { createContext, useCallback, useContext, useState } from 'react';
import '../stylessheets/screens.css';

const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);

// Bottom-centre confirmation toasts that auto-dismiss (~2.6s), per the design.
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message) => {
        setToast({ message, id: Date.now() });
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
