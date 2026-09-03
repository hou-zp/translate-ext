import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const inputCls =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3/70 outline-none transition-colors focus:border-brand/60 disabled:opacity-50';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={`${inputCls} ${className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={`${inputCls} resize-none ${className ?? ''}`} />;
}
