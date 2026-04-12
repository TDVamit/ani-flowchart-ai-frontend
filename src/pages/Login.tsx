import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
      navigate('/dashboard');
    } catch {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 bg-indigo-500" />
            <span className="font-mono text-sm font-bold text-gray-900 tracking-widest uppercase">
              Flowchart AI
            </span>
          </Link>
          <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">
            Sign in to your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-6"
        >
          {error && (
            <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 font-mono rounded">
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
                className="w-full bg-white border border-gray-200 text-gray-900 text-sm px-3 py-2 rounded focus:border-indigo-400 focus:outline-none transition-colors font-mono"
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
                className="w-full bg-white border border-gray-200 text-gray-900 text-sm px-3 py-2 rounded focus:border-indigo-400 focus:outline-none transition-colors font-mono"
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
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
