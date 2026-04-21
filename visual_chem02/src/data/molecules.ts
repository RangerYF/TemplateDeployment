/**
 * 分子库数据 — 71 个分子
 * 数据来源：C-02 分子结构查看器 — 分子库数据.md
 */

import type { BondType } from './bondTypes';

export interface AtomDef {
  element: string;
  label?: string;  // 如 "C1", "O2"
}

export interface BondDef {
  from: number;    // 原子索引
  to: number;
  order: number;   // 1, 2, 3
  type: BondType;
  length: number;  // pm
}

export type MoleculeCategory =
  | 'diatomic' | 'triatomic' | 'tetratomic' | 'pentatomic'
  | 'polyatomic' | 'ion'
  | 'alkane' | 'alkene' | 'alkyne' | 'aromatic'
  | 'alcohol_aldehyde_acid_ester' | 'nitrogen_organic' | 'polymer_monomer';

export interface MoleculeData {
  id: string;
  name_cn: string;
  name_en: string;
  formula: string;
  level: string;
  category: MoleculeCategory;
  subcategory: 'inorganic' | 'organic';
  vsepr?: string;
  geometry?: string;
  central_atom?: string;
  bond_pairs?: number;
  lone_pairs?: number;
  bond_angles?: Record<string, number>;
  polarity?: string;
  hybridization?: string;
  functional_group?: string;
  features?: string;
  charge?: number;
  atoms: AtomDef[];
  bonds: BondDef[];
}

// ============ 无机分子 ============

const diatomicMolecules: MoleculeData[] = [
  {
    id: 'MOL-001', name_cn: '氢气', name_en: 'Hydrogen', formula: 'H₂',
    level: '初中', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '非极性',
    atoms: [{ element: 'H' }, { element: 'H' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 74 }],
  },
  {
    id: 'MOL-002', name_cn: '氧气', name_en: 'Oxygen', formula: 'O₂',
    level: '初中', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '非极性',
    atoms: [{ element: 'O' }, { element: 'O' }],
    bonds: [{ from: 0, to: 1, order: 2, type: 'double', length: 121 }],
  },
  {
    id: 'MOL-003', name_cn: '氮气', name_en: 'Nitrogen', formula: 'N₂',
    level: '初中', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '非极性',
    atoms: [{ element: 'N' }, { element: 'N' }],
    bonds: [{ from: 0, to: 1, order: 3, type: 'triple', length: 110 }],
  },
  {
    id: 'MOL-004', name_cn: '氯气', name_en: 'Chlorine', formula: 'Cl₂',
    level: '高中必修', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '非极性',
    atoms: [{ element: 'Cl' }, { element: 'Cl' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 199 }],
  },
  {
    id: 'MOL-005', name_cn: '氯化氢', name_en: 'Hydrogen chloride', formula: 'HCl',
    level: '高中必修', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '极性',
    atoms: [{ element: 'H' }, { element: 'Cl' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 127 }],
  },
  {
    id: 'MOL-006', name_cn: '氟化氢', name_en: 'Hydrogen fluoride', formula: 'HF',
    level: '高中必修', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '极性',
    atoms: [{ element: 'H' }, { element: 'F' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 92 }],
  },
  {
    id: 'MOL-007', name_cn: '溴化氢', name_en: 'Hydrogen bromide', formula: 'HBr',
    level: '高中选修', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '极性',
    atoms: [{ element: 'H' }, { element: 'Br' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 141 }],
  },
  {
    id: 'MOL-008', name_cn: '碘化氢', name_en: 'Hydrogen iodide', formula: 'HI',
    level: '高中选修', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '极性',
    atoms: [{ element: 'H' }, { element: 'I' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 161 }],
  },
  {
    id: 'MOL-009', name_cn: '一氧化碳', name_en: 'Carbon monoxide', formula: 'CO',
    level: '高中必修', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '极性',
    atoms: [{ element: 'C' }, { element: 'O' }],
    bonds: [{ from: 0, to: 1, order: 3, type: 'triple', length: 113 }],
  },
  {
    id: 'MOL-010', name_cn: '一氧化氮', name_en: 'Nitric oxide', formula: 'NO',
    level: '高中选修', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '极性',
    atoms: [{ element: 'N' }, { element: 'O' }],
    bonds: [{ from: 0, to: 1, order: 2, type: 'double', length: 115 }],
  },
  {
    id: 'MOL-011', name_cn: '氟气', name_en: 'Fluorine', formula: 'F₂',
    level: '高中选修', category: 'diatomic', subcategory: 'inorganic',
    geometry: '直线形', polarity: '非极性',
    atoms: [{ element: 'F' }, { element: 'F' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 142 }],
  },
];

