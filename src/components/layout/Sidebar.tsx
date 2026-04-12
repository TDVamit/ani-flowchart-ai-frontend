import { NavLink, useNavigate } from 'react-router-dom';
import {
  Workflow,
  Settings,
  User,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: Workflow, label: 'Flowcharts' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  { to: '/dashboard/profile', icon: User, label: 'Profile' },
];

export default function Sidebar() {
  const { logout, username } = useAuthStore();
  const navigate = useNavigate();

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-[#e2e8f0] flex flex-col flex-shrink-0">
      {/* App name */}
      <div className="px-4 py-4 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-indigo-500 flex-shrink-0" />
          <span className="font-mono text-sm font-bold text-gray-900 tracking-widest uppercase">
            Flowchart AI
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 text-sm transition-colors mb-0.5 rounded',
                isActive
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
              )
            }
          >
            <Icon size={15} />
            <span className="font-mono text-xs">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-[#e2e8f0] px-2 py-3">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-xs text-gray-500 hover:text-red-500 transition-colors"
        >
          <LogOut size={11} />
          {username || 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
