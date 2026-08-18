'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Toasts.
 *
 * The live region is rendered once and always present, empty or not. A
 * region injected at the same moment as its first message is frequently
 * missed by screen readers, which is how "saved" and "that failed" end up
 * announced only to sighted users.
 */

type Tone = 'success' | 'danger' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
}

interface ToastApi {
  show: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = React.useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = nextId++;
      setToasts((cur) => [...cur.slice(-2), { ...t, id }]);
      // Errors stay longer: they usually need to be read and acted on,
      // and a failure that vanishes in four seconds reads as nothing
      // having happened at all.
      window.setTimeout(() => dismiss(id), t.tone === 'danger' ? 8000 : 4500);
    },
    [dismiss],
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      show,
      success: (title, body) => show({ tone: 'success', title, body }),
      error: (title, body) => show({ tone: 'danger', title, body }),
      info: (title, body) => show({ tone: 'info', title, body }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-lg border p-3.5 shadow-lg',
              // color-mix rather than Tailwind's `/40`: the palette is CSS
              // custom properties, which Tailwind cannot decompose into
              // channels for an opacity modifier.
              t.tone === 'success' && 'bg-surface-raised border-[color-mix(in_srgb,var(--success)_40%,var(--border))]',
              t.tone === 'danger' && 'bg-surface-raised border-[color-mix(in_srgb,var(--danger)_40%,var(--border))]',
              t.tone === 'info' && 'border-line bg-surface-raised',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-1 size-2 shrink-0 rounded-full',
                t.tone === 'success' && 'bg-success',
                t.tone === 'danger' && 'bg-danger',
                t.tone === 'info' && 'bg-info',
              )}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body ? <p className="text-xs text-secondary">{t.body}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-surface-sunken hover:text-primary"
            >
              <svg viewBox="0 0 20 20" className="size-3.5" fill="none" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
