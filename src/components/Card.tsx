import type { ReactNode } from 'react';

export function Card(props: { title?: string; desc?: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={`mb-5 rounded-2xl border border-line/70 bg-card p-5 shadow-card ${props.className ?? ''}`}
    >
      {props.title && (
        <header className="mb-4">
          <h2 className="text-sm font-semibold text-ink">{props.title}</h2>
          {props.desc && <p className="mt-1 text-xs leading-relaxed text-ink-3">{props.desc}</p>}
        </header>
      )}
      {props.children}
    </section>
  );
}

/** Stacked label + control, used in settings forms. */
export function Field(props: { label: string; desc?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{props.label}</span>
      {props.children}
      {props.desc && <span className="mt-1 block text-xs text-ink-3">{props.desc}</span>}
    </label>
  );
}

/** Horizontal row: label (+desc) on the left, control on the right. */
export function Row(props: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm text-ink">{props.label}</div>
        {props.desc && <div className="mt-0.5 text-xs leading-relaxed text-ink-3">{props.desc}</div>}
      </div>
      <div className="shrink-0">{props.children}</div>
    </div>
  );
}
