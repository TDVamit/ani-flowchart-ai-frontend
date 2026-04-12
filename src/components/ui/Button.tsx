import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-mono font-medium transition-colors border disabled:opacity-40 disabled:cursor-not-allowed',
        {
          'bg-amber-500 text-black border-amber-500 hover:bg-amber-600 hover:border-amber-600':
            variant === 'primary',
          'bg-transparent text-gray-300 border-[#30363d] hover:border-[#484f58] hover:text-white':
            variant === 'secondary',
          'bg-transparent text-red-400 border-red-800 hover:bg-red-900/20':
            variant === 'danger',
          'bg-transparent text-gray-400 border-transparent hover:text-white':
            variant === 'ghost',
        },
        {
          'text-xs px-2 py-1': size === 'sm',
          'text-sm px-3 py-1.5': size === 'md',
          'text-sm px-4 py-2': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
