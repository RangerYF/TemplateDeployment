import { ALL_MOLECULES, type MoleculeCategory } from '@/data/moleculeMetadata';
import { useMoleculeStore } from '@/store/moleculeStore';
import { is2DMode, type DisplayMode, useUIStore } from '@/store/uiStore';

type Operation = {
  type?: string;
  [key: string]: unknown;
};

export interface ApplyOperationsResult {
  ok: boolean;
  applied: number;
  warnings: string[];
}

const DISPLAY_MODES = new Set<DisplayMode>([
  'ball-and-stick',
  'space-filling',
  'electron-cloud',
  'structural',
  'electron-formula',
  'skeletal',
]);

const CATEGORY_VALUES = new Set<string>([
  'all',
  'diatomic',
  'triatomic',
  'tetratomic',
  'pentatomic',
  'polyatomic',
  'ion',
  'alkane',
  'alkene',
  'alkyne',
  'aromatic',
  'alcohol_aldehyde_acid_ester',
  'nitrogen_organic',
  'polymer_monomer',
  'inorganic_acid',
  'coordination',
  'biomolecule',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.map((item) => Number(item));
  return values.every(Number.isFinite) ? values : undefined;
}

function normalizeFormula(value: string): string {
  return value
    .toLowerCase()
    .replace(/₂/g, '2')
    .replace(/₃/g, '3')
    .replace(/₄/g, '4')
    .replace(/₅/g, '5')
    .replace(/₆/g, '6')
    .replace(/₇/g, '7')
    .replace(/₈/g, '8')
    .replace(/₉/g, '9')
    .replace(/₀/g, '0')
    .replace(/\s/g, '');
}

function findMoleculeId(op: Record<string, unknown>): string | null {
  const molecule = useMoleculeStore.getState();
  const id = asString(op.moleculeId) ?? asString(op.id);
  if (id) {
    const normalizedId = id.toLowerCase();
    const match =
      ALL_MOLECULES.find((item) => item.id.toLowerCase() === normalizedId) ??
      molecule.importedMolecules.find((item) => item.meta.id.toLowerCase() === normalizedId)?.meta;
    if (match) return match.id;
  }

  const name = asString(op.name) ?? asString(op.moleculeName);
  if (name) {
    const normalizedName = name.toLowerCase();
    const match =
      ALL_MOLECULES.find((item) =>
        item.name_cn === name ||
        item.name_en.toLowerCase() === normalizedName ||
        item.name_cn.includes(name) ||
        item.name_en.toLowerCase().includes(normalizedName),
      ) ??
      molecule.importedMolecules.find((item) =>
        item.meta.name_cn === name ||
        item.meta.name_en.toLowerCase() === normalizedName ||
        item.meta.name_cn.includes(name) ||
        item.meta.name_en.toLowerCase().includes(normalizedName),
      )?.meta;
    if (match) return match.id;
  }

  const formula = asString(op.formula);
  if (formula) {
    const normalizedFormula = normalizeFormula(formula);
    const match =
      ALL_MOLECULES.find((item) => normalizeFormula(item.formula) === normalizedFormula) ??
      molecule.importedMolecules.find((item) => normalizeFormula(item.meta.formula) === normalizedFormula)?.meta;
    if (match) return match.id;
  }

  return null;
}

function setDisplayMode(displayMode: DisplayMode, warnings: string[]) {
  const current = useMoleculeStore.getState().currentMolecule;
  if (displayMode === 'electron-formula' && current?.skipElectronFormula) {
    warnings.push(`${current.formula} 不适合电子式展示，已保留当前显示模式。`);
    return;
  }
  if (displayMode === 'skeletal') {
    const carbonCount = useMoleculeStore.getState().currentModel?.atoms.filter((atom) => atom.element === 'C').length ?? 0;
    if (carbonCount < 4) {
      warnings.push('当前分子碳原子少于 4 个，不适合键线式展示，已保留当前显示模式。');
      return;
    }
  }
  useUIStore.getState().setDisplayMode(displayMode);
}

function applyPreset(presetId: string, warnings: string[]) {
  const presets: Record<string, Operation[]> = {
    'water-vsepr': [
      { type: 'selectMolecule', moleculeId: 'MOL-012' },
      { type: 'setDisplayMode', displayMode: 'ball-and-stick' },
      { type: 'setDisplayOptions', showLabels: true, showLonePairs: true, showVseprOverlay: true, showBondLengths: true },
    ],
    'co2-linear': [
      { type: 'selectMolecule', moleculeId: 'MOL-013' },
      { type: 'setDisplayMode', displayMode: 'ball-and-stick' },
      { type: 'setDisplayOptions', showLabels: true, showBondLengths: true, showVseprOverlay: true },
    ],
    'methane-tetrahedral': [
      { type: 'selectMolecule', moleculeId: 'MOL-026' },
      { type: 'setDisplayMode', displayMode: 'ball-and-stick' },
      { type: 'setDisplayOptions', showLabels: true, showVseprOverlay: true, autoRotate: true },
    ],
    'ammonia-lone-pair': [
      { type: 'selectMolecule', moleculeId: 'MOL-019' },
      { type: 'setDisplayMode', displayMode: 'ball-and-stick' },
      { type: 'setDisplayOptions', showLabels: true, showLonePairs: true, showVseprOverlay: true },
    ],
    'ethylene-pi-bond': [
      { type: 'selectMolecule', moleculeId: 'MOL-049' },
      { type: 'setDisplayMode', displayMode: 'electron-cloud' },
      { type: 'setDisplayOptions', showLabels: true, showBondLengths: true, autoRotate: true },
    ],
    'benzene-delocalized': [
      { type: 'selectMolecule', moleculeId: 'MOL-055' },
      { type: 'setDisplayMode', displayMode: 'electron-cloud' },
      { type: 'setDisplayOptions', showLabels: true, showBondLengths: true, autoRotate: true },
    ],
    'carbonate-resonance': [
      { type: 'selectMolecule', moleculeId: 'MOL-036' },
      { type: 'setDisplayMode', displayMode: 'electron-formula' },
      { type: 'setDisplayOptions', showLabels: true, showBondLengths: true },
    ],
    'copper-ammine-complex': [
      { type: 'selectMolecule', moleculeId: 'MOL-087' },
      { type: 'setDisplayMode', displayMode: 'ball-and-stick' },
      { type: 'setDisplayOptions', showLabels: true, showBondLengths: true, autoRotate: true },
    ],
    'glucose-chain': [
      { type: 'selectMolecule', moleculeId: 'MOL-092' },
      { type: 'setDisplayMode', displayMode: 'structural' },
      { type: 'setDisplayOptions', showLabels: true },
    ],
  };

  const operations = presets[presetId];
  if (!operations) {
    warnings.push(`未知 C02 预设场景: ${presetId}`);
    return 0;
  }
  return applyChem02Operations(operations).applied;
}

function applyScenario(scenarioId: string, warnings: string[]) {
  const scenarioToPreset: Record<string, string> = {
    'vsepr-bent-water': 'water-vsepr',
    'vsepr-linear-co2': 'co2-linear',
    'tetrahedral-methane': 'methane-tetrahedral',
    'lone-pair-effect': 'ammonia-lone-pair',
    'aromatic-delocalization': 'benzene-delocalized',
    'coordination-bond': 'copper-ammine-complex',
  };

  if (scenarioToPreset[scenarioId]) {
    return applyPreset(scenarioToPreset[scenarioId], warnings);
  }

  const scenarios: Record<string, Operation[]> = {
    'polarity-comparison': [
      { type: 'selectMolecule', moleculeId: 'MOL-013' },
      { type: 'setCompareMode', enabled: true, compareMoleculeId: 'MOL-012' },
      { type: 'setDisplayMode', displayMode: 'ball-and-stick' },
      { type: 'setDisplayOptions', showLabels: true, showVseprOverlay: true },
    ],
    'hybridization-sp-sp2-sp3': [
      { type: 'selectMolecule', moleculeId: 'MOL-053' },
      { type: 'setCompareMode', enabled: true, compareMoleculeId: 'MOL-049' },
      { type: 'setDisplayMode', displayMode: 'electron-cloud' },
      { type: 'setDisplayOptions', showLabels: true, showBondLengths: true },
    ],
    'organic-functional-groups': [
      { type: 'setMoleculeFilter', categoryFilter: 'alcohol_aldehyde_acid_ester', levelFilter: '全部' },
      { type: 'selectMolecule', moleculeId: 'MOL-063' },
      { type: 'setDisplayMode', displayMode: 'structural' },
    ],
    'bond-length-comparison': [
      { type: 'selectMolecule', moleculeId: 'MOL-049' },
      { type: 'setCompareMode', enabled: true, compareMoleculeId: 'MOL-053' },
      { type: 'setDisplayOptions', showBondLengths: true, showLabels: true },
    ],
  };

  const operations = scenarios[scenarioId];
  if (!operations) {
    warnings.push(`未知 C02 教学场景: ${scenarioId}`);
    return 0;
  }
  return applyChem02Operations(operations).applied;
}

function applyOneOperation(operation: Operation, warnings: string[]): boolean {
  const op = asRecord(operation);
  const type = asString(op.type);

  switch (type) {
    case 'selectMolecule': {
      const moleculeId = findMoleculeId(op);
      if (!moleculeId) {
        warnings.push('未找到要选择的分子，请提供有效 moleculeId、名称或分子式。');
        return false;
      }
      useMoleculeStore.getState().selectMolecule(moleculeId);
      return true;
    }
    case 'setDisplayMode': {
      const displayMode = asString(op.displayMode) ?? asString(op.mode);
      if (!displayMode || !DISPLAY_MODES.has(displayMode as DisplayMode)) {
        warnings.push(`无效显示模式: ${displayMode ?? 'undefined'}`);
        return false;
      }
      setDisplayMode(displayMode as DisplayMode, warnings);
      return true;
    }
    case 'setDisplayOptions': {
      const patch: Partial<ReturnType<typeof useUIStore.getState>> = {};
      const optionKeys = ['showLabels', 'showBondLengths', 'showLonePairs', 'showVseprOverlay', 'autoRotate'] as const;
      for (const key of optionKeys) {
        const value = asBoolean(op[key]);
        if (value !== undefined) patch[key] = value;
      }
      if (Object.keys(patch).length === 0) {
        warnings.push('setDisplayOptions 没有可应用的布尔显示项。');
        return false;
      }
      if (is2DMode(useUIStore.getState().displayMode) && patch.showLonePairs) {
        warnings.push('2D 模式下孤电子对 3D 覆盖不会显示。');
      }
      useUIStore.setState(patch);
      return true;
    }
    case 'setMoleculeFilter': {
      const store = useMoleculeStore.getState();
      const searchQuery = asString(op.searchQuery);
      const levelFilter = asString(op.levelFilter);
      const categoryFilter = asString(op.categoryFilter);
      if (searchQuery !== undefined) store.setSearchQuery(searchQuery);
      if (levelFilter !== undefined) store.setLevelFilter(levelFilter);
      if (categoryFilter !== undefined) {
        if (!CATEGORY_VALUES.has(categoryFilter)) {
          warnings.push(`无效分子分类: ${categoryFilter}`);
        } else {
          store.setCategoryFilter(categoryFilter as MoleculeCategory | 'all');
        }
      }
      return searchQuery !== undefined || levelFilter !== undefined || categoryFilter !== undefined;
    }
    case 'setCompareMode': {
      const enabled = asBoolean(op.enabled) ?? asBoolean(op.compareMode) ?? true;
      const store = useMoleculeStore.getState();
      if (store.compareMode !== enabled) store.toggleCompareMode();
      const compareMoleculeId = findMoleculeId(op);
      if (enabled && compareMoleculeId) store.setCompareMolecule(compareMoleculeId);
      if (!enabled) store.setCompareMolecule(null);
      return true;
    }
    case 'selectCompareMolecule': {
      const moleculeId = findMoleculeId(op);
      if (!moleculeId) {
        warnings.push('未找到要对比的分子，请提供有效 moleculeId、名称或分子式。');
        return false;
      }
      const store = useMoleculeStore.getState();
      if (!store.compareMode) store.toggleCompareMode();
      store.setCompareMolecule(moleculeId);
      return true;
    }
    case 'selectAtoms': {
      const atomIndices = asNumberArray(op.atomIndices) ?? asNumberArray(op.indices);
      const model = useMoleculeStore.getState().currentModel;
      if (!atomIndices || !model) {
        warnings.push('selectAtoms 需要 atomIndices 且当前存在分子模型。');
        return false;
      }
      const valid = atomIndices.every((index) => Number.isInteger(index) && index >= 0 && index < model.atoms.length);
      if (!valid || atomIndices.length > 3) {
        warnings.push('atomIndices 必须是 currentModel.atoms 中 0 到 2/3 个有效原子索引。');
        return false;
      }
      useMoleculeStore.setState({ selectedAtomIndices: atomIndices });
      return true;
    }
    case 'clearAtomSelection':
      useMoleculeStore.getState().clearAtomSelection();
      return true;
    case 'loadMoleculePreset': {
      const presetId = asString(op.presetId) ?? asString(op.id);
      if (!presetId) {
        warnings.push('loadMoleculePreset 需要 presetId。');
        return false;
      }
      return applyPreset(presetId, warnings) > 0;
    }
    case 'loadTeachingScenario': {
      const scenarioId = asString(op.scenarioId) ?? asString(op.presetId);
      if (!scenarioId) {
        warnings.push('loadTeachingScenario 需要 scenarioId。');
        return false;
      }
      return applyScenario(scenarioId, warnings) > 0;
    }
    default:
      warnings.push(`未知 operation: ${type ?? 'undefined'}`);
      return false;
  }
}

export function applyChem02Operations(operations: unknown): ApplyOperationsResult {
  const warnings: string[] = [];
  if (!Array.isArray(operations)) {
    return { ok: false, applied: 0, warnings: ['operations 必须是数组。'] };
  }

  let applied = 0;
  for (const operation of operations) {
    if (applyOneOperation(operation as Operation, warnings)) applied += 1;
  }

  return {
    ok: warnings.length === 0,
    applied,
    warnings,
  };
}
