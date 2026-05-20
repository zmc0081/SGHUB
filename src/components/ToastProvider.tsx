import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import { Icon } from "./Icon";

export type ToastVariant = "success" | "danger" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
}

export interface ToastApi {
  show: (opts: ToastOptions) => string;
  success: (title: string, description?: string) => string;
  danger: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

const MAX_STACK = 5;

export const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    bg: string;
    barClass: string;
    icon: typeof CheckCircle2;
    iconClass: string;
    aria: "alert" | "status";
    ariaLive: "polite" | "assertive";
  }
> = {
  success: {
    bg: "bg-success-bg",
    barClass: "bg-success-fg",
    icon: CheckCircle2,
    iconClass: "text-success-fg",
    aria: "status",
    ariaLive: "polite",
  },
  danger: {
    bg: "bg-danger-bg",
    barClass: "bg-danger-fg",
    icon: XCircle,
    iconClass: "text-danger-fg",
    aria: "alert",
    ariaLive: "assertive",
  },
  warning: {
    bg: "bg-warning-bg",
    barClass: "bg-warning-fg-strong",
    icon: AlertTriangle,
    iconClass: "text-warning-fg-strong",
    aria: "alert",
    ariaLive: "polite",
  },
  info: {
    bg: "bg-info-bg",
    barClass: "bg-info-fg",
    icon: Info,
    iconClass: "text-info-fg",
    aria: "status",
    ariaLive: "polite",
  },
};

let toastApiRef: ToastApi | null = null;
const queued: ToastOptions[] = [];

/** Imperative toast API for non-React callers. */
export function toast(opts: ToastOptions): string {
  if (toastApiRef) return toastApiRef.show(opts);
  queued.push(opts);
  return "";
}

function newId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<string, { remaining: number; startedAt: number; timeoutId: ReturnType<typeof setTimeout> | null }>>(
    new Map(),
  );

  const dismiss = useCallback((id: string) => {
    setEntries((curr) => curr.filter((e) => e.id !== id));
    const t = timersRef.current.get(id);
    if (t?.timeoutId) clearTimeout(t.timeoutId);
    timersRef.current.delete(id);
  }, []);

  const startTimer = useCallback(
    (id: string, ms: number) => {
      if (ms <= 0) return;
      const timeoutId = setTimeout(() => dismiss(id), ms);
      timersRef.current.set(id, {
        remaining: ms,
        startedAt: Date.now(),
        timeoutId,
      });
    },
    [dismiss],
  );

  const pauseTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (!t || !t.timeoutId) return;
    clearTimeout(t.timeoutId);
    const elapsed = Date.now() - t.startedAt;
    timersRef.current.set(id, {
      remaining: Math.max(0, t.remaining - elapsed),
      startedAt: 0,
      timeoutId: null,
    });
  }, []);

  const resumeTimer = useCallback(
    (id: string) => {
      const t = timersRef.current.get(id);
      if (!t || t.timeoutId) return;
      if (t.remaining <= 0) {
        dismiss(id);
        return;
      }
      const timeoutId = setTimeout(() => dismiss(id), t.remaining);
      timersRef.current.set(id, {
        ...t,
        startedAt: Date.now(),
        timeoutId,
      });
    },
    [dismiss],
  );

  const show = useCallback(
    (opts: ToastOptions): string => {
      const id = newId();
      const defaultDuration =
        opts.variant === "danger" || opts.variant === "warning" ? 6000 : 4000;
      const duration = opts.duration ?? defaultDuration;
      setEntries((curr) => {
        const next = [...curr, { ...opts, id }];
        // Enforce stack cap by dropping oldest.
        while (next.length > MAX_STACK) {
          const dropped = next.shift();
          if (dropped) {
            const t = timersRef.current.get(dropped.id);
            if (t?.timeoutId) clearTimeout(t.timeoutId);
            timersRef.current.delete(dropped.id);
          }
        }
        return next;
      });
      startTimer(id, duration);
      return id;
    },
    [startTimer],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ variant: "success", title, description }),
      danger: (title, description) => show({ variant: "danger", title, description }),
      warning: (title, description) => show({ variant: "warning", title, description }),
      info: (title, description) => show({ variant: "info", title, description }),
    }),
    [show, dismiss],
  );

  useEffect(() => {
    toastApiRef = api;
    if (queued.length > 0) {
      queued.splice(0).forEach((opts) => api.show(opts));
    }
    return () => {
      toastApiRef = null;
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed top-12 right-4 z-toast flex flex-col gap-2 pointer-events-none"
      >
        {entries.map((entry) => {
          const style = VARIANT_STYLES[entry.variant];
          return (
            <div
              key={entry.id}
              role={style.aria}
              aria-live={style.ariaLive}
              onMouseEnter={() => pauseTimer(entry.id)}
              onMouseLeave={() => resumeTimer(entry.id)}
              className={`pointer-events-auto w-80 max-w-[calc(100vw-32px)] rounded-card-sm shadow-nav border-l-4 ${style.barClass} ${style.bg}`}
            >
              <div className="p-4 flex items-start gap-3">
                <Icon
                  icon={style.icon}
                  size="base"
                  className={`flex-shrink-0 mt-0.5 ${style.iconClass}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-caption font-semibold text-fg-1">
                    {entry.title}
                  </p>
                  {entry.description && (
                    <p className="text-meta text-fg-2 mt-1 break-words">
                      {entry.description}
                    </p>
                  )}
                  {entry.action && (
                    <button
                      type="button"
                      onClick={() => {
                        entry.action!.onClick();
                        dismiss(entry.id);
                      }}
                      className="mt-2 text-caption font-medium text-indigo hover:text-indigo-hover transition-colors duration-fast ease-khx"
                    >
                      {entry.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(entry.id)}
                  className="flex-shrink-0 text-fg-3 hover:text-fg-1 transition-colors duration-fast ease-khx"
                >
                  <Icon icon={X} size="xs" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
