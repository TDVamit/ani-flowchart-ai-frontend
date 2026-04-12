import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import DailyInput from './pages/DailyInput';
import Reports from './pages/Reports';
import ProjectBrief from './pages/ProjectBrief';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Summary from './pages/Summary';
import FlowchartList from './pages/FlowchartList';
import FlowchartEditor from './pages/FlowchartEditor';
import { useAppStore } from './store/useAppStore';
import { projectsApi } from './api/client';
import { useAuthStore } from './store/useAuthStore';

function AppLayout() {
  const { setProjects, setActiveProject, activeProjectId } = useAppStore();

  useEffect(() => {
    projectsApi.list().then((res) => {
      setProjects(res.data);
      if (!activeProjectId && res.data.length > 0) {
        setActiveProject(res.data[0]._id);
      }
    });
  }, []);

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/daily-input" element={<DailyInput />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/project-brief" element={<ProjectBrief />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/flowchart" element={<FlowchartList />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, logout } = useAuthStore();
  void logout; // used indirectly via ProtectedRoute

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        isAuthenticated() ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/summary" element={<Summary />} />

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
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
