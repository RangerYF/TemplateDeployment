import { CRYSTAL_CATEGORIES } from '@/data/crystalCategories';
import { CRYSTAL_STRUCTURES, getCrystalById } from '@/data/crystalRepository';
import { PACKING_DATA } from '@/data/packingData';
import { BOND_COLORS } from '@/engine/types';
import { useCrystalStore } from '@/store/crystalStore';
import { useUIStore } from '@/store/uiStore';

function summarizeCrystal(id: string | null) {
  if (!id) return null;
  const crystal = getCrystalById(id);
  if (!crystal) return null;

  return {
    id: crystal.id,
    name: crystal.name,
    formula: crystal.formula,
    category: crystal.category,
    gradeLevel: crystal.gradeLevel,
    structureType: crystal.structureType,
    crystalSystem: crystal.crystalSystem,
    spaceGroup: crystal.spaceGroup,
    spaceGroupNumber: crystal.spaceGroupNumber,
    lattice: crystal.lattice,
    z: crystal.z,
    coordinationNumber: crystal.coordinationNumber,
    coordinationGeometry: crystal.coordinationGeometry,
    packingType: crystal.packingType,
    packingEfficiency: crystal.packingEfficiency,
    hybridization: crystal.hybridization,
    bondGeneration: crystal.bondGeneration,
    fallbackBondType: crystal.fallbackBondType,
    atomSites: crystal.atomSites.map((site, index) => ({
      index,
      element: site.element,
      label: site.label ?? site.element,
      charge: site.charge,
      fracCoords: site.fracCoords,
    })),
    bondTypes: [...new Set(crystal.bonds.map((bond) => bond.bondType))],
    bondCount: crystal.bonds.length,
    polyhedra: crystal.polyhedra?.map((polyhedron) => ({
      centerSiteIndex: polyhedron.centerSiteIndex,
      label: polyhedron.label,
      polyhedronType: polyhedron.polyhedronType,
      neighborCutoff: polyhedron.neighborCutoff,
    })),
    teachingPoints: crystal.teachingPoints,
  };
}

export function getChem05AiContext() {
  const crystal = useCrystalStore.getState();
  const ui = useUIStore.getState();

  return {
    templateKey: 'chem05',
    aiLevel: 'L2',
    title: '晶体结构查看器',
    activeCrystal: summarizeCrystal(crystal.selectedCrystalId),
    view: {
      activeTab: crystal.activeTab,
      renderMode: crystal.renderMode,
      expansionRange: crystal.expansionRange,
      showUnitCell: crystal.showUnitCell,
      showBonds: crystal.showBonds,
      showLabels: crystal.showLabels,
      showAxes: crystal.showAxes,
      visibleBondTypes: [...crystal.visibleBondTypes],
      highlightedAtomIdx: crystal.highlightedAtomIdx,
      highlightedNeighbors: crystal.highlightedNeighbors,
    },
    packing: {
      packingType: crystal.packingType,
      packingStep: crystal.packingStep,
      packingMaxSteps: crystal.packingMaxSteps,
      packingPlaying: crystal.packingPlaying,
      packingSpeed: crystal.packingSpeed,
      showVoids: crystal.showVoids,
      voidType: crystal.voidType,
      options: PACKING_DATA.map((item) => ({
        type: item.type,
        nameCn: item.nameCn,
        layerSequence: item.layerSequence,
        coordinationNumber: item.coordinationNumber,
        packingEfficiency: item.packingEfficiency,
        examples: item.examples,
      })),
    },
    panels: {
      showTeachingPoints: ui.showTeachingPoints,
      showInfoPanel: ui.showInfoPanel,
    },
    options: {
      renderModes: ['ballAndStick', 'spaceFilling', 'polyhedral', 'wireframe'],
      tabs: ['crystal', 'packing'],
      packingTypes: ['SC', 'BCC', 'FCC', 'HCP'],
      voidTypes: ['tetrahedral', 'octahedral', 'all'],
      bondTypes: Object.entries(BOND_COLORS).map(([value, meta]) => ({
        value,
        label: meta.label,
      })),
      categories: CRYSTAL_CATEGORIES.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    },
    crystalLibrary: CRYSTAL_STRUCTURES.map((item) => ({
      id: item.id,
      name: item.name,
      formula: item.formula,
      category: item.category,
      gradeLevel: item.gradeLevel,
      structureType: item.structureType,
      crystalSystem: item.crystalSystem,
      spaceGroup: item.spaceGroup,
      coordinationNumber: item.coordinationNumber,
      coordinationGeometry: item.coordinationGeometry,
      packingType: item.packingType,
      atomSiteCount: item.atomSites.length,
      bondTypes: [...new Set(item.bonds.map((bond) => bond.bondType))],
    })),
    resultInterpretationHints: [
      '晶体结构、配位数、键长、堆积效率、空隙信息和教学要点来自 C05 数据或引擎计算。',
      'AI 应通过 operations 控制晶体选择、渲染、扩胞、键类型筛选、原子高亮和堆积演示，不要直接手写 crystal/ui 状态树。',
      '选择晶体必须来自 crystalLibrary；高亮原子必须使用 activeCrystal.atomSites 中存在的 index、element 或 label。',
      '晶胞扩展范围应保持较小，避免生成过大的 3D 场景。',
    ],
  };
}
