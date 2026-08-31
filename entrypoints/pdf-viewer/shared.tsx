import type { ReactNode } from 'react';
import type { DocProgress } from './useDocTranslator';

export function ToolButton(props: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${
        props.primary
          ? 'bg-brand text-white hover:bg-brand-dark'
          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {props.children}
    </button>
  );
}

export function ProgressBar({ progress }: { progress: DocProgress }) {
  if (progress.total === 0) return null;
  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <div className="flex min-w-40 flex-1 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">
        {progress.done}/{progress.total}
      </span>
      {progress.error && (
        <span className="max-w-60 truncate text-xs text-red-500" title={progress.error}>
          {progress.error}
        </span>
      )}
    </div>
  );
}

/** Bilingual paragraph list used by EPUB / TXT views. */
export function BilingualList(props: {
  paragraphs: { key: string; text: string }[];
  results: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      {props.paragraphs.map((p) => {
        const tr = props.results[p.key];
        return (
          <div key={p.key} className="rounded-xl bg-white px-5 py-4 shadow-sm">
            <p className="mb-1.5 text-sm leading-6 text-gray-500">{p.text}</p>
            <p className="text-[15px] leading-7 text-gray-900">
              {tr ?? <span className="text-gray-300">待翻译…</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
