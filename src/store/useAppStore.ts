import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, DailyEntry } from '../types';

interface AppState {
  activeProjectId: string | null;
  activeEntryId: string | null;
  selectedProvider: string;
  selectedModel: string;
  projects: Project[];
  currentEntry: DailyEntry | null;

  setActiveProject: (id: string) => void;
  setActiveEntry: (id: string | null) => void;
  setSelectedModel: (provider: string, model: string) => void;
  setProjects: (projects: Project[]) => void;
  setCurrentEntry: (entry: DailyEntry | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      activeEntryId: null,
      selectedProvider: 'anthropic',
      selectedModel: 'claude-opus-4-6',
      projects: [],
      currentEntry: null,

      setActiveProject: (id) => set({ activeProjectId: id }),
      setActiveEntry: (id) => set({ activeEntryId: id }),
      setSelectedModel: (provider, model) => set({ selectedProvider: provider, selectedModel: model }),
      setProjects: (projects) => set({ projects }),
      setCurrentEntry: (entry) => set({ currentEntry: entry }),
    }),
    { name: 'audit-dashboard-store' }
  )
);
