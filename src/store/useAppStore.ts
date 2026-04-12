import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  selectedProvider: string;
  selectedModel: string;

  setSelectedModel: (provider: string, model: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-opus-4-6',

      setSelectedModel: (provider, model) => set({ selectedProvider: provider, selectedModel: model }),
    }),
    { name: 'flowchart-app-store' }
  )
);
