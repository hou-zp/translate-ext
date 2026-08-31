import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Custom dropdown select. `variant`:
 * - 'ghost'  — borderless inline trigger (popup rows)
 * - 'field'  — bordered form control (options / toolbars)
 */
export function Select(props: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  variant?: 'ghost' | 'field';
}) {
  const { variant = 'ghost' } = props;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = props.options.find((o) => o.value === props.value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setDropUp(window.innerHeight - rect.bottom < 280 && rect.top > 280);
    setActive(Math.max(0, props.options.findIndex((o) => o.value === props.value)));
  }, [open, props.options, props.value]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const pick = (v: string) => {
    props.onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(props.options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = props.options[active];
      if (opt) pick(opt.value);
    }
  };

  const triggerCls =
    variant === 'field'
      ? 'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink hover:border-line-strong focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20'
      : 'rounded-md px-1 py-0.5 text-sm text-ink hover:text-brand';

  return (
    <div ref={rootRef} className={`relative ${props.className ?? ''}`}>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full cursor-pointer items-center justify-between gap-1 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${triggerCls}`}
      >
        <span className="truncate text-left">{selected?.label ?? props.value}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className={`absolute z-50 max-h-64 w-max min-w-full overflow-auto rounded-xl border border-line bg-card p-1 shadow-popover animate-pop-in ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } right-0`}
        >
          {props.options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === props.value}
              data-idx={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.value)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm whitespace-nowrap ${
                i === active ? 'bg-fill text-ink' : 'text-ink-2'
              } ${o.value === props.value ? 'font-medium text-brand' : ''}`}
            >
              {o.label}
              {o.value === props.value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
