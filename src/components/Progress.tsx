export function ProgressBar(props: { value: number; max?: number; className?: string }) {
  const max = props.max ?? 100;
  const pct = max > 0 ? Math.min(100, Math.round((props.value / max) * 100)) : 0;
  return (
    <div className={`flex items-center gap-2 ${props.className ?? ''}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-ink-3">{pct}%</span>
    </div>
  );
}
