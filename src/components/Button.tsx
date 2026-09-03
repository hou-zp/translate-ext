import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-paper shadow-sm hover:bg-brand-hi active:bg-brand-dark disabled:hover:bg-brand',
  secondary:
    'border border-line-strong bg-fill/60 text-ink-2 hover:border-ink-3/50 hover:bg-fill-2 hover:text-ink',
  ghost: 'text-ink-2 hover:bg-fill/60 hover:text-ink',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1 font-mono tracking-wide',
  md: 'px-3.5 py-2 text-sm rounded-md gap-1.5',
  lg: 'px-4 py-3 text-[15px] rounded-lg gap-2 font-medium tracking-wide',
};

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: ReactNode;
  },
) {
  const { variant = 'secondary', size = 'md', loading, icon, className, children, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ''}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
