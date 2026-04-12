import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'amber' | 'green' | 'red' | 'gray' | 'blue' | 'indigo';
  className?: string;
}

export default function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-block font-mono text-xs px-2 py-0.5 border',
        {
          'bg-amber-500/10 text-amber-400 border-amber-500/30': variant === 'amber',
          'bg-green-500/10 text-green-400 border-green-500/30': variant === 'green',
          'bg-red-500/10 text-red-400 border-red-500/30': variant === 'red',
          'bg-gray-500/10 text-gray-400 border-gray-500/30': variant === 'gray',
          'bg-blue-500/10 text-blue-400 border-blue-500/30': variant === 'blue',
          'bg-indigo-50 text-indigo-700 border-indigo-200 rounded': variant === 'indigo',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
