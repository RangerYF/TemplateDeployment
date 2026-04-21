/**
 * 分子状态管理（异步 SDF 加载版）
 * 管理当前选中分子、对比分子、搜索过滤、SDF 导入
 */

import { create } from 'zustand';
import {
  ALL_MOLECULES, type MoleculeMetadata, type MoleculeCategory,
} from '@/data/moleculeMetadata';
import { buildMoleculeModelFromSdf, buildImportedMoleculeModel } from '@/engine/moleculeBuilder';
import { buildMoleculeModelLegacy } from '@/engine/legacyBuilder';
import { getFallbackMoleculeData } from '@/data/moleculeFallbacks';
import { SDF_DATA } from '@/data/sdfData';
import { parseSdf } from '@/engine/sdfParser';
import type { MoleculeModel } from '@/engine/types';

/** 从 SDF 解析结果推导分子式 */
function deriveFormula(elements: string[]): string {
  const counts = new Map<string, number>();
  for (const el of elements) {
    counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  // Hill order: C first, H second, rest alphabetical
  const keys = [...counts.keys()].sort((a, b) => {
    if (a === 'C') return -1;
    if (b === 'C') return 1;
    if (a === 'H') return -1;
    if (b === 'H') return 1;
    return a.localeCompare(b);
  });
  return keys.map(k => {
    const n = counts.get(k)!;
    return n === 1 ? k : `${k}${n}`;
  }).join('');
}

/** 导入分子的元数据 + 模型 */
export interface ImportedMolecule {
  meta: MoleculeMetadata;
  model: MoleculeModel;
}

export interface MoleculeStoreSnapshot {
  currentMoleculeId: string | null;
  compareMoleculeId: string | null;
  compareMode: boolean;
  searchQuery: string;
  levelFilter: string;
  categoryFilter: MoleculeCategory | 'all';
  selectedAtomIndices: number[];
  hoveredAtomIndex: number | null;
  importedMolecules: ImportedMolecule[];
}

interface MoleculeState {
  // 当前分子
  currentMolecule: MoleculeMetadata | null;
  currentModel: MoleculeModel | null;

  // 对比分子
  compareMolecule: MoleculeMetadata | null;
  compareModel: MoleculeModel | null;
  compareMode: boolean;

  // 异步状态
  loading: boolean;
  error: string | null;

  // 搜索过滤
  searchQuery: string;
  levelFilter: string;
  categoryFilter: MoleculeCategory | 'all';

  // 选中的原子
  selectedAtomIndices: number[];
  hoveredAtomIndex: number | null;

  // 导入分子列表
  importedMolecules: ImportedMolecule[];
  importDialogFile: File | null;   // 待导入文件（用于显示导入对话框）
  importParsedFormula: string;      // SDF 自动推导的分子式

  // Actions
  selectMolecule: (id: string) => void;
  setCompareMolecule: (id: string | null) => void;
  toggleCompareMode: () => void;
  setSearchQuery: (query: string) => void;
  setLevelFilter: (level: string) => void;
  setCategoryFilter: (cat: MoleculeCategory | 'all') => void;
  toggleAtomSelection: (index: number) => void;
  clearAtomSelection: () => void;
  setHoveredAtom: (index: number | null) => void;
  // 导入流程
  importSdfFile: (file: File) => Promise<void>;
  confirmImport: (nameCn: string, nameEn: string) => void;
  cancelImport: () => void;
  removeImported: (id: string) => void;
  updateImportedMeta: (id: string, patch: Partial<MoleculeMetadata>) => void;
  getSnapshot: () => MoleculeStoreSnapshot;
  loadSnapshot: (snapshot: MoleculeStoreSnapshot) => void;
}

function getSdfText(id: string): string | null {
  return SDF_DATA[id] ?? null;
}

function buildModel(meta: MoleculeMetadata): MoleculeModel {
  if (meta.hasSdf) {
    const sdfText = getSdfText(meta.id);
    if (sdfText) {
      return buildMoleculeModelFromSdf(sdfText, meta);
    }
  }
  // Fallback: 使用旧算法
  const fallbackData = getFallbackMoleculeData(meta.id, meta);
  if (fallbackData) {
    return buildMoleculeModelLegacy(fallbackData);
  }
  throw new Error(`无法构建分子模型: ${meta.id}`);
}

function findMoleculeById(
  id: string | null,
  importedMolecules: ImportedMolecule[],
): { meta: MoleculeMetadata; model: MoleculeModel } | null {
  if (!id) return null;
  const builtin = ALL_MOLECULES.find((m) => m.id === id);
  if (builtin) {
    return {
      meta: builtin,
      model: buildModel(builtin),
    };
  }
  const imported = importedMolecules.find((item) => item.meta.id === id);
  if (imported) {
    return imported;
  }
  return null;
}

let importCounter = 0;

export const useMoleculeStore = create<MoleculeState>((set, get) => ({
  currentMolecule: null,
  currentModel: null,
  compareMolecule: null,
  compareModel: null,
  compareMode: false,
  loading: false,
  error: null,
  searchQuery: '',
  levelFilter: '全部',
  categoryFilter: 'all',
  selectedAtomIndices: [],
  hoveredAtomIndex: null,
  importedMolecules: [],
  importDialogFile: null,
  importParsedFormula: '',

  selectMolecule: (id) => {
    // 先查内置分子
    const mol = ALL_MOLECULES.find(m => m.id === id);
    if (mol) {
      try {
        const model = buildModel(mol);
        set({ currentMolecule: mol, currentModel: model, error: null, selectedAtomIndices: [] });
      } catch (err) {
        set({ currentMolecule: mol, currentModel: null, error: (err as Error).message });
      }
      return;
    }
    // 再查导入分子
    const imported = get().importedMolecules.find(im => im.meta.id === id);
    if (imported) {
      set({ currentMolecule: imported.meta, currentModel: imported.model, error: null, selectedAtomIndices: [] });
    }
  },

  setCompareMolecule: (id) => {
    if (!id) {
      set({ compareMolecule: null, compareModel: null });
      return;
    }
    const mol = ALL_MOLECULES.find(m => m.id === id);
    if (mol) {
      try {
        const model = buildModel(mol);
        set({ compareMolecule: mol, compareModel: model, error: null });
      } catch (err) {
        set({ error: (err as Error).message });
      }
      return;
    }
    const imported = get().importedMolecules.find(im => im.meta.id === id);
    if (imported) {
      set({ compareMolecule: imported.meta, compareModel: imported.model, error: null });
    }
  },

  toggleCompareMode: () => set((s) => ({
    compareMode: !s.compareMode,
    compareMolecule: s.compareMode ? null : s.compareMolecule,
    compareModel: s.compareMode ? null : s.compareModel,
  })),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setLevelFilter: (level) => set({ levelFilter: level }),
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),

  toggleAtomSelection: (index) => set((s) => {
    const selected = s.selectedAtomIndices;
    // 取消选中
    if (selected.includes(index)) {
      return { selectedAtomIndices: selected.filter(i => i !== index) };
    }
    const model = s.currentModel;
    if (!model) return s;

    // 检查是否与已选原子相邻（有键连接）
    const isBonded = (a: number, b: number) =>
      model.bonds.some(bond =>
        (bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)
      );

    if (selected.length === 0) {
      // 第1个原子：任意选
      return { selectedAtomIndices: [index] };
    }
    if (selected.length === 1) {
      // 第2个原子：必须与第1个有键
      if (!isBonded(selected[0], index)) return s;
      return { selectedAtomIndices: [...selected, index] };
    }
    if (selected.length === 2) {
      // 第3个原子：必须与第2个有键（形成 A-B-C，B 为中心原子）
      if (!isBonded(selected[1], index)) return s;
      return { selectedAtomIndices: [...selected, index] };
    }
    // 已有3个，替换：清空后选新的
    return { selectedAtomIndices: [index] };
  }),

  clearAtomSelection: () => set({ selectedAtomIndices: [] }),
  setHoveredAtom: (index) => set({ hoveredAtomIndex: index }),

  // 导入流程第一步：解析文件，显示导入对话框
  importSdfFile: async (file) => {
    set({ loading: true, error: null });
    try {
      const text = await file.text();
      // 预解析以推导分子式
      const sdf = parseSdf(text);
      const formula = deriveFormula(sdf.atoms.map(a => a.element));
      set({
        importDialogFile: file,
        importParsedFormula: formula,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false, importDialogFile: null });
    }
  },

  // 导入流程第二步：用户输入名称后确认
  confirmImport: (nameCn, nameEn) => {
    const { importDialogFile, importParsedFormula } = get();
    if (!importDialogFile) return;

    // 同步读取（文件已经被 importSdfFile 验证过）
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const model = buildImportedMoleculeModel(text);
        importCounter++;
        const id = `IMP-${String(importCounter).padStart(3, '0')}`;
        const meta: MoleculeMetadata = {
          id,
          name_cn: nameCn || '导入分子',
          name_en: nameEn || 'Imported',
          formula: importParsedFormula,
          level: '',
          category: 'polyatomic',
          subcategory: 'organic',
          sdfFile: '',
          hasSdf: true,
        };
        set((s) => ({
          importedMolecules: [...s.importedMolecules, { meta, model }],
          importDialogFile: null,
          importParsedFormula: '',
          currentMolecule: meta,
          currentModel: model,
          selectedAtomIndices: [],
          error: null,
        }));
      } catch (err) {
        set({ error: (err as Error).message, importDialogFile: null, importParsedFormula: '' });
      }
    };
    reader.readAsText(importDialogFile);
  },

  cancelImport: () => set({ importDialogFile: null, importParsedFormula: '', error: null }),

  removeImported: (id) => set((s) => {
    const next = s.importedMolecules.filter(im => im.meta.id !== id);
    const isCurrent = s.currentMolecule?.id === id;
    return {
      importedMolecules: next,
      ...(isCurrent ? { currentMolecule: null, currentModel: null } : {}),
    };
  }),

  updateImportedMeta: (id, patch) => set((s) => {
    const idx = s.importedMolecules.findIndex(im => im.meta.id === id);
    if (idx < 0) return s;
    const updated = [...s.importedMolecules];
    updated[idx] = { ...updated[idx], meta: { ...updated[idx].meta, ...patch } };
    // 如果当前正在查看这个分子，也更新 currentMolecule
    const isCurrent = s.currentMolecule?.id === id;
    return {
      importedMolecules: updated,
      ...(isCurrent ? { currentMolecule: updated[idx].meta } : {}),
    };
  }),

  getSnapshot: () => {
    const state = get();
    return {
      currentMoleculeId: state.currentMolecule?.id ?? null,
      compareMoleculeId: state.compareMolecule?.id ?? null,
      compareMode: state.compareMode,
      searchQuery: state.searchQuery,
      levelFilter: state.levelFilter,
      categoryFilter: state.categoryFilter,
      selectedAtomIndices: [...state.selectedAtomIndices],
      hoveredAtomIndex: state.hoveredAtomIndex,
      importedMolecules: JSON.parse(JSON.stringify(state.importedMolecules)) as ImportedMolecule[],
    };
  },

  loadSnapshot: (snapshot) => {
    const importedMolecules = JSON.parse(JSON.stringify(snapshot.importedMolecules ?? [])) as ImportedMolecule[];
    let currentMolecule: MoleculeMetadata | null = null;
    let currentModel: MoleculeModel | null = null;
    let compareMolecule: MoleculeMetadata | null = null;
    let compareModel: MoleculeModel | null = null;
    let error: string | null = null;

    try {
      const current = findMoleculeById(snapshot.currentMoleculeId, importedMolecules);
      currentMolecule = current?.meta ?? null;
      currentModel = current?.model ?? null;

      const compare = findMoleculeById(snapshot.compareMoleculeId, importedMolecules);
      compareMolecule = compare?.meta ?? null;
      compareModel = compare?.model ?? null;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    set({
      currentMolecule,
      currentModel,
      compareMolecule,
      compareModel,
      compareMode: snapshot.compareMode ?? false,
      loading: false,
      error,
      searchQuery: snapshot.searchQuery ?? '',
      levelFilter: snapshot.levelFilter ?? '全部',
      categoryFilter: snapshot.categoryFilter ?? 'all',
      selectedAtomIndices: snapshot.selectedAtomIndices ? [...snapshot.selectedAtomIndices] : [],
      hoveredAtomIndex: snapshot.hoveredAtomIndex ?? null,
      importedMolecules,
      importDialogFile: null,
      importParsedFormula: '',
    });
  },
}));

/** 过滤后的分子列表（含导入分子） */
export function getFilteredMolecules(
  searchQuery: string,
  levelFilter: string,
  categoryFilter: MoleculeCategory | 'all',
  importedMolecules: ImportedMolecule[] = [],
): MoleculeMetadata[] {
  // 合并内置 + 导入
  let result: MoleculeMetadata[] = [
    ...ALL_MOLECULES,
    ...importedMolecules.map(im => im.meta),
  ];

  if (levelFilter !== '全部') {
    result = result.filter(m => m.level === levelFilter || m.level === '');
  }

  if (categoryFilter !== 'all') {
    result = result.filter(m => m.category === categoryFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter(m =>
      m.name_cn.includes(q) ||
      m.name_en.toLowerCase().includes(q) ||
      m.formula.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  }

  return result;
}
