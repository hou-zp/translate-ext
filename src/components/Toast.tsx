import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

const ToastContext = createContext<(text: string, kind?: ToastItem['kind']) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const KIND_ICON = {
  info: Info,
  error: AlertCircle,
  success: CheckCircle2,
} as const;

const KIND_CLS = {
  info: 'text-ink-2',
  error: 'text-danger',
  success: 'text-success',
} as const;

export function ToastProvider(props: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {props.children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2">
        {items.map((item) => {
          const IconCmp = KIND_ICON[item.kind];
          return (
            <div
              key={item.id}
              className="flex max-w-[90%] items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-xs text-ink shadow-popover animate-slide-up"
            >
              <IconCmp className={`h-3.5 w-3.5 shrink-0 ${KIND_CLS[item.kind]}`} />
              {item.text}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
