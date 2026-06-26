import { HTMLAttributes } from 'react';

type Tone = 'neutral' | 'vegetable' | 'fruit' | 'flower' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  vegetable: 'bg-green-100 text-green-800',
  fruit: 'bg-orange-100 text-orange-800',
  flower: 'bg-pink-100 text-pink-800',
  danger: 'bg-red-100 text-red-800',
};

export function Badge({
  tone = 'neutral',
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
