import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileEdit,
  FileText,
  BookOpen,
  Settings,
  ChevronDown,
  LogOut,
  ExternalLink,
  Workflow,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import clsx from 'clsx';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily-input', icon: FileEdit, label: 'Daily Input' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/project-brief', icon: BookOpen, label: 'Project Brief' },
  { to: '/flowchart', icon: Workflow, label: 'Flowchart' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { projects, activeProjectId, setActiveProject } = useAppStore();
  const { logout, username } = useAuthStore();
  const activeProject = projects.find((p) => p._id === activeProjectId);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const navigate = useNavigate();

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-[#e2e8f0] flex flex-col flex-shrink-0">
      {/* App name */}
      <div className="px-4 py-4 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-indigo-500 flex-shrink-0" />
          <span className="font-mono text-sm font-bold text-gray-900 tracking-widest uppercase">
            Field Intel
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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
      <div className="border-t border-[#e2e8f0] px-2 py-2 flex items-center justify-between">
        <a
          href="/summary"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-xs text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ExternalLink size={11} />
          Summary
        </a>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-xs text-gray-500 hover:text-red-500 transition-colors"
        >
          <LogOut size={11} />
          {username || 'Sign out'}
        </button>
      </div>

      {/* Active project indicator */}
      <div className="border-t border-[#e2e8f0] p-3 bg-[#f8fafc]">
        {activeProject ? (
          <div>
            <div
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => setShowSwitcher(!showSwitcher)}
            >
              <div className="min-w-0">
                <div className="font-mono text-xs text-indigo-600 uppercase tracking-wider truncate">
                  {activeProject.brief.client_name}
                </div>
                <div className="text-xs text-gray-400 truncate mt-0.5">
                  Week {activeProject.current_week} · Day {activeProject.current_day}
                </div>
              </div>
              {projects.length > 1 && (
                <ChevronDown
                  size={14}
                  className={clsx(
                    'text-gray-400 flex-shrink-0 transition-transform',
                    showSwitcher && 'rotate-180'
                  )}
                />
              )}
            </div>
            {showSwitcher && projects.length > 1 && (
              <div className="mt-2 border border-[#e2e8f0] bg-white rounded">
                {projects.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => {
                      setActiveProject(p._id);
                      setShowSwitcher(false);
                      navigate('/');
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                      p._id === activeProjectId
                        ? 'text-indigo-600 bg-indigo-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    {p.brief.engagement_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-400 font-mono">No active project</div>
        )}
      </div>
    </aside>
  );
}
