import { create } from 'zustand';
import type { RenderMode, ExpansionRange, PackingType, BondType } from '@/engine/types';

export interface CrystalStoreSnapshot {
  selectedCrystalId: string;
  activeTab: 'crystal' | 'packing';
  renderMode: RenderMode;
  expansionRange: ExpansionRange;
  showUnitCell: boolean;
  showBonds: boolean;
  showLabels: boolean;
  showAxes: boolean;
  visibleBondTypes: BondType[];
  highlightedAtomIdx: number | null;
  highlightedNeighbors: number[];
  packingType: PackingType;
  packingStep: number;
  packingMaxSteps: number;
  packingPlaying: boolean;
  packingSpeed: number;
  showVoids: boolean;
  voidType: 'tetrahedral' | 'octahedral' | 'all';
}

interface CrystalState {
  // Crystal selection
  selectedCrystalId: string;

  // View mode
  activeTab: 'crystal' | 'packing';

  // Render settings
  renderMode: RenderMode;
  expansionRange: ExpansionRange;
  showUnitCell: boolean;
  showBonds: boolean;
  showLabels: boolean;
  showAxes: boolean;

  // Bond type visibility filter
  visibleBondTypes: Set<BondType>;

  // Coordination highlight
  highlightedAtomIdx: number | null;
  highlightedNeighbors: number[];

  // Packing mode
  packingType: PackingType;
  packingStep: number;
  packingMaxSteps: number;
  packingPlaying: boolean;
  packingSpeed: number;
  showVoids: boolean;
  voidType: 'tetrahedral' | 'octahedral' | 'all';

  // Actions
  selectCrystal: (id: string) => void;
  setActiveTab: (tab: 'crystal' | 'packing') => void;
  setRenderMode: (mode: RenderMode) => void;
  setExpansionRange: (range: ExpansionRange) => void;
  toggleUnitCell: () => void;
  toggleBonds: () => void;
  toggleLabels: () => void;
  toggleAxes: () => void;
  toggleBondType: (type: BondType) => void;
  setHighlightedAtom: (idx: number | null) => void;
  setHighlightedNeighbors: (indices: number[]) => void;
  setPackingType: (type: PackingType) => void;
  setPackingStep: (step: number) => void;
  togglePackingPlay: () => void;
  setPackingSpeed: (speed: number) => void;
  toggleVoids: () => void;
  setVoidType: (type: 'tetrahedral' | 'octahedral' | 'all') => void;
  getSnapshot: () => CrystalStoreSnapshot;
  loadSnapshot: (snapshot: CrystalStoreSnapshot) => void;
}

const ALL_BOND_TYPES: BondType[] = [
  'ionic',
  'covalent-sigma',
  'covalent-pi',
  'metallic',
  'hydrogen',
  'vanDerWaals',
];

export const useCrystalStore = create<CrystalState>((set) => ({
  // Crystal selection
  selectedCrystalId: 'CRY-001',

  // View mode
  activeTab: 'crystal',

  // Render settings
  renderMode: 'ballAndStick',
  expansionRange: { x: [0, 1], y: [0, 1], z: [0, 1] },
  showUnitCell: true,
  showBonds: true,
  showLabels: false,
  showAxes: true,

  // Bond type visibility — all visible by default
  visibleBondTypes: new Set<BondType>(ALL_BOND_TYPES),

  // Coordination highlight
  highlightedAtomIdx: null,
  highlightedNeighbors: [],

  // Packing mode
  packingType: 'FCC',
  packingStep: 0,
  packingMaxSteps: 10,
  packingPlaying: false,
  packingSpeed: 1,
  showVoids: false,
  voidType: 'all',

  // Actions
  selectCrystal: (id) =>
    set({
      selectedCrystalId: id,
      highlightedAtomIdx: null,
      highlightedNeighbors: [],
      expansionRange: { x: [0, 1], y: [0, 1], z: [0, 1] },
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setRenderMode: (mode) => set({ renderMode: mode }),

  setExpansionRange: (range) => set({ expansionRange: range }),

  toggleUnitCell: () => set((s) => ({ showUnitCell: !s.showUnitCell })),

  toggleBonds: () => set((s) => ({ showBonds: !s.showBonds })),

  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),

  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),

  toggleBondType: (type) =>
    set((s) => {
      const next = new Set(s.visibleBondTypes);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return { visibleBondTypes: next };
    }),

  setHighlightedAtom: (idx) => set({ highlightedAtomIdx: idx }),

  setHighlightedNeighbors: (indices) => set({ highlightedNeighbors: indices }),

  setPackingType: (type) => set({ packingType: type, packingStep: 0, packingPlaying: false }),

  setPackingStep: (step) => set({ packingStep: step }),

  togglePackingPlay: () => set((s) => ({ packingPlaying: !s.packingPlaying })),

  setPackingSpeed: (speed) => set({ packingSpeed: speed }),

  toggleVoids: () => set((s) => ({ showVoids: !s.showVoids })),

  setVoidType: (type) => set({ voidType: type }),

  getSnapshot: (): CrystalStoreSnapshot => {
    const state: CrystalState = useCrystalStore.getState();
    return {
      selectedCrystalId: state.selectedCrystalId,
      activeTab: state.activeTab,
      renderMode: state.renderMode,
      expansionRange: state.expansionRange,
      showUnitCell: state.showUnitCell,
      showBonds: state.showBonds,
      showLabels: state.showLabels,
      showAxes: state.showAxes,
      visibleBondTypes: [...state.visibleBondTypes],
      highlightedAtomIdx: state.highlightedAtomIdx,
      highlightedNeighbors: [...state.highlightedNeighbors],
      packingType: state.packingType,
      packingStep: state.packingStep,
      packingMaxSteps: state.packingMaxSteps,
      packingPlaying: state.packingPlaying,
      packingSpeed: state.packingSpeed,
      showVoids: state.showVoids,
      voidType: state.voidType,
    };
  },

  loadSnapshot: (snapshot: CrystalStoreSnapshot) => set({
    selectedCrystalId: snapshot.selectedCrystalId,
    activeTab: snapshot.activeTab,
    renderMode: snapshot.renderMode,
    expansionRange: snapshot.expansionRange,
    showUnitCell: snapshot.showUnitCell,
    showBonds: snapshot.showBonds,
    showLabels: snapshot.showLabels,
    showAxes: snapshot.showAxes,
    visibleBondTypes: new Set<BondType>(snapshot.visibleBondTypes),
    highlightedAtomIdx: snapshot.highlightedAtomIdx,
    highlightedNeighbors: [...snapshot.highlightedNeighbors],
    packingType: snapshot.packingType,
    packingStep: snapshot.packingStep,
    packingMaxSteps: snapshot.packingMaxSteps,
    packingPlaying: snapshot.packingPlaying,
    packingSpeed: snapshot.packingSpeed,
    showVoids: snapshot.showVoids,
    voidType: snapshot.voidType,
  }),
}));
