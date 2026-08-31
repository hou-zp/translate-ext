import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 disabled:hover:bg-brand',
  secondary: 'border border-line bg-card text-ink-2 hover:bg-fill hover:text-ink',
  ghost: 'text-ink-2 hover:bg-fill hover:text-ink',
  danger: 'border border-danger/30 text-danger hover:bg-danger/10',
};

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-lg gap-1',
  md: 'px-3.5 py-2 text-sm rounded-lg gap-1.5',
  lg: 'px-4 py-3 text-[15px] rounded-xl gap-2',
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
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ''}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
