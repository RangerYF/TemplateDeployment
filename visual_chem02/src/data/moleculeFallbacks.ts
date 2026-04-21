/**
 * 无 SDF 数据分子的原子/键定义（离子等）
 * 仅在 hasSdf: false 时使用，由 legacyBuilder 消费
 */

import type { MoleculeData } from './molecules';

type FallbackData = Pick<MoleculeData, 'id' | 'atoms' | 'bonds' | 'category' | 'bond_pairs' | 'lone_pairs' | 'central_atom' | 'bond_angles'>;

const FALLBACKS: FallbackData[] = [
  // ---- PubChem 无 3D 数据的小分子 ----
  {
    id: 'MOL-001',
    category: 'diatomic',
    atoms: [{ element: 'H' }, { element: 'H' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 74 }],
  },
  {
    id: 'MOL-010',
    category: 'diatomic',
    atoms: [{ element: 'N' }, { element: 'O' }],
    bonds: [{ from: 0, to: 1, order: 2, type: 'double', length: 115 }],
  },
  {
    id: 'MOL-011',
    category: 'diatomic',
    atoms: [{ element: 'F' }, { element: 'F' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 142 }],
  },
  {
    id: 'MOL-015',
    central_atom: 'N', bond_pairs: 2, lone_pairs: 0,
    category: 'triatomic',
    bond_angles: { 'O-N-O': 134 },
    atoms: [{ element: 'N' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 120 },
      { from: 0, to: 2, order: 2, type: 'double', length: 120 },
    ],
  },
  {
    id: 'MOL-022',
    central_atom: 'B', bond_pairs: 3, lone_pairs: 0,
    category: 'tetratomic',
    bond_angles: { 'F-B-F': 120 },
    atoms: [{ element: 'B' }, { element: 'F' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 131 },
      { from: 0, to: 2, order: 1, type: 'single', length: 131 },
      { from: 0, to: 3, order: 1, type: 'single', length: 131 },
    ],
  },
  {
    id: 'MOL-023',
    central_atom: 'B', bond_pairs: 3, lone_pairs: 0,
    category: 'tetratomic',
    bond_angles: { 'Cl-B-Cl': 120 },
    atoms: [{ element: 'B' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 175 },
      { from: 0, to: 2, order: 1, type: 'single', length: 175 },
      { from: 0, to: 3, order: 1, type: 'single', length: 175 },
    ],
  },
  {
    id: 'MOL-025',
    central_atom: 'Al', bond_pairs: 3, lone_pairs: 0,
    category: 'tetratomic',
    bond_angles: { 'Cl-Al-Cl': 120 },
    atoms: [{ element: 'Al' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 206 },
      { from: 0, to: 2, order: 1, type: 'single', length: 206 },
      { from: 0, to: 3, order: 1, type: 'single', length: 206 },
    ],
  },
  {
    id: 'MOL-031',
    central_atom: 'P', bond_pairs: 5, lone_pairs: 0,
    category: 'polyatomic',
    atoms: [{ element: 'P' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 214 },
      { from: 0, to: 2, order: 1, type: 'single', length: 214 },
      { from: 0, to: 3, order: 1, type: 'single', length: 202 },
      { from: 0, to: 4, order: 1, type: 'single', length: 202 },
      { from: 0, to: 5, order: 1, type: 'single', length: 202 },
    ],
  },
  {
    id: 'MOL-032',
    central_atom: 'S', bond_pairs: 6, lone_pairs: 0,
    category: 'polyatomic',
    atoms: [{ element: 'S' }, { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 156 },
      { from: 0, to: 2, order: 1, type: 'single', length: 156 },
      { from: 0, to: 3, order: 1, type: 'single', length: 156 },
      { from: 0, to: 4, order: 1, type: 'single', length: 156 },
      { from: 0, to: 5, order: 1, type: 'single', length: 156 },
      { from: 0, to: 6, order: 1, type: 'single', length: 156 },
    ],
  },
  {
    id: 'MOL-035',
    central_atom: 'Xe', bond_pairs: 4, lone_pairs: 2,
    category: 'polyatomic',
    atoms: [{ element: 'Xe' }, { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 195 },
      { from: 0, to: 2, order: 1, type: 'single', length: 195 },
      { from: 0, to: 3, order: 1, type: 'single', length: 195 },
      { from: 0, to: 4, order: 1, type: 'single', length: 195 },
    ],
  },
  {
    id: 'MOL-033',
    central_atom: 'I', bond_pairs: 5, lone_pairs: 1,
    category: 'polyatomic',
    atoms: [{ element: 'I' }, { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 187 },
      { from: 0, to: 2, order: 1, type: 'single', length: 187 },
      { from: 0, to: 3, order: 1, type: 'single', length: 187 },
      { from: 0, to: 4, order: 1, type: 'single', length: 187 },
      { from: 0, to: 5, order: 1, type: 'single', length: 187 },
    ],
  },
  {
    id: 'MOL-034',
    central_atom: 'Xe', bond_pairs: 2, lone_pairs: 3,
    category: 'polyatomic',
    atoms: [{ element: 'Xe' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 200 },
      { from: 0, to: 2, order: 1, type: 'single', length: 200 },
    ],
  },
  // ---- 离子 ----
  {
    id: 'MOL-030',
    central_atom: 'N', bond_pairs: 4, lone_pairs: 0,
    category: 'pentatomic',
    bond_angles: { 'H-N-H': 109.5 },
    atoms: [{ element: 'N' }, { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 103 },
      { from: 0, to: 2, order: 1, type: 'single', length: 103 },
      { from: 0, to: 3, order: 1, type: 'single', length: 103 },
      { from: 0, to: 4, order: 1, type: 'single', length: 103 },
    ],
  },
  {
    id: 'MOL-036',
    central_atom: 'C', bond_pairs: 3, lone_pairs: 0,
    category: 'ion',
    bond_angles: { 'O-C-O': 120 },
    atoms: [{ element: 'C' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 129 },
      { from: 0, to: 2, order: 1, type: 'single', length: 129 },
      { from: 0, to: 3, order: 1, type: 'single', length: 129 },
    ],
  },
  {
    id: 'MOL-037',
    central_atom: 'S', bond_pairs: 4, lone_pairs: 0,
    category: 'ion',
    bond_angles: { 'O-S-O': 109.5 },
    atoms: [{ element: 'S' }, { element: 'O' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 149 },
      { from: 0, to: 2, order: 2, type: 'double', length: 149 },
      { from: 0, to: 3, order: 1, type: 'single', length: 149 },
      { from: 0, to: 4, order: 1, type: 'single', length: 149 },
    ],
  },
  {
    id: 'MOL-038',
    central_atom: 'N', bond_pairs: 3, lone_pairs: 0,
    category: 'ion',
    bond_angles: { 'O-N-O': 120 },
    atoms: [{ element: 'N' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 126 },
      { from: 0, to: 2, order: 1, type: 'single', length: 126 },
      { from: 0, to: 3, order: 1, type: 'single', length: 126 },
    ],
  },
  {
    id: 'MOL-039',
    central_atom: 'Cl', bond_pairs: 4, lone_pairs: 0,
    category: 'ion',
    bond_angles: { 'O-Cl-O': 109.5 },
    atoms: [{ element: 'Cl' }, { element: 'O' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 144 },
      { from: 0, to: 2, order: 2, type: 'double', length: 144 },
      { from: 0, to: 3, order: 1, type: 'single', length: 144 },
      { from: 0, to: 4, order: 1, type: 'single', length: 144 },
    ],
  },
  {
    id: 'MOL-040',
    central_atom: 'P', bond_pairs: 4, lone_pairs: 0,
    category: 'ion',
    bond_angles: { 'O-P-O': 109.5 },
    atoms: [{ element: 'P' }, { element: 'O' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 154 },
      { from: 0, to: 2, order: 1, type: 'single', length: 154 },
      { from: 0, to: 3, order: 1, type: 'single', length: 154 },
      { from: 0, to: 4, order: 1, type: 'single', length: 154 },
    ],
  },
  {
    id: 'MOL-041',
    central_atom: 'Mn', bond_pairs: 4, lone_pairs: 0,
    category: 'ion',
    bond_angles: { 'O-Mn-O': 109.5 },
    atoms: [{ element: 'Mn' }, { element: 'O' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 163 },
      { from: 0, to: 2, order: 2, type: 'double', length: 163 },
      { from: 0, to: 3, order: 1, type: 'single', length: 163 },
      { from: 0, to: 4, order: 1, type: 'single', length: 163 },
    ],
  },
  {
    id: 'MOL-042',
    category: 'ion',
    atoms: [{ element: 'O' }, { element: 'H' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 96 }],
  },
];

export const FALLBACK_MAP = new Map<string, FallbackData>(
  FALLBACKS.map(f => [f.id, f])
);

/** 获取 fallback 数据并包装为完整 MoleculeData */
export function getFallbackMoleculeData(id: string, meta: { name_cn: string; name_en: string; formula: string; level: string; category: string; subcategory: string; vsepr?: string; geometry?: string; hybridization?: string; polarity?: string; features?: string; functional_group?: string }): MoleculeData | null {
  const fb = FALLBACK_MAP.get(id);
  if (!fb) return null;
  return {
    ...meta,
    ...fb,
    id,
    name_cn: meta.name_cn,
    name_en: meta.name_en,
    formula: meta.formula,
    level: meta.level,
    category: fb.category,
    subcategory: meta.subcategory as 'inorganic' | 'organic',
  } as MoleculeData;
}
