import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const DEFAULT_DURATION = 3600;

const normalizeMessage = (message) => {
  if (message === null || message === undefined) {
    return "";
  }
  if (typeof message === "string") {
    return message.trim();
  }
  return String(message).trim();
};

export function ToastProvider({ children, duration = DEFAULT_DURATION }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const nextIdRef = useRef(1);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (message, options = {}) => {
      const text = normalizeMessage(message);
      if (!text) {
        return null;
      }
      const toast = {
        id: nextIdRef.current++,
        type: options.type || "info",
        message: text,
      };
      setToasts((prev) => [...prev, toast]);

      const ttl = Number.isFinite(options.duration) ? options.duration : duration;
      if (ttl > 0) {
        const timer = window.setTimeout(() => removeToast(toast.id), ttl);
        timersRef.current.set(toast.id, timer);
      }

      return toast.id;
    },
    [duration, removeToast]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      pushToast,
      success: (message, options = {}) => pushToast(message, { ...options, type: "success" }),
      error: (message, options = {}) => pushToast(message, { ...options, type: "error" }),
      info: (message, options = {}) => pushToast(message, { ...options, type: "info" }),
      dismiss: removeToast,
    }),
    [pushToast, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card toast-${toast.type}`} role="status">
            <div className="toast-message">{toast.message}</div>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => removeToast(toast.id)}
              aria-label="Закрыть уведомление"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
