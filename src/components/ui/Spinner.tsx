import clsx from 'clsx';

export default function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'inline-block w-4 h-4 border-2 border-[#30363d] border-t-amber-500 rounded-full animate-spin',
        className
      )}
    />
  );
}
