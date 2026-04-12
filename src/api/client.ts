import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 min for LLM calls
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('audit-auth');
    if (stored) {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    }
  } catch {
    // ignore
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Redirect to login on 401
    if (err.response?.status === 401) {
      localStorage.removeItem('audit-auth');
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/summary')) {
        window.location.href = '/login';
      }
    }
    const message = err.response?.data?.detail || err.message || 'An error occurred';
    toast.error(message);
    return Promise.reject(err);
  }
);

// Projects
export const projectsApi = {
  list: () => api.get('/api/projects'),
  get: (id: string) => api.get(`/api/projects/${id}`),
  create: (data: unknown) => api.post('/api/projects', data),
  updateBrief: (id: string, brief: unknown) => api.put(`/api/projects/${id}/brief`, brief),
  getContext: (id: string) => api.get(`/api/projects/${id}/context`),
  resetContext: (id: string) => api.delete(`/api/projects/${id}/context`),
};

// Entries
export const entriesApi = {
  create: (data: unknown) => api.post('/api/entries', data),
  get: (id: string) => api.get(`/api/entries/${id}`),
  update: (id: string, data: unknown) => api.put(`/api/entries/${id}`, data),
  listByProject: (projectId: string) => api.get(`/api/entries/project/${projectId}`),
  addRecording: (entryId: string, recording: unknown) => api.post(`/api/entries/${entryId}/add-recording`, recording),
  updateTranscript: (entryId: string, data: unknown) => api.put(`/api/entries/${entryId}/update-transcript`, data),
  addDocument: (entryId: string, doc: unknown) => api.post(`/api/entries/${entryId}/add-document`, doc),
};

// Files
export const filesApi = {
  upload: (file: File, projectId: string, annotation?: string, fieldKey?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('project_id', projectId);
    if (annotation) form.append('annotation', annotation);
    if (fieldKey)   form.append('field_key', fieldKey);
    return api.post('/api/files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getBriefFiles: (projectId: string) =>
    api.get(`/api/files/brief/${projectId}`),
  getDownloadUrl: (fileId: string) =>
    api.get(`/api/files/download/${fileId}`),
  delete: (fileId: string) =>
    api.delete(`/api/files/${fileId}`),
};

// Transcription
export const transcriptionApi = {
  transcribeFromR2: (fileId: string, language?: string, contextPrompt?: string) =>
    api.post(`/api/transcription/audio/${fileId}`, { language, context_prompt: contextPrompt }),
  saveManual: (transcript: string) =>
    api.post('/api/transcription/manual', { transcript }),
};

// Analysis
export const analysisApi = {
  trigger: (data: unknown) => api.post('/api/analysis/trigger', data),
  getStatus: (jobId: string) => api.get(`/api/analysis/status/${jobId}`),
  getReport: (reportId: string) => api.get(`/api/analysis/report/${reportId}`),
  listReports: (projectId: string) => api.get(`/api/analysis/reports/${projectId}`),
};

// Settings
export const settingsApi = {
  getModels: () => api.get('/api/settings/models'),
};

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),
};

// Flowcharts
export const flowchartsApi = {
  list:   () => api.get('/api/flowcharts'),
  create: (name: string) => api.post('/api/flowcharts', { name }),
  get:    (id: string) => api.get(`/api/flowcharts/${id}`),
  update: (id: string, data: { name?: string; nodes?: unknown[]; edges?: unknown[] }) =>
    api.put(`/api/flowcharts/${id}`, data),
  delete: (id: string) => api.delete(`/api/flowcharts/${id}`),
};

// Flowchart Assets (custom arrowhead images)
export const flowchartAssetsApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ file_id: string; url: string; filename: string }>('/api/flowchart-assets/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: () => api.get<Array<{ file_id: string; url: string; filename: string }>>('/api/flowchart-assets/list'),
  delete: (fileId: string) => api.delete(`/api/flowchart-assets/${fileId}`),
}

// AI Flowchart generation
export const flowchartAiApi = {
  generate: (prompt: string, aspect_ratio = '16:9') =>
    api.post<AIChartSpec>('/api/flowchart-ai/generate', { prompt, aspect_ratio }, { timeout: 600000 }),
}

export interface AIElementStyle {
  backgroundColor: string; borderColor: string; borderWidth: number; borderRadius: number
  textColor: string; fontSize: number; fontWeight: 'normal' | 'bold'; fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right'; fontFamily: string; opacity: number
  shadowEnabled: boolean; shadowColor: string; shadowBlur: number; shadowX: number; shadowY: number
}
export interface AIElementAnimation {
  inType: string; duration: number; delay: number; stay: number
}
export interface AIEdgeAnimation {
  inType: string; inDuration: number; delay: number; stay: number
  type: string; loop: string; loopCount: number; duration: number
  flowContent: { type: string; text: string; size: number; color: string; loop: boolean }
}
export interface AIEdgeStyle {
  color: string; strokeWidth: number; lineType: string; arrowType: string; pathType: string; markerSize: number
}
export interface AIElement {
  id: string; x: number; y: number; width: number; height: number
  elementType: 'shape' | 'text' | 'premade'
  shape?: string; premadeType?: string
  lottieUrl?: string; lottiePrimary?: string; lottieSecondary?: string; lottieDelay?: number
  text: string; step: number
  style: AIElementStyle; animation: AIElementAnimation
}
export interface AIEdge {
  id: string; source: string; target: string; label?: string; step?: number
  style: AIEdgeStyle; animation: AIEdgeAnimation
}
export interface AIScreen {
  id: string; label: string; ratio: string; backgroundColor: string; borderColor: string
  order: number; elements: AIElement[]; edges: AIEdge[]
}
export interface AIChartSpec { title: string; screens: AIScreen[] }

// Lordicon proxy
export const lordinconApi = {
  sidebar: () => api.get<{ categories: { id: number; title: string; count: number; promoted: boolean }[] }>('/api/lordicon/sidebar'),
  icons: (categoryId: number) => api.get<{ id: number; index: number; name: string; title: string }[]>(`/api/lordicon/icons?categoryId=${categoryId}`),
  search: (query: string) => api.get<{ id: number; index: number; name: string; title: string }[]>(`/api/lordicon/search?query=${encodeURIComponent(query)}`),
  embed: (code: string) => api.get<{ lib: string; icon: string; key: string }>(`/api/lordicon/embed/${code}`),
}

// Public summary (no auth header needed but uses same client)
export const summaryApi = {
  listProjects: () => api.get('/api/summary/projects'),
  getProject: (projectId: string) => api.get(`/api/summary/${projectId}`),
};
