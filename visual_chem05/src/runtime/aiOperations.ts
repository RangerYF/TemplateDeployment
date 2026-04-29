import { CRYSTAL_STRUCTURES, getCrystalById } from '@/data/crystalRepository';
import type { BondType, ExpansionRange, PackingType, RenderMode } from '@/engine/types';
import { useCrystalStore } from '@/store/crystalStore';
import { useUIStore } from '@/store/uiStore';

type Operation = {
  type?: string;
  [key: string]: unknown;
};

export interface ApplyOperationsResult {
  ok: boolean;
  applied: number;
  warnings: string[];
}

const RENDER_MODES = new Set<RenderMode>([
  'ballAndStick',
  'spaceFilling',
  'polyhedral',
  'wireframe',
]);

const BOND_TYPES = new Set<BondType>([
  'ionic',
  'covalent-sigma',
  'covalent-pi',
  'metallic',
  'hydrogen',
  'vanDerWaals',
]);

const PACKING_TYPES = new Set<PackingType>(['SC', 'BCC', 'FCC', 'HCP']);
const VOID_TYPES = new Set(['tetrahedral', 'octahedral', 'all']);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function asNumberPair(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const start = Number(value[0]);
  const end = Number(value[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return undefined;
  return [Math.min(start, end), Math.max(start, end)];
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

function findCrystalId(op: Record<string, unknown>): string | null {
  const id = asString(op.crystalId) ?? asString(op.id);
  if (id) {
    const normalizedId = id.toLowerCase();
    const match = CRYSTAL_STRUCTURES.find((item) => item.id.toLowerCase() === normalizedId);
    if (match) return match.id;
  }

  const name = asString(op.name) ?? asString(op.crystalName);
  if (name) {
    const normalizedName = name.toLowerCase();
    const matches = CRYSTAL_STRUCTURES.filter((item) =>
      item.name === name ||
      item.name.toLowerCase() === normalizedName ||
      item.name.includes(name) ||
      item.structureType.includes(name),
    );
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) return null;
  }

  const formula = asString(op.formula);
  if (formula) {
    const normalizedFormula = normalizeFormula(formula);
    const matches = CRYSTAL_STRUCTURES.filter((item) => normalizeFormula(item.formula) === normalizedFormula);
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) return null;
  }

  const structureType = asString(op.structureType);
  if (structureType) {
    const matches = CRYSTAL_STRUCTURES.filter((item) => item.structureType.includes(structureType));
    if (matches.length === 1) return matches[0].id;
  }

  return null;
}

function normalizeRenderMode(value: string): RenderMode | null {
  const aliases: Record<string, RenderMode> = {
    ball: 'ballAndStick',
    ballAndStick: 'ballAndStick',
    'ball-and-stick': 'ballAndStick',
    球棍: 'ballAndStick',
    spaceFilling: 'spaceFilling',
    'space-filling': 'spaceFilling',
    填充: 'spaceFilling',
    空间填充: 'spaceFilling',
    polyhedral: 'polyhedral',
    多面体: 'polyhedral',
    配位多面体: 'polyhedral',
    wireframe: 'wireframe',
    线框: 'wireframe',
  };
  return aliases[value] ?? null;
}

function clampExpansionPair(pair: [number, number]): [number, number] {
  const start = Math.max(-1, Math.min(2, pair[0]));
  const end = Math.max(-1, Math.min(2, pair[1]));
  return [Math.min(start, end), Math.max(start, end)];
}

function getExpansionRange(op: Record<string, unknown>): ExpansionRange | null {
  const size = asNumber(op.size) ?? asNumber(op.range);
  if (size !== undefined && Number.isInteger(size) && size >= 1 && size <= 4) {
    return {
      x: [0, size - 1],
      y: [0, size - 1],
      z: [0, size - 1],
    };
  }

  const x = asNumberPair(op.x);
  const y = asNumberPair(op.y);
  const z = asNumberPair(op.z);
  if (x || y || z) {
    const current = useCrystalStore.getState().expansionRange;
    return {
      x: clampExpansionPair(x ?? current.x),
      y: clampExpansionPair(y ?? current.y),
      z: clampExpansionPair(z ?? current.z),
    };
  }

  return null;
}

function setBooleanState<T extends object>(
  currentValue: boolean,
  value: boolean | undefined,
  patch: Partial<T>,
  key: keyof T,
) {
  if (value !== undefined && value !== currentValue) {
    patch[key] = value as T[keyof T];
  }
}

function findAtomIndex(op: Record<string, unknown>, warnings: string[]): number | null {
  const crystal = getCrystalById(useCrystalStore.getState().selectedCrystalId);
  if (!crystal) return null;

  const direct = asNumber(op.atomIndex) ?? asNumber(op.siteIndex) ?? asNumber(op.index);
  if (direct !== undefined) {
    if (Number.isInteger(direct) && direct >= 0 && direct < crystal.atomSites.length) {
      return direct;
    }
    warnings.push(`原子索引 ${direct} 不在当前晶体 atomSites 范围内。`);
    return null;
  }

  const element = asString(op.element);
  const label = asString(op.label);
  const candidates = crystal.atomSites
    .map((site, index) => ({ site, index }))
    .filter(({ site }) =>
      (element && site.element.toLowerCase() === element.toLowerCase()) ||
      (label && (site.label === label || site.element === label)),
    );

  if (candidates.length === 1) return candidates[0].index;
  if (candidates.length > 1) {
    warnings.push('当前晶体中匹配到多个原子位点，请使用 atomIndex/siteIndex 精确指定。');
  }
  return null;
}

function applyPreset(presetId: string, warnings: string[]) {
  const presets: Record<string, Operation[]> = {
    'nacl-rock-salt': [
      { type: 'selectCrystal', crystalId: 'CRY-001' },
      { type: 'setRenderMode', renderMode: 'polyhedral' },
      { type: 'setDisplayOptions', showUnitCell: true, showBonds: true, showLabels: true, showTeachingPoints: true },
    ],
    'cscl-eight-coordination': [
      { type: 'selectCrystal', crystalId: 'CRY-002' },
      { type: 'setRenderMode', renderMode: 'polyhedral' },
      { type: 'highlightAtom', atomIndex: 0 },
      { type: 'setDisplayOptions', showUnitCell: true, showBonds: true, showLabels: true },
    ],
    'diamond-network': [
      { type: 'selectCrystal', crystalId: 'CRY-005' },
      { type: 'setRenderMode', renderMode: 'ballAndStick' },
      { type: 'setDisplayOptions', showBonds: true, showLabels: true, showTeachingPoints: true },
    ],
    'graphite-layered': [
      { type: 'selectCrystal', crystalId: 'CRY-013' },
      { type: 'setRenderMode', renderMode: 'ballAndStick' },
      { type: 'setExpansionRange', size: 2 },
      { type: 'setDisplayOptions', showBonds: true, showLabels: false, showTeachingPoints: true },
    ],
    'fcc-copper': [
      { type: 'selectCrystal', crystalId: 'CRY-008' },
      { type: 'setActiveTab', tab: 'packing' },
      { type: 'setPackingType', packingType: 'FCC' },
      { type: 'setVoids', showVoids: true, voidType: 'all' },
    ],
    'bcc-iron': [
      { type: 'selectCrystal', crystalId: 'CRY-009' },
      { type: 'setActiveTab', tab: 'packing' },
      { type: 'setPackingType', packingType: 'BCC' },
    ],
    'hcp-magnesium': [
      { type: 'selectCrystal', crystalId: 'CRY-010' },
      { type: 'setActiveTab', tab: 'packing' },
      { type: 'setPackingType', packingType: 'HCP' },
    ],
    'zinc-blende': [
      { type: 'selectCrystal', crystalId: 'CRY-015' },
      { type: 'setRenderMode', renderMode: 'polyhedral' },
      { type: 'setDisplayOptions', showUnitCell: true, showBonds: true, showLabels: true },
    ],
  };

  const operations = presets[presetId];
  if (!operations) {
    warnings.push(`未知 C05 晶体预设: ${presetId}`);
    return 0;
  }
  return applyChem05Operations(operations).applied;
}

function applyScenario(scenarioId: string, warnings: string[]) {
  const scenarioToPreset: Record<string, string> = {
    'nacl-coordination': 'nacl-rock-salt',
    'cscl-coordination': 'cscl-eight-coordination',
    'diamond-covalent-network': 'diamond-network',
    'graphite-layered-structure': 'graphite-layered',
    'fcc-close-packing': 'fcc-copper',
    'bcc-metal-packing': 'bcc-iron',
    'hcp-close-packing': 'hcp-magnesium',
    'zinc-blende-tetrahedral': 'zinc-blende',
  };

  if (scenarioToPreset[scenarioId]) {
    return applyPreset(scenarioToPreset[scenarioId], warnings);
  }

  const scenarios: Record<string, Operation[]> = {
    'unit-cell-expansion': [
      { type: 'setActiveTab', tab: 'crystal' },
      { type: 'setExpansionRange', size: 2 },
      { type: 'setDisplayOptions', showUnitCell: true, showAxes: true },
    ],
    'voids-in-close-packing': [
      { type: 'setActiveTab', tab: 'packing' },
      { type: 'setPackingType', packingType: 'FCC' },
      { type: 'setVoids', showVoids: true, voidType: 'all' },
    ],
    'bond-type-comparison': [
      { type: 'selectCrystal', crystalId: 'CRY-013' },
      { type: 'setRenderMode', renderMode: 'ballAndStick' },
      { type: 'setDisplayOptions', showBonds: true, showLabels: true },
    ],
  };

  const operations = scenarios[scenarioId];
  if (!operations) {
    warnings.push(`未知 C05 教学场景: ${scenarioId}`);
    return 0;
  }
  return applyChem05Operations(operations).applied;
}

function applyOneOperation(operation: Operation, warnings: string[]): boolean {
  const op = asRecord(operation);
  const type = asString(op.type);

  switch (type) {
    case 'selectCrystal': {
      const crystalId = findCrystalId(op);
      if (!crystalId) {
        warnings.push('未找到唯一晶体，请提供有效 crystalId、名称、结构类型或分子式。');
        return false;
      }
      useCrystalStore.getState().selectCrystal(crystalId);
      useCrystalStore.getState().setActiveTab('crystal');
      const crystal = getCrystalById(crystalId);
      if (crystal?.packingType) {
        useCrystalStore.getState().setPackingType(crystal.packingType);
        useCrystalStore.getState().setActiveTab('crystal');
      }
      return true;
    }
    case 'setActiveTab': {
      const tab = asString(op.tab) ?? asString(op.activeTab);
      if (tab !== 'crystal' && tab !== 'packing') {
        warnings.push(`无效标签页: ${tab ?? 'undefined'}`);
        return false;
      }
      useCrystalStore.getState().setActiveTab(tab);
      return true;
    }
    case 'setRenderMode': {
      const rawMode = asString(op.renderMode) ?? asString(op.mode);
      const renderMode = rawMode ? normalizeRenderMode(rawMode) : null;
      if (!renderMode || !RENDER_MODES.has(renderMode)) {
        warnings.push(`无效渲染模式: ${rawMode ?? 'undefined'}`);
        return false;
      }
      useCrystalStore.getState().setRenderMode(renderMode);
      useCrystalStore.getState().setActiveTab('crystal');
      return true;
    }
    case 'setExpansionRange': {
      const range = getExpansionRange(op);
      if (!range) {
        warnings.push('setExpansionRange 需要 size/range 或 x/y/z 范围。');
        return false;
      }
      useCrystalStore.getState().setExpansionRange(range);
      useCrystalStore.getState().setActiveTab('crystal');
      return true;
    }
    case 'setDisplayOptions': {
      const crystal = useCrystalStore.getState();
      const crystalPatch: Partial<ReturnType<typeof useCrystalStore.getState>> = {};
      setBooleanState(crystal.showUnitCell, asBoolean(op.showUnitCell), crystalPatch, 'showUnitCell');
      setBooleanState(crystal.showBonds, asBoolean(op.showBonds), crystalPatch, 'showBonds');
      setBooleanState(crystal.showLabels, asBoolean(op.showLabels), crystalPatch, 'showLabels');
      setBooleanState(crystal.showAxes, asBoolean(op.showAxes), crystalPatch, 'showAxes');

      const ui = useUIStore.getState();
      const uiPatch: Partial<ReturnType<typeof useUIStore.getState>> = {};
      setBooleanState(ui.showTeachingPoints, asBoolean(op.showTeachingPoints), uiPatch, 'showTeachingPoints');
      setBooleanState(ui.showInfoPanel, asBoolean(op.showInfoPanel), uiPatch, 'showInfoPanel');

      if (Object.keys(crystalPatch).length === 0 && Object.keys(uiPatch).length === 0) {
        warnings.push('setDisplayOptions 没有可应用的布尔显示项。');
        return false;
      }
      if (Object.keys(crystalPatch).length > 0) useCrystalStore.setState(crystalPatch);
      if (Object.keys(uiPatch).length > 0) useUIStore.setState(uiPatch);
      if (Object.keys(crystalPatch).length > 0) useCrystalStore.getState().setActiveTab('crystal');
      return true;
    }
    case 'setBondTypeVisibility': {
      const visibleBondTypes = Array.isArray(op.visibleBondTypes)
        ? op.visibleBondTypes.map((item) => asString(item)).filter(Boolean)
        : undefined;
      if (visibleBondTypes) {
        const valid = visibleBondTypes.filter((item): item is BondType => BOND_TYPES.has(item as BondType));
        if (valid.length === 0) {
          warnings.push('visibleBondTypes 没有有效键类型。');
          return false;
        }
        useCrystalStore.setState({ visibleBondTypes: new Set(valid) });
        useCrystalStore.getState().setActiveTab('crystal');
        return true;
      }

      const bondType = asString(op.bondType) ?? asString(op.typeValue);
      const visible = asBoolean(op.visible);
      if (!bondType || !BOND_TYPES.has(bondType as BondType) || visible === undefined) {
        warnings.push('setBondTypeVisibility 需要有效 bondType 和 visible，或 visibleBondTypes 数组。');
        return false;
      }
      const next = new Set(useCrystalStore.getState().visibleBondTypes);
      if (visible) next.add(bondType as BondType);
      else next.delete(bondType as BondType);
      useCrystalStore.setState({ visibleBondTypes: next });
      useCrystalStore.getState().setActiveTab('crystal');
      return true;
    }
    case 'highlightAtom': {
      if (op.atomIndex === null || op.siteIndex === null) {
        useCrystalStore.setState({ highlightedAtomIdx: null, highlightedNeighbors: [] });
        return true;
      }
      const atomIndex = findAtomIndex(op, warnings);
      if (atomIndex === null) return false;
      useCrystalStore.getState().setHighlightedAtom(atomIndex);
      useCrystalStore.getState().setActiveTab('crystal');
      return true;
    }
    case 'clearHighlight':
      useCrystalStore.setState({ highlightedAtomIdx: null, highlightedNeighbors: [] });
      return true;
    case 'setPackingType': {
      const packingType = asString(op.packingType) ?? asString(op.typeValue);
      if (!packingType || !PACKING_TYPES.has(packingType as PackingType)) {
        warnings.push(`无效堆积类型: ${packingType ?? 'undefined'}`);
        return false;
      }
      useCrystalStore.getState().setPackingType(packingType as PackingType);
      useCrystalStore.getState().setActiveTab('packing');
      return true;
    }
    case 'setPackingStep': {
      const step = asNumber(op.step) ?? asNumber(op.packingStep);
      const maxStep = useCrystalStore.getState().packingMaxSteps;
      if (step === undefined || !Number.isInteger(step)) {
        warnings.push('setPackingStep 需要整数 step。');
        return false;
      }
      useCrystalStore.getState().setPackingStep(Math.max(0, Math.min(maxStep, step)));
      useCrystalStore.getState().setActiveTab('packing');
      return true;
    }
    case 'setPackingPlayback': {
      const playing = asBoolean(op.playing);
      const speed = asNumber(op.speed) ?? asNumber(op.packingSpeed);
      if (playing !== undefined) useCrystalStore.setState({ packingPlaying: playing });
      if (speed !== undefined && [0.5, 1, 2].includes(speed)) {
        useCrystalStore.getState().setPackingSpeed(speed);
      } else if (speed !== undefined) {
        warnings.push('播放速度仅支持 0.5、1、2。');
      }
      useCrystalStore.getState().setActiveTab('packing');
      return playing !== undefined || speed !== undefined;
    }
    case 'setVoids': {
      const showVoids = asBoolean(op.showVoids);
      const voidType = asString(op.voidType);
      const patch: Partial<ReturnType<typeof useCrystalStore.getState>> = {};
      if (showVoids !== undefined) patch.showVoids = showVoids;
      if (voidType !== undefined) {
        if (!VOID_TYPES.has(voidType)) {
          warnings.push(`无效空隙类型: ${voidType}`);
          return false;
        }
        patch.voidType = voidType as 'tetrahedral' | 'octahedral' | 'all';
        patch.showVoids = true;
      }
      if (Object.keys(patch).length === 0) {
        warnings.push('setVoids 需要 showVoids 或 voidType。');
        return false;
      }
      useCrystalStore.setState(patch);
      useCrystalStore.getState().setActiveTab('packing');
      return true;
    }
    case 'loadCrystalPreset': {
      const presetId = asString(op.presetId) ?? asString(op.id);
      if (!presetId) {
        warnings.push('loadCrystalPreset 需要 presetId。');
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

export function applyChem05Operations(operations: unknown): ApplyOperationsResult {
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
