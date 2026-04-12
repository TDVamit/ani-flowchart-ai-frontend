import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import Card from '../components/ui/Card';
import TopBar from '../components/layout/TopBar';
import { User } from 'lucide-react';

export default function Profile() {
  const { username } = useAuthStore();
  const { selectedProvider, selectedModel } = useAppStore();

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-auto">
      <TopBar title="Profile" />
      <div className="p-6 space-y-4 max-w-2xl">
        <Card title="Account">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <User size={20} className="text-indigo-600" />
            </div>
            <div>
              <div className="font-mono text-sm font-medium text-gray-900">{username || 'User'}</div>
              <div className="font-mono text-xs text-gray-500 mt-0.5">Logged in</div>
            </div>
          </div>
        </Card>

        <Card title="Active Model">
          <div className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-1">Provider</div>
          <div className="font-mono text-sm text-gray-900 mb-3">{selectedProvider}</div>
          <div className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-1">Model</div>
          <div className="font-mono text-sm text-gray-900">{selectedModel}</div>
        </Card>
      </div>
    </div>
  );
}