const triatomicMolecules: MoleculeData[] = [
  {
    id: 'MOL-012', name_cn: '水', name_en: 'Water', formula: 'H₂O',
    level: '初中', category: 'triatomic', subcategory: 'inorganic',
    vsepr: 'AX2E2', geometry: 'V形', central_atom: 'O',
    bond_pairs: 2, lone_pairs: 2, hybridization: 'sp³',
    bond_angles: { 'H-O-H': 104.5 }, polarity: '极性',
    atoms: [{ element: 'O' }, { element: 'H' }, { element: 'H' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 96 },
      { from: 0, to: 2, order: 1, type: 'single', length: 96 },
    ],
  },
  {
    id: 'MOL-013', name_cn: '二氧化碳', name_en: 'Carbon dioxide', formula: 'CO₂',
    level: '初中', category: 'triatomic', subcategory: 'inorganic',
    vsepr: 'AX2', geometry: '直线形', central_atom: 'C',
    bond_pairs: 2, lone_pairs: 0, hybridization: 'sp',
    bond_angles: { 'O=C=O': 180 }, polarity: '非极性',
    atoms: [{ element: 'C' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 116 },
      { from: 0, to: 2, order: 2, type: 'double', length: 116 },
    ],
  },
  {
    id: 'MOL-014', name_cn: '二氧化硫', name_en: 'Sulfur dioxide', formula: 'SO₂',
    level: '高中必修', category: 'triatomic', subcategory: 'inorganic',
    vsepr: 'AX2E', geometry: 'V形', central_atom: 'S',
    bond_pairs: 2, lone_pairs: 1, hybridization: 'sp²',
    bond_angles: { 'O=S=O': 119 }, polarity: '极性',
    atoms: [{ element: 'S' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 143 },
      { from: 0, to: 2, order: 2, type: 'double', length: 143 },
    ],
  },
  {
    id: 'MOL-015', name_cn: '二氧化氮', name_en: 'Nitrogen dioxide', formula: 'NO₂',
    level: '高中选修', category: 'triatomic', subcategory: 'inorganic',
    vsepr: 'AX2E', geometry: 'V形', central_atom: 'N',
    bond_pairs: 2, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'O-N-O': 134 }, polarity: '极性',
    features: '含单电子',
    atoms: [{ element: 'N' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 120 },
      { from: 0, to: 2, order: 2, type: 'double', length: 120 },
    ],
  },
  {
    id: 'MOL-016', name_cn: '硫化氢', name_en: 'Hydrogen sulfide', formula: 'H₂S',
    level: '高中必修', category: 'triatomic', subcategory: 'inorganic',
    vsepr: 'AX2E2', geometry: 'V形', central_atom: 'S',
    bond_pairs: 2, lone_pairs: 2, hybridization: 'sp³',
    bond_angles: { 'H-S-H': 92 }, polarity: '极性',
    atoms: [{ element: 'S' }, { element: 'H' }, { element: 'H' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 134 },
      { from: 0, to: 2, order: 1, type: 'single', length: 134 },
    ],
  },
  {
    id: 'MOL-017', name_cn: '二硫化碳', name_en: 'Carbon disulfide', formula: 'CS₂',
    level: '高中选修', category: 'triatomic', subcategory: 'inorganic',
    vsepr: 'AX2', geometry: '直线形', central_atom: 'C',
    bond_pairs: 2, lone_pairs: 0, hybridization: 'sp',
    bond_angles: { 'S=C=S': 180 }, polarity: '非极性',
    atoms: [{ element: 'C' }, { element: 'S' }, { element: 'S' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 155 },
      { from: 0, to: 2, order: 2, type: 'double', length: 155 },
    ],
  },
  {
    id: 'MOL-018', name_cn: '臭氧', name_en: 'Ozone', formula: 'O₃',
    level: '高中选修', category: 'triatomic', subcategory: 'inorganic',
    vsepr: 'AX2E', geometry: 'V形', central_atom: 'O',
    bond_pairs: 2, lone_pairs: 1, hybridization: 'sp²',
    bond_angles: { 'O-O-O': 117 }, polarity: '极性',
    atoms: [{ element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 128 },
      { from: 0, to: 2, order: 2, type: 'double', length: 128 },
    ],
  },
];

const tetratomicMolecules: MoleculeData[] = [
  {
    id: 'MOL-019', name_cn: '氨', name_en: 'Ammonia', formula: 'NH₃',
    level: '高中必修', category: 'tetratomic', subcategory: 'inorganic',
    vsepr: 'AX3E', geometry: '三角锥形', central_atom: 'N',
    bond_pairs: 3, lone_pairs: 1, hybridization: 'sp³',
    bond_angles: { 'H-N-H': 107 }, polarity: '极性',
    atoms: [{ element: 'N' }, { element: 'H' }, { element: 'H' }, { element: 'H' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 101 },
      { from: 0, to: 2, order: 1, type: 'single', length: 101 },
      { from: 0, to: 3, order: 1, type: 'single', length: 101 },
    ],
  },
  {
    id: 'MOL-020', name_cn: '三氟化氮', name_en: 'Nitrogen trifluoride', formula: 'NF₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    vsepr: 'AX3E', geometry: '三角锥形', central_atom: 'N',
    bond_pairs: 3, lone_pairs: 1, hybridization: 'sp³',
    bond_angles: { 'F-N-F': 102 }, polarity: '极性',
    atoms: [{ element: 'N' }, { element: 'F' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 137 },
      { from: 0, to: 2, order: 1, type: 'single', length: 137 },
      { from: 0, to: 3, order: 1, type: 'single', length: 137 },
    ],
  },
  {
    id: 'MOL-021', name_cn: '三氯化磷', name_en: 'Phosphorus trichloride', formula: 'PCl₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    vsepr: 'AX3E', geometry: '三角锥形', central_atom: 'P',
    bond_pairs: 3, lone_pairs: 1, hybridization: 'sp³',
    bond_angles: { 'Cl-P-Cl': 100 }, polarity: '极性',
    atoms: [{ element: 'P' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 204 },
      { from: 0, to: 2, order: 1, type: 'single', length: 204 },
      { from: 0, to: 3, order: 1, type: 'single', length: 204 },
    ],
  },
  {
    id: 'MOL-022', name_cn: '三氟化硼', name_en: 'Boron trifluoride', formula: 'BF₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'B',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'F-B-F': 120 }, polarity: '非极性',
    atoms: [{ element: 'B' }, { element: 'F' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 131 },
      { from: 0, to: 2, order: 1, type: 'single', length: 131 },
      { from: 0, to: 3, order: 1, type: 'single', length: 131 },
    ],
  },
  {
    id: 'MOL-023', name_cn: '三氯化硼', name_en: 'Boron trichloride', formula: 'BCl₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'B',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'Cl-B-Cl': 120 }, polarity: '非极性',
    atoms: [{ element: 'B' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 175 },
      { from: 0, to: 2, order: 1, type: 'single', length: 175 },
      { from: 0, to: 3, order: 1, type: 'single', length: 175 },
    ],
  },
  {
    id: 'MOL-024', name_cn: '三氧化硫', name_en: 'Sulfur trioxide', formula: 'SO₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'S',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'O=S=O': 120 }, polarity: '非极性',
    atoms: [{ element: 'S' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 142 },
      { from: 0, to: 2, order: 2, type: 'double', length: 142 },
      { from: 0, to: 3, order: 2, type: 'double', length: 142 },
    ],
  },
  {
    id: 'MOL-025', name_cn: '三氯化铝', name_en: 'Aluminium chloride', formula: 'AlCl₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'Al',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'Cl-Al-Cl': 120 }, polarity: '非极性',
    atoms: [{ element: 'Al' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 206 },
      { from: 0, to: 2, order: 1, type: 'single', length: 206 },
      { from: 0, to: 3, order: 1, type: 'single', length: 206 },
    ],
  },
];

