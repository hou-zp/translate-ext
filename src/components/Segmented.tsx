import type { ReactNode } from 'react';

export function Segmented(props: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: ReactNode; title?: string }[];
  className?: string;
}) {
  return (
    <div className={`flex rounded-lg bg-fill p-0.5 ${props.className ?? ''}`}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => props.onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
            props.value === o.value
              ? 'bg-card text-ink shadow-sm'
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
