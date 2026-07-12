"use client";
/* App-wide toast — wrap the shell in <ToastProvider>, fire with useToast(). */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { I } from "./icons";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3800);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      {msg ? (
        <div className="toast" role="status" aria-live="polite">
          <span className="ok" aria-hidden="true"><I name="check" size={15} /></span>
          {msg}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
