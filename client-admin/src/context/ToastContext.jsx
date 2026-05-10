import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconOk() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15" flexShrink="0">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconErr() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15" flexShrink="0">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function IconWarn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15" flexShrink="0">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * toast(message, type?, duration?)
   *   type: 'success' | 'error' | 'warning'   (default 'success')
   *   duration: ms                              (default 4000)
   */
  const toast = useCallback((msg, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.type === 'success' ? <IconOk /> : t.type === 'warning' ? <IconWarn /> : <IconErr />}
              <span>{t.msg}</span>
            </div>
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  return useContext(ToastCtx);
}