const pentatomicMolecules: MoleculeData[] = [
  {
    id: 'MOL-026', name_cn: '甲烷', name_en: 'Methane', formula: 'CH₄',
    level: '高中必修', category: 'pentatomic', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'C',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'H-C-H': 109.5 }, polarity: '非极性',
    atoms: [{ element: 'C' }, { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 109 },
      { from: 0, to: 2, order: 1, type: 'single', length: 109 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-027', name_cn: '四氯化碳', name_en: 'Carbon tetrachloride', formula: 'CCl₄',
    level: '高中必修', category: 'pentatomic', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'C',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'Cl-C-Cl': 109.5 }, polarity: '非极性',
    atoms: [{ element: 'C' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }, { element: 'Cl' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 177 },
      { from: 0, to: 2, order: 1, type: 'single', length: 177 },
      { from: 0, to: 3, order: 1, type: 'single', length: 177 },
      { from: 0, to: 4, order: 1, type: 'single', length: 177 },
    ],
  },
  {
    id: 'MOL-028', name_cn: '硅烷', name_en: 'Silane', formula: 'SiH₄',
    level: '高中选修', category: 'pentatomic', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'Si',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'H-Si-H': 109.5 }, polarity: '非极性',
    atoms: [{ element: 'Si' }, { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 148 },
      { from: 0, to: 2, order: 1, type: 'single', length: 148 },
      { from: 0, to: 3, order: 1, type: 'single', length: 148 },
      { from: 0, to: 4, order: 1, type: 'single', length: 148 },
    ],
  },
  {
    id: 'MOL-029', name_cn: '四氟化硅', name_en: 'Silicon tetrafluoride', formula: 'SiF₄',
    level: '高中选修', category: 'pentatomic', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'Si',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'F-Si-F': 109.5 }, polarity: '非极性',
    atoms: [{ element: 'Si' }, { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 155 },
      { from: 0, to: 2, order: 1, type: 'single', length: 155 },
      { from: 0, to: 3, order: 1, type: 'single', length: 155 },
      { from: 0, to: 4, order: 1, type: 'single', length: 155 },
    ],
  },
  {
    id: 'MOL-030', name_cn: '铵根离子', name_en: 'Ammonium', formula: 'NH₄⁺',
    level: '高中必修', category: 'pentatomic', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'N',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'H-N-H': 109.5 },
    atoms: [{ element: 'N' }, { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 103 },
      { from: 0, to: 2, order: 1, type: 'single', length: 103 },
      { from: 0, to: 3, order: 1, type: 'single', length: 103 },
      { from: 0, to: 4, order: 1, type: 'single', length: 103 },
    ],
  },
];

const polyatomicMolecules: MoleculeData[] = [
  {
    id: 'MOL-031', name_cn: '五氯化磷', name_en: 'Phosphorus pentachloride', formula: 'PCl₅',
    level: '高中选修', category: 'polyatomic', subcategory: 'inorganic',
    vsepr: 'AX5', geometry: '三角双锥', central_atom: 'P',
    bond_pairs: 5, lone_pairs: 0, hybridization: 'sp³d',
    polarity: '非极性',
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
    id: 'MOL-032', name_cn: '六氟化硫', name_en: 'Sulfur hexafluoride', formula: 'SF₆',
    level: '高中选修', category: 'polyatomic', subcategory: 'inorganic',
    vsepr: 'AX6', geometry: '正八面体', central_atom: 'S',
    bond_pairs: 6, lone_pairs: 0, hybridization: 'sp³d²',
    polarity: '非极性',
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
    id: 'MOL-033', name_cn: '五氟化碘', name_en: 'Iodine pentafluoride', formula: 'IF₅',
    level: '拓展', category: 'polyatomic', subcategory: 'inorganic',
    vsepr: 'AX5E', geometry: '四方锥', central_atom: 'I',
    bond_pairs: 5, lone_pairs: 1, hybridization: 'sp³d²',
    polarity: '极性',
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
    id: 'MOL-034', name_cn: '二氟化氙', name_en: 'Xenon difluoride', formula: 'XeF₂',
    level: '拓展', category: 'polyatomic', subcategory: 'inorganic',
    vsepr: 'AX2E3', geometry: '直线形', central_atom: 'Xe',
    bond_pairs: 2, lone_pairs: 3, hybridization: 'sp³d',
    polarity: '非极性',
    atoms: [{ element: 'Xe' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 200 },
      { from: 0, to: 2, order: 1, type: 'single', length: 200 },
    ],
  },
  {
    id: 'MOL-035', name_cn: '四氟化氙', name_en: 'Xenon tetrafluoride', formula: 'XeF₄',
    level: '拓展', category: 'polyatomic', subcategory: 'inorganic',
    vsepr: 'AX4E2', geometry: '平面正方形', central_atom: 'Xe',
    bond_pairs: 4, lone_pairs: 2, hybridization: 'sp³d²',
    polarity: '非极性',
    atoms: [{ element: 'Xe' }, { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 195 },
      { from: 0, to: 2, order: 1, type: 'single', length: 195 },
      { from: 0, to: 3, order: 1, type: 'single', length: 195 },
      { from: 0, to: 4, order: 1, type: 'single', length: 195 },
    ],
  },
];

