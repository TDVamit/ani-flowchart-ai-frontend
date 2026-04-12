import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export default function Card({ title, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx('bg-white border border-[#e2e8f0] rounded-lg shadow-sm p-4', className)}
      {...props}
    >
      {title && (
        <div className="font-mono text-xs text-indigo-600 font-bold uppercase tracking-widest mb-3">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
