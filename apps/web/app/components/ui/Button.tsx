import { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'accent' | 'danger';

const variants: Record<Variant, string> = {
  default: 'border-gray-300 text-gray-800 hover:bg-gray-50',
  accent: 'border-emerald-500 text-emerald-700 hover:bg-emerald-50',
  danger: 'border-red-400 text-red-700 hover:bg-red-50',
};

export function Button({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