const ionMolecules: MoleculeData[] = [
  {
    id: 'MOL-036', name_cn: '碳酸根', name_en: 'Carbonate', formula: 'CO₃²⁻',
    level: '高中必修', category: 'ion', subcategory: 'inorganic',
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'C',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'O-C-O': 120 },
    atoms: [{ element: 'C' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 129 },
      { from: 0, to: 2, order: 1, type: 'single', length: 129 },
      { from: 0, to: 3, order: 1, type: 'single', length: 129 },
    ],
  },
  {
    id: 'MOL-037', name_cn: '硫酸根', name_en: 'Sulfate', formula: 'SO₄²⁻',
    level: '高中必修', category: 'ion', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'S',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
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
    id: 'MOL-038', name_cn: '硝酸根', name_en: 'Nitrate', formula: 'NO₃⁻',
    level: '高中必修', category: 'ion', subcategory: 'inorganic',
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'N',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'O-N-O': 120 },
    atoms: [{ element: 'N' }, { element: 'O' }, { element: 'O' }, { element: 'O' }],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 126 },
      { from: 0, to: 2, order: 1, type: 'single', length: 126 },
      { from: 0, to: 3, order: 1, type: 'single', length: 126 },
    ],
  },
  {
    id: 'MOL-039', name_cn: '高氯酸根', name_en: 'Perchlorate', formula: 'ClO₄⁻',
    level: '高中选修', category: 'ion', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'Cl',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
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
    id: 'MOL-040', name_cn: '磷酸根', name_en: 'Phosphate', formula: 'PO₄³⁻',
    level: '高中选修', category: 'ion', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'P',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
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
    id: 'MOL-041', name_cn: '高锰酸根', name_en: 'Permanganate', formula: 'MnO₄⁻',
    level: '高中选修', category: 'ion', subcategory: 'inorganic',
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'Mn',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
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
    id: 'MOL-042', name_cn: '氢氧根', name_en: 'Hydroxide', formula: 'OH⁻',
    level: '初中', category: 'ion', subcategory: 'inorganic',
    geometry: '直线',
    atoms: [{ element: 'O' }, { element: 'H' }],
    bonds: [{ from: 0, to: 1, order: 1, type: 'single', length: 96 }],
  },
];

// ============ 有机分子 ============

