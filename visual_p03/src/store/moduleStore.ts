import { create } from 'zustand';

export type ModuleId = 'refraction' | 'lens' | 'doubleslit' | 'diffraction' | 'thinfilm';

interface ModuleState {
  activeModule: ModuleId;
  setActiveModule: (id: ModuleId) => void;
}

export const useModuleStore = create<ModuleState>((set) => ({
  activeModule: 'refraction',
  setActiveModule: (id) => set({ activeModule: id }),
}));
