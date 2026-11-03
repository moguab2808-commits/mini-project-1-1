// 화면 위쪽에 3초간 뜨는 토스트 안내(PRD 공통 안내).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export const TOAST_MS = 3000;

type Notify = (text: string) => void;

const ToastContext = createContext<Notify>(() => undefined);

/** 토스트를 띄우는 함수. 새 토스트가 오면 이전 토스트를 대체한다. */
export function useToast(): Notify {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const notify = useCallback<Notify>((text) => {
    window.clearTimeout(timer.current);
    seq.current += 1;
    setToast({ id: seq.current, text });
    timer.current = window.setTimeout(() => {
      setToast(null);
    }, TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext value={notify}>
      {children}
      <div className="toast-layer" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast" role="status">
            {toast.text}
          </div>
        )}
      </div>
    </ToastContext>
  );
}
