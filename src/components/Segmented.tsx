import type { ReactNode } from 'react';

export function Segmented(props: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: ReactNode; title?: string }[];
  className?: string;
}) {
  return (
    <div className={`flex rounded-md bg-surface p-0.5 ${props.className ?? ''}`}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => props.onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
            props.value === o.value
              ? 'bg-brand text-paper'
              : 'text-ink-3 hover:text-ink-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
