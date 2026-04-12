import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(username, password);
      setAuth(res.data.access_token, username);
      navigate('/');
    } catch {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 bg-amber-500" />
            <span className="font-mono text-sm font-bold text-white tracking-widest uppercase">
              Field Intel
            </span>
          </div>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">
            Audit Intelligence Dashboard
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#161b22] border border-[#21262d] p-6"
        >
          <div className="font-mono text-xs text-[#f59e0b] uppercase tracking-widest mb-5">
            Authentication Required
          </div>

          {error && (
            <div className="mb-4 border border-red-800 bg-red-900/20 px-3 py-2 text-xs text-red-400 font-mono">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-gray-500 uppercase tracking-wider mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full bg-[#0f1117] border border-[#21262d] text-gray-200 text-sm px-3 py-2 focus:border-amber-500 transition-colors font-mono"
                required
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-gray-500 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-[#0f1117] border border-[#21262d] text-gray-200 text-sm px-3 py-2 focus:border-amber-500 transition-colors font-mono"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center"
              disabled={loading}
            >
              {loading ? <Spinner className="mr-2" /> : null}
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </div>

          <p className="mt-4 text-xs text-gray-600 font-mono text-center">
            Credentials set in <code className="text-amber-600">backend/.env</code>
          </p>
        </form>
      </div>
    </div>
  );
}
