import { ALL_MOLECULES, CATEGORY_LABELS, LEVEL_OPTIONS } from '@/data/moleculeMetadata';
import { useMoleculeStore } from '@/store/moleculeStore';
import { useUIStore } from '@/store/uiStore';

function summarizeMolecule(id: string | null) {
  if (!id) return null;
  const meta =
    ALL_MOLECULES.find((item) => item.id === id) ??
    useMoleculeStore.getState().importedMolecules.find((item) => item.meta.id === id)?.meta ??
    null;

  if (!meta) return null;
  return {
    id: meta.id,
    nameCn: meta.name_cn,
    nameEn: meta.name_en,
    formula: meta.formula,
    level: meta.level,
    category: meta.category,
    subcategory: meta.subcategory,
    geometry: meta.geometry,
    vsepr: meta.vsepr,
    centralAtom: meta.central_atom,
    bondPairs: meta.bond_pairs,
    lonePairs: meta.lone_pairs,
    bondAngles: meta.bond_angles,
    polarity: meta.polarity,
    hybridization: meta.hybridization,
    functionalGroup: meta.functional_group,
    features: meta.features,
    charge: meta.charge,
    has3D: meta.has3D !== false,
    skipElectronFormula: meta.skipElectronFormula === true,
  };
}

function summarizeModel() {
  const model = useMoleculeStore.getState().currentModel;
  if (!model) return null;

  const elementCounts = model.atoms.reduce<Record<string, number>>((counts, atom) => {
    counts[atom.element] = (counts[atom.element] ?? 0) + 1;
    return counts;
  }, {});

  return {
    atomCount: model.atoms.length,
    bondCount: model.bonds.length,
    elementCounts,
    atoms: model.atoms.map((atom) => ({
      index: atom.index,
      element: atom.element,
      label: atom.label ?? atom.element,
      formalCharge: atom.formalCharge,
    })),
    bonds: model.bonds.map((bond, index) => ({
      index,
      from: bond.from,
      to: bond.to,
      order: bond.order,
      type: bond.type,
      lengthPm: Math.round(bond.length),
    })),
    lonePairCount: model.lonePairs.length,
  };
}

export function getChem02AiContext() {
  const molecule = useMoleculeStore.getState();
  const ui = useUIStore.getState();
  const currentMolecule = summarizeMolecule(molecule.currentMolecule?.id ?? null);
  const compareMolecule = summarizeMolecule(molecule.compareMolecule?.id ?? null);

  return {
    templateKey: 'chem02',
    aiLevel: 'L2',
    title: '分子结构查看器',
    activeMolecule: currentMolecule,
    compareMolecule,
    currentModel: summarizeModel(),
    display: {
      displayMode: ui.displayMode,
      showLabels: ui.showLabels,
      showBondLengths: ui.showBondLengths,
      showLonePairs: ui.showLonePairs,
      showVseprOverlay: ui.showVseprOverlay,
      autoRotate: ui.autoRotate,
    },
    filters: {
      searchQuery: molecule.searchQuery,
      levelFilter: molecule.levelFilter,
      categoryFilter: molecule.categoryFilter,
      levelOptions: LEVEL_OPTIONS,
      categoryOptions: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    },
    selection: {
      selectedAtomIndices: molecule.selectedAtomIndices,
      hoveredAtomIndex: molecule.hoveredAtomIndex,
    },
    compare: {
      enabled: molecule.compareMode,
      currentMoleculeId: molecule.currentMolecule?.id ?? null,
      compareMoleculeId: molecule.compareMolecule?.id ?? null,
    },
    moleculeLibrary: ALL_MOLECULES.map((meta) => ({
      id: meta.id,
      nameCn: meta.name_cn,
      nameEn: meta.name_en,
      formula: meta.formula,
      level: meta.level,
      category: meta.category,
      geometry: meta.geometry,
      vsepr: meta.vsepr,
      polarity: meta.polarity,
      hybridization: meta.hybridization,
      functionalGroup: meta.functional_group,
      features: meta.features,
      has3D: meta.has3D !== false,
      skipElectronFormula: meta.skipElectronFormula === true,
    })),
    importedMolecules: molecule.importedMolecules.map((item) => ({
      id: item.meta.id,
      nameCn: item.meta.name_cn,
      nameEn: item.meta.name_en,
      formula: item.meta.formula,
    })),
    resultInterpretationHints: [
      '分子几何、VSEPR、杂化、极性、键长、键角和模型统计由 C02 元数据或模型计算提供。',
      'AI 应通过 operations 设置分子、显示模式、筛选、对比和原子选择，不要直接手写 molecule/ui 状态树。',
      '选择原子时必须使用 currentModel.atoms 中存在的 index；键长/键角展示由 C02 根据选择计算。',
      '复杂分子可能不适合 electron-formula；少于 4 个碳原子的分子不适合 skeletal。',
    ],
  };
}