const alkaneMolecules: MoleculeData[] = [
  {
    id: 'MOL-043', name_cn: '甲烷', name_en: 'Methane', formula: 'CH₄',
    level: '高中必修', category: 'alkane', subcategory: 'organic',
    hybridization: 'sp³', bond_angles: { 'H-C-H': 109.5 },
    atoms: [{ element: 'C' }, { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' }],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 109 },
      { from: 0, to: 2, order: 1, type: 'single', length: 109 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-044', name_cn: '乙烷', name_en: 'Ethane', formula: 'C₂H₆',
    level: '高中必修', category: 'alkane', subcategory: 'organic',
    hybridization: 'sp³', bond_angles: { 'H-C-H': 109.5 },
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 0, to: 2, order: 1, type: 'single', length: 109 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 1, to: 5, order: 1, type: 'single', length: 109 },
      { from: 1, to: 6, order: 1, type: 'single', length: 109 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-045', name_cn: '丙烷', name_en: 'Propane', formula: 'C₃H₈',
    level: '高中选修', category: 'alkane', subcategory: 'organic',
    hybridization: 'sp³', bond_angles: { 'C-C-C': 109.5 },
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' }, { element: 'C', label: 'C3' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 1, type: 'single', length: 154 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 1, to: 6, order: 1, type: 'single', length: 109 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
      { from: 2, to: 8, order: 1, type: 'single', length: 109 },
      { from: 2, to: 9, order: 1, type: 'single', length: 109 },
      { from: 2, to: 10, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-046', name_cn: '正丁烷', name_en: 'Butane', formula: 'C₄H₁₀',
    level: '高中选修', category: 'alkane', subcategory: 'organic',
    hybridization: 'sp³', bond_angles: { 'C-C-C': 109.5 },
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 1, type: 'single', length: 154 },
      { from: 2, to: 3, order: 1, type: 'single', length: 154 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
      { from: 1, to: 8, order: 1, type: 'single', length: 109 },
      { from: 2, to: 9, order: 1, type: 'single', length: 109 },
      { from: 2, to: 10, order: 1, type: 'single', length: 109 },
      { from: 3, to: 11, order: 1, type: 'single', length: 109 },
      { from: 3, to: 12, order: 1, type: 'single', length: 109 },
      { from: 3, to: 13, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-047', name_cn: '异丁烷', name_en: 'Isobutane', formula: 'C₄H₁₀',
    level: '高中选修', category: 'alkane', subcategory: 'organic',
    hybridization: 'sp³', features: '2-甲基丙烷',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 0, to: 2, order: 1, type: 'single', length: 154 },
      { from: 0, to: 3, order: 1, type: 'single', length: 154 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 1, to: 5, order: 1, type: 'single', length: 109 },
      { from: 1, to: 6, order: 1, type: 'single', length: 109 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
      { from: 2, to: 8, order: 1, type: 'single', length: 109 },
      { from: 2, to: 9, order: 1, type: 'single', length: 109 },
      { from: 2, to: 10, order: 1, type: 'single', length: 109 },
      { from: 3, to: 11, order: 1, type: 'single', length: 109 },
      { from: 3, to: 12, order: 1, type: 'single', length: 109 },
      { from: 3, to: 13, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-048', name_cn: '正戊烷', name_en: 'Pentane', formula: 'C₅H₁₂',
    level: '高中选修', category: 'alkane', subcategory: 'organic',
    hybridization: 'sp³',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'C', label: 'C5' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 1, type: 'single', length: 154 },
      { from: 2, to: 3, order: 1, type: 'single', length: 154 },
      { from: 3, to: 4, order: 1, type: 'single', length: 154 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
      { from: 0, to: 7, order: 1, type: 'single', length: 109 },
      { from: 1, to: 8, order: 1, type: 'single', length: 109 },
      { from: 1, to: 9, order: 1, type: 'single', length: 109 },
      { from: 2, to: 10, order: 1, type: 'single', length: 109 },
      { from: 2, to: 11, order: 1, type: 'single', length: 109 },
      { from: 3, to: 12, order: 1, type: 'single', length: 109 },
      { from: 3, to: 13, order: 1, type: 'single', length: 109 },
      { from: 4, to: 14, order: 1, type: 'single', length: 109 },
      { from: 4, to: 15, order: 1, type: 'single', length: 109 },
      { from: 4, to: 16, order: 1, type: 'single', length: 109 },
    ],
  },
];

const alkeneMolecules: MoleculeData[] = [
  {
    id: 'MOL-049', name_cn: '乙烯', name_en: 'Ethylene', formula: 'C₂H₄',
    level: '高中必修', category: 'alkene', subcategory: 'organic',
    hybridization: 'sp²', bond_angles: { 'H-C=C': 120 },
    features: '平面结构，不能自由旋转',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 134 },
      { from: 0, to: 2, order: 1, type: 'single', length: 109 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 1, to: 4, order: 1, type: 'single', length: 109 },
      { from: 1, to: 5, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-050', name_cn: '丙烯', name_en: 'Propylene', formula: 'C₃H₆',
    level: '高中选修', category: 'alkene', subcategory: 'organic',
    hybridization: 'sp²/sp³',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' }, { element: 'C', label: 'C3' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 134 },
      { from: 1, to: 2, order: 1, type: 'single', length: 154 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 1, to: 5, order: 1, type: 'single', length: 109 },
      { from: 2, to: 6, order: 1, type: 'single', length: 109 },
      { from: 2, to: 7, order: 1, type: 'single', length: 109 },
      { from: 2, to: 8, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-051', name_cn: '1-丁烯', name_en: '1-Butene', formula: 'C₄H₈',
    level: '高中选修', category: 'alkene', subcategory: 'organic',
    hybridization: 'sp²/sp³',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 134 },
      { from: 1, to: 2, order: 1, type: 'single', length: 154 },
      { from: 2, to: 3, order: 1, type: 'single', length: 154 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 1, to: 6, order: 1, type: 'single', length: 109 },
      { from: 2, to: 7, order: 1, type: 'single', length: 109 },
      { from: 2, to: 8, order: 1, type: 'single', length: 109 },
      { from: 3, to: 9, order: 1, type: 'single', length: 109 },
      { from: 3, to: 10, order: 1, type: 'single', length: 109 },
      { from: 3, to: 11, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-052', name_cn: '2-丁烯', name_en: '2-Butene', formula: 'C₄H₈',
    level: '高中选修', category: 'alkene', subcategory: 'organic',
    hybridization: 'sp²', features: '顺反异构',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 2, type: 'double', length: 134 },
      { from: 2, to: 3, order: 1, type: 'single', length: 154 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
      { from: 2, to: 8, order: 1, type: 'single', length: 109 },
      { from: 3, to: 9, order: 1, type: 'single', length: 109 },
      { from: 3, to: 10, order: 1, type: 'single', length: 109 },
      { from: 3, to: 11, order: 1, type: 'single', length: 109 },
    ],
  },
];

const alkyneMolecules: MoleculeData[] = [
  {
    id: 'MOL-053', name_cn: '乙炔', name_en: 'Acetylene', formula: 'C₂H₂',
    level: '高中必修', category: 'alkyne', subcategory: 'organic',
    hybridization: 'sp', geometry: '直线形',
    bond_angles: { 'H-C≡C': 180 },
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 3, type: 'triple', length: 120 },
      { from: 0, to: 2, order: 1, type: 'single', length: 109 },
      { from: 1, to: 3, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-054', name_cn: '丙炔', name_en: 'Propyne', formula: 'C₃H₄',
    level: '高中选修', category: 'alkyne', subcategory: 'organic',
    hybridization: 'sp/sp³',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' }, { element: 'C', label: 'C3' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 3, type: 'triple', length: 120 },
      { from: 1, to: 2, order: 1, type: 'single', length: 154 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 2, to: 4, order: 1, type: 'single', length: 109 },
      { from: 2, to: 5, order: 1, type: 'single', length: 109 },
      { from: 2, to: 6, order: 1, type: 'single', length: 109 },
    ],
  },
];

const aromaticMolecules: MoleculeData[] = [
  {
    id: 'MOL-055', name_cn: '苯', name_en: 'Benzene', formula: 'C₆H₆',
    level: '高中必修', category: 'aromatic', subcategory: 'organic',
    hybridization: 'sp²', geometry: '平面正六边形',
    features: '离域π键',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'C', label: 'C5' }, { element: 'C', label: 'C6' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'delocalized', length: 139 },
      { from: 1, to: 2, order: 1, type: 'delocalized', length: 139 },
      { from: 2, to: 3, order: 1, type: 'delocalized', length: 139 },
      { from: 3, to: 4, order: 1, type: 'delocalized', length: 139 },
      { from: 4, to: 5, order: 1, type: 'delocalized', length: 139 },
      { from: 5, to: 0, order: 1, type: 'delocalized', length: 139 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
      { from: 2, to: 8, order: 1, type: 'single', length: 109 },
      { from: 3, to: 9, order: 1, type: 'single', length: 109 },
      { from: 4, to: 10, order: 1, type: 'single', length: 109 },
      { from: 5, to: 11, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-056', name_cn: '甲苯', name_en: 'Toluene', formula: 'C₇H₈',
    level: '高中选修', category: 'aromatic', subcategory: 'organic',
    hybridization: 'sp²/sp³', features: '甲基可绕轴转',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'C', label: 'C5' }, { element: 'C', label: 'C6' },
      { element: 'C', label: 'C7' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'delocalized', length: 139 },
      { from: 1, to: 2, order: 1, type: 'delocalized', length: 139 },
      { from: 2, to: 3, order: 1, type: 'delocalized', length: 139 },
      { from: 3, to: 4, order: 1, type: 'delocalized', length: 139 },
      { from: 4, to: 5, order: 1, type: 'delocalized', length: 139 },
      { from: 5, to: 0, order: 1, type: 'delocalized', length: 139 },
      { from: 0, to: 6, order: 1, type: 'single', length: 151 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
      { from: 2, to: 8, order: 1, type: 'single', length: 109 },
      { from: 3, to: 9, order: 1, type: 'single', length: 109 },
      { from: 4, to: 10, order: 1, type: 'single', length: 109 },
      { from: 5, to: 11, order: 1, type: 'single', length: 109 },
      { from: 6, to: 12, order: 1, type: 'single', length: 109 },
      { from: 6, to: 13, order: 1, type: 'single', length: 109 },
      { from: 6, to: 14, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-057', name_cn: '萘', name_en: 'Naphthalene', formula: 'C₁₀H₈',
    level: '拓展', category: 'aromatic', subcategory: 'organic',
    hybridization: 'sp²', features: '两个共面苯环',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'C', label: 'C4a' }, { element: 'C', label: 'C5' },
      { element: 'C', label: 'C6' }, { element: 'C', label: 'C7' },
      { element: 'C', label: 'C8' }, { element: 'C', label: 'C8a' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      // ring 1: C1-C2-C3-C4-C4a-C8a
      { from: 0, to: 1, order: 1, type: 'delocalized', length: 137 },
      { from: 1, to: 2, order: 1, type: 'delocalized', length: 142 },
      { from: 2, to: 3, order: 1, type: 'delocalized', length: 137 },
      { from: 3, to: 4, order: 1, type: 'delocalized', length: 142 },
      { from: 4, to: 9, order: 1, type: 'delocalized', length: 142 },
      { from: 9, to: 0, order: 1, type: 'delocalized', length: 142 },
      // ring 2: C4a-C5-C6-C7-C8-C8a
      { from: 4, to: 5, order: 1, type: 'delocalized', length: 137 },
      { from: 5, to: 6, order: 1, type: 'delocalized', length: 142 },
      { from: 6, to: 7, order: 1, type: 'delocalized', length: 137 },
      { from: 7, to: 8, order: 1, type: 'delocalized', length: 142 },
      { from: 8, to: 9, order: 1, type: 'delocalized', length: 142 },
      // H atoms
      { from: 0, to: 10, order: 1, type: 'single', length: 109 },
      { from: 1, to: 11, order: 1, type: 'single', length: 109 },
      { from: 2, to: 12, order: 1, type: 'single', length: 109 },
      { from: 3, to: 13, order: 1, type: 'single', length: 109 },
      { from: 5, to: 14, order: 1, type: 'single', length: 109 },
      { from: 6, to: 15, order: 1, type: 'single', length: 109 },
      { from: 7, to: 16, order: 1, type: 'single', length: 109 },
      { from: 8, to: 17, order: 1, type: 'single', length: 109 },
    ],
  },
];

const alcoholAcidMolecules: MoleculeData[] = [
  {
    id: 'MOL-058', name_cn: '甲醇', name_en: 'Methanol', formula: 'CH₃OH',
    level: '高中必修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    functional_group: '-OH',
    atoms: [
      { element: 'C' }, { element: 'O' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 143 },
      { from: 1, to: 2, order: 1, type: 'single', length: 96 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-059', name_cn: '乙醇', name_en: 'Ethanol', formula: 'C₂H₅OH',
    level: '高中必修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    functional_group: '-OH',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'O' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 1, type: 'single', length: 143 },
      { from: 2, to: 3, order: 1, type: 'single', length: 96 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
      { from: 1, to: 8, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-060', name_cn: '甲醛', name_en: 'Formaldehyde', formula: 'HCHO',
    level: '高中选修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    functional_group: '-CHO', hybridization: 'sp²',
    atoms: [
      { element: 'C' }, { element: 'O' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 121 },
      { from: 0, to: 2, order: 1, type: 'single', length: 110 },
      { from: 0, to: 3, order: 1, type: 'single', length: 110 },
    ],
  },
  {
    id: 'MOL-061', name_cn: '乙醛', name_en: 'Acetaldehyde', formula: 'CH₃CHO',
    level: '高中选修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    functional_group: '-CHO',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'O' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 2, type: 'double', length: 121 },
      { from: 1, to: 3, order: 1, type: 'single', length: 110 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-062', name_cn: '甲酸', name_en: 'Formic acid', formula: 'HCOOH',
    level: '高中选修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    functional_group: '-COOH',
    atoms: [
      { element: 'C' }, { element: 'O', label: 'O1' }, { element: 'O', label: 'O2' },
      { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 121 },
      { from: 0, to: 2, order: 1, type: 'single', length: 134 },
      { from: 2, to: 3, order: 1, type: 'single', length: 97 },
      { from: 0, to: 4, order: 1, type: 'single', length: 110 },
    ],
  },
  {
    id: 'MOL-063', name_cn: '乙酸', name_en: 'Acetic acid', formula: 'CH₃COOH',
    level: '高中必修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    functional_group: '-COOH',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'O', label: 'O1' }, { element: 'O', label: 'O2' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 2, type: 'double', length: 121 },
      { from: 1, to: 3, order: 1, type: 'single', length: 134 },
      { from: 3, to: 4, order: 1, type: 'single', length: 97 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
      { from: 0, to: 7, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-064', name_cn: '乙酸乙酯', name_en: 'Ethyl acetate', formula: 'CH₃COOC₂H₅',
    level: '高中选修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    functional_group: '-COO-',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'O', label: 'O1' }, { element: 'O', label: 'O2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 2, type: 'double', length: 121 },
      { from: 1, to: 3, order: 1, type: 'single', length: 134 },
      { from: 3, to: 4, order: 1, type: 'single', length: 143 },
      { from: 4, to: 5, order: 1, type: 'single', length: 154 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
      { from: 0, to: 7, order: 1, type: 'single', length: 109 },
      { from: 0, to: 8, order: 1, type: 'single', length: 109 },
      { from: 4, to: 9, order: 1, type: 'single', length: 109 },
      { from: 4, to: 10, order: 1, type: 'single', length: 109 },
      { from: 5, to: 11, order: 1, type: 'single', length: 109 },
      { from: 5, to: 12, order: 1, type: 'single', length: 109 },
      { from: 5, to: 13, order: 1, type: 'single', length: 109 },
    ],
  },
];

const nitrogenOrganicMolecules: MoleculeData[] = [
  {
    id: 'MOL-065', name_cn: '甲胺', name_en: 'Methylamine', formula: 'CH₃NH₂',
    level: '高中选修', category: 'nitrogen_organic', subcategory: 'organic',
    functional_group: '-NH₂',
    atoms: [
      { element: 'C' }, { element: 'N' },
      { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 147 },
      { from: 1, to: 2, order: 1, type: 'single', length: 101 },
      { from: 1, to: 3, order: 1, type: 'single', length: 101 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-066', name_cn: '苯胺', name_en: 'Aniline', formula: 'C₆H₅NH₂',
    level: '高中选修', category: 'nitrogen_organic', subcategory: 'organic',
    functional_group: '-NH₂', features: 'C-N与苯环共轭缩短',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'C', label: 'C5' }, { element: 'C', label: 'C6' },
      { element: 'N' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'delocalized', length: 139 },
      { from: 1, to: 2, order: 1, type: 'delocalized', length: 139 },
      { from: 2, to: 3, order: 1, type: 'delocalized', length: 139 },
      { from: 3, to: 4, order: 1, type: 'delocalized', length: 139 },
      { from: 4, to: 5, order: 1, type: 'delocalized', length: 139 },
      { from: 5, to: 0, order: 1, type: 'delocalized', length: 139 },
      { from: 0, to: 6, order: 1, type: 'single', length: 140 },
      { from: 1, to: 7, order: 1, type: 'single', length: 109 },
      { from: 2, to: 8, order: 1, type: 'single', length: 109 },
      { from: 3, to: 9, order: 1, type: 'single', length: 109 },
      { from: 4, to: 10, order: 1, type: 'single', length: 109 },
      { from: 5, to: 11, order: 1, type: 'single', length: 109 },
      { from: 6, to: 12, order: 1, type: 'single', length: 101 },
      { from: 6, to: 13, order: 1, type: 'single', length: 101 },
    ],
  },
  {
    id: 'MOL-067', name_cn: '硝基甲烷', name_en: 'Nitromethane', formula: 'CH₃NO₂',
    level: '拓展', category: 'nitrogen_organic', subcategory: 'organic',
    functional_group: '-NO₂',
    atoms: [
      { element: 'C' }, { element: 'N' },
      { element: 'O' }, { element: 'O' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 1, type: 'single', length: 148 },
      { from: 1, to: 2, order: 2, type: 'double', length: 122 },
      { from: 1, to: 3, order: 1, type: 'single', length: 122 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 0, to: 5, order: 1, type: 'single', length: 109 },
      { from: 0, to: 6, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-068', name_cn: '尿素', name_en: 'Urea', formula: 'CO(NH₂)₂',
    level: '高中选修', category: 'nitrogen_organic', subcategory: 'organic',
    atoms: [
      { element: 'C' }, { element: 'O' },
      { element: 'N', label: 'N1' }, { element: 'N', label: 'N2' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 126 },
      { from: 0, to: 2, order: 1, type: 'single', length: 134 },
      { from: 0, to: 3, order: 1, type: 'single', length: 134 },
      { from: 2, to: 4, order: 1, type: 'single', length: 101 },
      { from: 2, to: 5, order: 1, type: 'single', length: 101 },
      { from: 3, to: 6, order: 1, type: 'single', length: 101 },
      { from: 3, to: 7, order: 1, type: 'single', length: 101 },
    ],
  },
];

const polymerMonomerMolecules: MoleculeData[] = [
  {
    id: 'MOL-069', name_cn: '氯乙烯', name_en: 'Vinyl chloride', formula: 'CH₂=CHCl',
    level: '高中选修', category: 'polymer_monomer', subcategory: 'organic',
    features: '加聚',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'Cl' },
      { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 134 },
      { from: 1, to: 2, order: 1, type: 'single', length: 177 },
      { from: 0, to: 3, order: 1, type: 'single', length: 109 },
      { from: 0, to: 4, order: 1, type: 'single', length: 109 },
      { from: 1, to: 5, order: 1, type: 'single', length: 109 },
    ],
  },
  {
    id: 'MOL-070', name_cn: '四氟乙烯', name_en: 'Tetrafluoroethylene', formula: 'CF₂=CF₂',
    level: '拓展', category: 'polymer_monomer', subcategory: 'organic',
    features: '加聚',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'F' }, { element: 'F' }, { element: 'F' }, { element: 'F' },
    ],
    bonds: [
      { from: 0, to: 1, order: 2, type: 'double', length: 134 },
      { from: 0, to: 2, order: 1, type: 'single', length: 132 },
      { from: 0, to: 3, order: 1, type: 'single', length: 132 },
      { from: 1, to: 4, order: 1, type: 'single', length: 132 },
      { from: 1, to: 5, order: 1, type: 'single', length: 132 },
    ],
  },
  {
    id: 'MOL-071', name_cn: '葡萄糖', name_en: 'Glucose', formula: 'C₆H₁₂O₆',
    level: '高中选修', category: 'polymer_monomer', subcategory: 'organic',
    features: '多羟基醛（开链形式）',
    atoms: [
      { element: 'C', label: 'C1' }, { element: 'C', label: 'C2' },
      { element: 'C', label: 'C3' }, { element: 'C', label: 'C4' },
      { element: 'C', label: 'C5' }, { element: 'C', label: 'C6' },
      { element: 'O', label: 'O1' }, { element: 'O', label: 'O2' },
      { element: 'O', label: 'O3' }, { element: 'O', label: 'O4' },
      { element: 'O', label: 'O5' }, { element: 'O', label: 'O6' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
      { element: 'H' }, { element: 'H' }, { element: 'H' }, { element: 'H' },
    ],
    bonds: [
      // C chain
      { from: 0, to: 1, order: 1, type: 'single', length: 154 },
      { from: 1, to: 2, order: 1, type: 'single', length: 154 },
      { from: 2, to: 3, order: 1, type: 'single', length: 154 },
      { from: 3, to: 4, order: 1, type: 'single', length: 154 },
      { from: 4, to: 5, order: 1, type: 'single', length: 154 },
      // C=O aldehyde
      { from: 0, to: 6, order: 2, type: 'double', length: 121 },
      // C-OH hydroxyl
      { from: 1, to: 7, order: 1, type: 'single', length: 143 },
      { from: 2, to: 8, order: 1, type: 'single', length: 143 },
      { from: 3, to: 9, order: 1, type: 'single', length: 143 },
      { from: 4, to: 10, order: 1, type: 'single', length: 143 },
      { from: 5, to: 11, order: 1, type: 'single', length: 143 },
      // H on C
      { from: 0, to: 12, order: 1, type: 'single', length: 109 },
      { from: 1, to: 13, order: 1, type: 'single', length: 109 },
      { from: 2, to: 14, order: 1, type: 'single', length: 109 },
      { from: 3, to: 15, order: 1, type: 'single', length: 109 },
      { from: 4, to: 16, order: 1, type: 'single', length: 109 },
      { from: 5, to: 17, order: 1, type: 'single', length: 109 },
      { from: 5, to: 18, order: 1, type: 'single', length: 109 },
      // H on OH
      { from: 7, to: 19, order: 1, type: 'single', length: 96 },
      { from: 8, to: 20, order: 1, type: 'single', length: 96 },
      { from: 9, to: 21, order: 1, type: 'single', length: 96 },
      { from: 10, to: 22, order: 1, type: 'single', length: 96 },
      { from: 11, to: 23, order: 1, type: 'single', length: 96 },
    ],
  },
];

/** 全部 71 个分子 */
export const ALL_MOLECULES: MoleculeData[] = [
  ...diatomicMolecules,
  ...triatomicMolecules,
  ...tetratomicMolecules,
  ...pentatomicMolecules,
  ...polyatomicMolecules,
  ...ionMolecules,
  ...alkaneMolecules,
  ...alkeneMolecules,
  ...alkyneMolecules,
  ...aromaticMolecules,
  ...alcoholAcidMolecules,
  ...nitrogenOrganicMolecules,
  ...polymerMonomerMolecules,
];

/** 按 ID 索引 */
export const MOLECULE_MAP = new Map<string, MoleculeData>(
  ALL_MOLECULES.map(m => [m.id, m])
);

/** 按分类分组 */
export const CATEGORY_LABELS: Record<MoleculeCategory, string> = {
  diatomic: '双原子分子',
  triatomic: '三原子分子',
  tetratomic: '四原子分子',
  pentatomic: '五原子分子',
  polyatomic: '多原子分子',
  ion: '常见离子',
  alkane: '烷烃',
  alkene: '烯烃',
  alkyne: '炔烃',
  aromatic: '芳烃',
  alcohol_aldehyde_acid_ester: '醇醛酸酯',
  nitrogen_organic: '含氮有机物',
  polymer_monomer: '高分子单体',
};

export const LEVEL_OPTIONS = ['全部', '初中', '高中必修', '高中选修', '拓展'] as const;
