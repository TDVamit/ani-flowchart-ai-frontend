interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <div className="h-14 bg-white border-b border-[#e2e8f0] px-6 flex items-center justify-between flex-shrink-0 shadow-sm">
      <div className="flex items-baseline gap-3">
        <h1 className="font-mono text-sm font-bold text-[#1e293b] uppercase tracking-wider">
          {title}
        </h1>
        {subtitle && (
          <span className="text-xs text-gray-400 font-mono">{subtitle}</span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
