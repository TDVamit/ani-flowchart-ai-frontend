import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Landing from './pages/Landing';
import FlowchartList from './pages/FlowchartList';
import FlowchartEditor from './pages/FlowchartEditor';
import FlowchartView from './pages/FlowchartView';
import { useAuthStore } from './store/useAuthStore';

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Routes>
          <Route path="/" element={<FlowchartList />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={
        isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Landing />
      } />
      <Route path="/login" element={
        isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="/view/:shareId/preview" element={<FlowchartView />} />
      <Route path="/view/:shareId/canvas" element={<FlowchartView />} />

      {/* Flowchart editor — full-screen, no sidebar */}
      <Route
        path="/flowchart/:id"
        element={
          <ProtectedRoute>
            <FlowchartEditor />
          </ProtectedRoute>
        }
      />

      {/* Protected routes (with sidebar) */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
