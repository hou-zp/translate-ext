import type { ReactNode } from 'react';
import { Button } from '../../src/components/ui';
import { t } from '../../src/core/i18n';
import type { DocProgress } from './useDocTranslator';

export function ToolButton(props: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={props.primary ? 'primary' : 'secondary'}
      size="sm"
      className="!px-3 !py-1.5 !text-sm"
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  );
}

export function ProgressBar({ progress }: { progress: DocProgress }) {
  if (progress.total === 0) return null;
  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <div className="flex min-w-40 flex-1 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-ink-3">
        {progress.done}/{progress.total} · {pct}%
      </span>
      {progress.error && (
        <span className="max-w-60 truncate text-xs text-danger" title={progress.error}>
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
          <div
            key={p.key}
            className="rounded-xl border border-line/70 bg-card px-5 py-4 shadow-card"
          >
            <p className="mb-1.5 text-sm leading-6 text-ink-2">{p.text}</p>
            <p className="text-[15px] leading-7 text-ink">
              {tr ?? <span className="text-ink-3">{t('待翻译')}…</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
