/**
 * 分子元数据 — 71 个分子的教学属性（不含原子/键坐标数据）
 * 3D 坐标由 SDF 文件提供，教学属性在此文件维护
 */

import type { BondType } from './bondTypes';

export type MoleculeCategory =
  | 'diatomic' | 'triatomic' | 'tetratomic' | 'pentatomic'
  | 'polyatomic' | 'ion'
  | 'alkane' | 'alkene' | 'alkyne' | 'aromatic'
  | 'alcohol_aldehyde_acid_ester' | 'nitrogen_organic' | 'polymer_monomer'
  | 'inorganic_acid' | 'coordination' | 'biomolecule';

/** 键类型覆盖：SDF 默认 1→single, 2→double, 3→triple, 4→delocalized，
 *  若需要 coordinate/hydrogen/delocalized 等特殊类型，在此覆盖 */
export interface BondTypeOverride {
  from: number;
  to: number;
  type: BondType;
}

export interface MoleculeMetadata {
  id: string;
  name_cn: string;
  name_en: string;
  formula: string;
  level: string;
  category: MoleculeCategory;
  subcategory: 'inorganic' | 'organic';
  // SDF 数据
  sdfFile: string;        // 如 'MOL-001.sdf'
  hasSdf: boolean;        // 是否有 SDF 数据（3D 或 2D）
  has3D?: boolean;        // SDF 是否包含 3D 坐标（false = 仅 2D，3D 模式下标注提示）
  // 教学属性
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
  // 离子电荷（+1, -1, -2 等，默认 0 表示中性）
  charge?: number;
  // 键类型覆盖
  bondTypeOverrides?: BondTypeOverride[];
  // 形式电荷覆盖（配合物用氧化态模型，0-indexed atom → charge）
  formalChargeOverrides?: Record<number, number>;
  // 不显示电子式的分子（如复杂结构P₄O₁₀、葡萄糖等，高中不考察且呈现效果差）
  skipElectronFormula?: boolean;
  // 电子式模式特殊处理：
  // - electronFormulaType: 'lewis' = 使用指定的电子式专用形式电荷（忽略自动计算）
  // - lewisFormalCharges: Record<number, number> = 电子式模式下的形式电荷
  electronFormulaType?: 'lewis';
  lewisFormalCharges?: Record<number, number>;
}

// ============ 无机分子 ============

const diatomicMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-001', name_cn: '氢气', name_en: 'Hydrogen', formula: 'H₂',
    level: '初中', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-001.sdf', hasSdf: true,
    geometry: '直线形', polarity: '非极性',
  },
  {
    id: 'MOL-002', name_cn: '氧气', name_en: 'Oxygen', formula: 'O₂',
    level: '初中', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-002.sdf', hasSdf: true,
    geometry: '直线形', polarity: '非极性',
  },
  {
    id: 'MOL-003', name_cn: '氮气', name_en: 'Nitrogen', formula: 'N₂',
    level: '初中', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-003.sdf', hasSdf: true,
    geometry: '直线形', polarity: '非极性',
  },
  {
    id: 'MOL-004', name_cn: '氯气', name_en: 'Chlorine', formula: 'Cl₂',
    level: '高中必修', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-004.sdf', hasSdf: true,
    geometry: '直线形', polarity: '非极性',
  },
  {
    id: 'MOL-005', name_cn: '氯化氢', name_en: 'Hydrogen chloride', formula: 'HCl',
    level: '高中必修', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-005.sdf', hasSdf: true,
    geometry: '直线形', polarity: '极性',
  },
  {
    id: 'MOL-006', name_cn: '氟化氢', name_en: 'Hydrogen fluoride', formula: 'HF',
    level: '高中必修', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-006.sdf', hasSdf: true,
    geometry: '直线形', polarity: '极性',
  },
  {
    id: 'MOL-007', name_cn: '溴化氢', name_en: 'Hydrogen bromide', formula: 'HBr',
    level: '高中选修', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-007.sdf', hasSdf: true,
    geometry: '直线形', polarity: '极性',
  },
  {
    id: 'MOL-008', name_cn: '碘化氢', name_en: 'Hydrogen iodide', formula: 'HI',
    level: '高中选修', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-008.sdf', hasSdf: true,
    geometry: '直线形', polarity: '极性',
  },
  {
    id: 'MOL-009', name_cn: '一氧化碳', name_en: 'Carbon monoxide', formula: 'CO',
    level: '高中必修', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-009.sdf', hasSdf: true,
    geometry: '直线形', polarity: '极性',
  },
  {
    id: 'MOL-010', name_cn: '一氧化氮', name_en: 'Nitric oxide', formula: 'NO',
    level: '高中选修', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-010.sdf', hasSdf: true,
    geometry: '直线形', polarity: '极性',
  },
  {
    id: 'MOL-011', name_cn: '氟气', name_en: 'Fluorine', formula: 'F₂',
    level: '高中选修', category: 'diatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-011.sdf', hasSdf: true,
    geometry: '直线形', polarity: '非极性',
  },
];

const triatomicMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-012', name_cn: '水', name_en: 'Water', formula: 'H₂O',
    level: '初中', category: 'triatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-012.sdf', hasSdf: true,
    vsepr: 'AX2E2', geometry: 'V形', central_atom: 'O',
    bond_pairs: 2, lone_pairs: 2, hybridization: 'sp³',
    bond_angles: { 'H-O-H': 104.5 }, polarity: '极性',
  },
  {
    id: 'MOL-013', name_cn: '二氧化碳', name_en: 'Carbon dioxide', formula: 'CO₂',
    level: '初中', category: 'triatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-013.sdf', hasSdf: true,
    vsepr: 'AX2', geometry: '直线形', central_atom: 'C',
    bond_pairs: 2, lone_pairs: 0, hybridization: 'sp',
    bond_angles: { 'O=C=O': 180 }, polarity: '非极性',
  },
  {
    id: 'MOL-014', name_cn: '二氧化硫', name_en: 'Sulfur dioxide', formula: 'SO₂',
    level: '高中必修', category: 'triatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-014.sdf', hasSdf: true,
    vsepr: 'AX2E', geometry: 'V形', central_atom: 'S',
    bond_pairs: 2, lone_pairs: 1, hybridization: 'sp²',
    bond_angles: { 'O-S-O': 119 }, polarity: '极性',
    // Lewis共振式：O=S⁺–O⁻ ↔ O⁻–S⁺=O，中心S带+1，单键端O带-1
    electronFormulaType: 'lewis',
    lewisFormalCharges: { 0: 1, 1: -1, 2: 0 },
  },
  {
    id: 'MOL-015', name_cn: '二氧化氮', name_en: 'Nitrogen dioxide', formula: 'NO₂',
    level: '高中选修', category: 'triatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-015.sdf', hasSdf: true,
    vsepr: 'AX2E', geometry: 'V形', central_atom: 'N',
    bond_pairs: 2, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'O-N-O': 134 }, polarity: '极性',
    features: '含单电子（自由基）',
    // NO₂是自由基(17e⁻)：Lewis结构为 O=N⁺·–O⁻ ↔ O⁻–N⁺·=O
    // 3D近似：N带+1（忽略未成对电子），2D电子式已在JSON中正确标注
    formalChargeOverrides: { 0: 1, 1: 0, 2: 0 },
  },
  {
    id: 'MOL-016', name_cn: '硫化氢', name_en: 'Hydrogen sulfide', formula: 'H₂S',
    level: '高中必修', category: 'triatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-016.sdf', hasSdf: true,
    vsepr: 'AX2E2', geometry: 'V形', central_atom: 'S',
    bond_pairs: 2, lone_pairs: 2, hybridization: 'sp³',
    bond_angles: { 'H-S-H': 92 }, polarity: '极性',
  },
  {
    id: 'MOL-017', name_cn: '二硫化碳', name_en: 'Carbon disulfide', formula: 'CS₂',
    level: '高中选修', category: 'triatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-017.sdf', hasSdf: true,
    vsepr: 'AX2', geometry: '直线形', central_atom: 'C',
    bond_pairs: 2, lone_pairs: 0, hybridization: 'sp',
    bond_angles: { 'S=C=S': 180 }, polarity: '非极性',
  },
  {
    id: 'MOL-018', name_cn: '臭氧', name_en: 'Ozone', formula: 'O₃',
    level: '高中选修', category: 'triatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-018.sdf', hasSdf: true,
    vsepr: 'AX2E', geometry: 'V形', central_atom: 'O',
    bond_pairs: 2, lone_pairs: 1, hybridization: 'sp²',
    bond_angles: { 'O-O-O': 117 }, polarity: '极性',
    // Lewis共振式：O=O⁺–O⁻ ↔ O⁻–O⁺=O，中心O带+1，单键端O带-1，双键端O为0
    electronFormulaType: 'lewis',
    lewisFormalCharges: { 0: 1, 1: -1, 2: 0 }, // 端基O2有双键，端基O3有单键+孤对
  },
];

const tetratomicMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-019', name_cn: '氨', name_en: 'Ammonia', formula: 'NH₃',
    level: '高中必修', category: 'tetratomic', subcategory: 'inorganic',
    sdfFile: 'MOL-019.sdf', hasSdf: true,
    vsepr: 'AX3E', geometry: '三角锥形', central_atom: 'N',
    bond_pairs: 3, lone_pairs: 1, hybridization: 'sp³',
    bond_angles: { 'H-N-H': 107 }, polarity: '极性',
  },
  {
    id: 'MOL-020', name_cn: '三氟化氮', name_en: 'Nitrogen trifluoride', formula: 'NF₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    sdfFile: 'MOL-020.sdf', hasSdf: true,
    vsepr: 'AX3E', geometry: '三角锥形', central_atom: 'N',
    bond_pairs: 3, lone_pairs: 1, hybridization: 'sp³',
    bond_angles: { 'F-N-F': 102 }, polarity: '极性',
  },
  {
    id: 'MOL-021', name_cn: '三氯化磷', name_en: 'Phosphorus trichloride', formula: 'PCl₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    sdfFile: 'MOL-021.sdf', hasSdf: true,
    vsepr: 'AX3E', geometry: '三角锥形', central_atom: 'P',
    bond_pairs: 3, lone_pairs: 1, hybridization: 'sp³',
    bond_angles: { 'Cl-P-Cl': 100 }, polarity: '极性',
  },
  {
    id: 'MOL-022', name_cn: '三氟化硼', name_en: 'Boron trifluoride', formula: 'BF₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    sdfFile: 'MOL-022.sdf', hasSdf: true,
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'B',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'F-B-F': 120 }, polarity: '非极性',
  },
  {
    id: 'MOL-023', name_cn: '三氯化硼', name_en: 'Boron trichloride', formula: 'BCl₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    sdfFile: 'MOL-023.sdf', hasSdf: true,
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'B',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'Cl-B-Cl': 120 }, polarity: '非极性',
  },
  {
    id: 'MOL-024', name_cn: '三氧化硫', name_en: 'Sulfur trioxide', formula: 'SO₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    sdfFile: 'MOL-024.sdf', hasSdf: true,
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'S',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'O=S=O': 120 }, polarity: '非极性',
  },
  {
    id: 'MOL-025', name_cn: '三氯化铝', name_en: 'Aluminium chloride', formula: 'AlCl₃',
    level: '高中选修', category: 'tetratomic', subcategory: 'inorganic',
    sdfFile: 'MOL-025.sdf', hasSdf: true,
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'Al',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'Cl-Al-Cl': 120 }, polarity: '非极性',
  },
];

const pentatomicMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-026', name_cn: '甲烷', name_en: 'Methane', formula: 'CH₄',
    level: '高中必修', category: 'pentatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-026.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'C',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'H-C-H': 109.5 }, polarity: '非极性',
  },
  {
    id: 'MOL-027', name_cn: '四氯化碳', name_en: 'Carbon tetrachloride', formula: 'CCl₄',
    level: '高中必修', category: 'pentatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-027.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'C',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'Cl-C-Cl': 109.5 }, polarity: '非极性',
  },
  {
    id: 'MOL-028', name_cn: '硅烷', name_en: 'Silane', formula: 'SiH₄',
    level: '高中选修', category: 'pentatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-028.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'Si',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'H-Si-H': 109.5 }, polarity: '非极性',
  },
  {
    id: 'MOL-029', name_cn: '四氟化硅', name_en: 'Silicon tetrafluoride', formula: 'SiF₄',
    level: '高中选修', category: 'pentatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-029.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'Si',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'F-Si-F': 109.5 }, polarity: '非极性',
  },
  {
    id: 'MOL-030', name_cn: '铵根离子', name_en: 'Ammonium', formula: 'NH₄⁺',
    level: '高中必修', category: 'pentatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-030.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'N',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'H-N-H': 109.5 }, charge: 1,
  },
];

const polyatomicMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-031', name_cn: '五氯化磷', name_en: 'Phosphorus pentachloride', formula: 'PCl₅',
    level: '高中选修', category: 'polyatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-031.sdf', hasSdf: true,
    vsepr: 'AX5', geometry: '三角双锥', central_atom: 'P',
    bond_pairs: 5, lone_pairs: 0, hybridization: 'sp³d',
    polarity: '非极性',
  },
  {
    id: 'MOL-032', name_cn: '六氟化硫', name_en: 'Sulfur hexafluoride', formula: 'SF₆',
    level: '高中选修', category: 'polyatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-032.sdf', hasSdf: true,
    vsepr: 'AX6', geometry: '正八面体', central_atom: 'S',
    bond_pairs: 6, lone_pairs: 0, hybridization: 'sp³d²',
    polarity: '非极性',
  },
  {
    id: 'MOL-033', name_cn: '五氟化碘', name_en: 'Iodine pentafluoride', formula: 'IF₅',
    level: '拓展', category: 'polyatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-033.sdf', hasSdf: false,
    vsepr: 'AX5E', geometry: '四方锥', central_atom: 'I',
    bond_pairs: 5, lone_pairs: 1, hybridization: 'sp³d²',
    polarity: '极性',
  },
  {
    id: 'MOL-034', name_cn: '二氟化氙', name_en: 'Xenon difluoride', formula: 'XeF₂',
    level: '拓展', category: 'polyatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-034.sdf', hasSdf: false,
    vsepr: 'AX2E3', geometry: '直线形', central_atom: 'Xe',
    bond_pairs: 2, lone_pairs: 3, hybridization: 'sp³d',
    polarity: '非极性',
  },
  {
    id: 'MOL-035', name_cn: '四氟化氙', name_en: 'Xenon tetrafluoride', formula: 'XeF₄',
    level: '拓展', category: 'polyatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-035.sdf', hasSdf: true,
    vsepr: 'AX4E2', geometry: '平面正方形', central_atom: 'Xe',
    bond_pairs: 4, lone_pairs: 2, hybridization: 'sp³d²',
    polarity: '非极性',
  },
];

const ionMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-036', name_cn: '碳酸根', name_en: 'Carbonate', formula: 'CO₃²⁻',
    level: '高中必修', category: 'ion', subcategory: 'inorganic',
    sdfFile: 'MOL-036.sdf', hasSdf: true,
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'C',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'O-C-O': 120 }, charge: -2,
  },
  {
    id: 'MOL-037', name_cn: '硫酸根', name_en: 'Sulfate', formula: 'SO₄²⁻',
    level: '高中必修', category: 'ion', subcategory: 'inorganic',
    sdfFile: 'MOL-037.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'S',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'O-S-O': 109.5 }, charge: -2,
  },
  {
    id: 'MOL-038', name_cn: '硝酸根', name_en: 'Nitrate', formula: 'NO₃⁻',
    level: '高中必修', category: 'ion', subcategory: 'inorganic',
    sdfFile: 'MOL-038.sdf', hasSdf: true,
    vsepr: 'AX3', geometry: '平面三角形', central_atom: 'N',
    bond_pairs: 3, lone_pairs: 0, hybridization: 'sp²',
    bond_angles: { 'O-N-O': 120 }, charge: -1,
  },
  {
    id: 'MOL-039', name_cn: '高氯酸根', name_en: 'Perchlorate', formula: 'ClO₄⁻',
    level: '高中选修', category: 'ion', subcategory: 'inorganic',
    sdfFile: 'MOL-039.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'Cl',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'O-Cl-O': 109.5 }, charge: -1,
  },
  {
    id: 'MOL-040', name_cn: '磷酸根', name_en: 'Phosphate', formula: 'PO₄³⁻',
    level: '高中选修', category: 'ion', subcategory: 'inorganic',
    sdfFile: 'MOL-040.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'P',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'O-P-O': 109.5 }, charge: -3,
  },
  {
    id: 'MOL-041', name_cn: '高锰酸根', name_en: 'Permanganate', formula: 'MnO₄⁻',
    level: '高中选修', category: 'ion', subcategory: 'inorganic',
    sdfFile: 'MOL-041.sdf', hasSdf: true,
    vsepr: 'AX4', geometry: '正四面体', central_atom: 'Mn',
    bond_pairs: 4, lone_pairs: 0, hybridization: 'sp³',
    bond_angles: { 'O-Mn-O': 109.5 }, charge: -1,
  },
  {
    id: 'MOL-042', name_cn: '氢氧根', name_en: 'Hydroxide', formula: 'OH⁻',
    level: '初中', category: 'ion', subcategory: 'inorganic',
    sdfFile: 'MOL-042.sdf', hasSdf: true,
    geometry: '直线', charge: -1,
  },
];

// ============ 有机分子 ============

const alkaneMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-043', name_cn: '甲烷', name_en: 'Methane', formula: 'CH₄',
    level: '高中必修', category: 'alkane', subcategory: 'organic',
    sdfFile: 'MOL-043.sdf', hasSdf: true,
    hybridization: 'sp³', bond_angles: { 'H-C-H': 109.5 },
  },
  {
    id: 'MOL-044', name_cn: '乙烷', name_en: 'Ethane', formula: 'C₂H₆',
    level: '高中必修', category: 'alkane', subcategory: 'organic',
    sdfFile: 'MOL-044.sdf', hasSdf: true,
    hybridization: 'sp³', bond_angles: { 'H-C-H': 109.5 },
  },
  {
    id: 'MOL-045', name_cn: '丙烷', name_en: 'Propane', formula: 'C₃H₈',
    level: '高中选修', category: 'alkane', subcategory: 'organic',
    sdfFile: 'MOL-045.sdf', hasSdf: true,
    hybridization: 'sp³', bond_angles: { 'C-C-C': 109.5 },
  },
  {
    id: 'MOL-046', name_cn: '正丁烷', name_en: 'Butane', formula: 'C₄H₁₀',
    level: '高中选修', category: 'alkane', subcategory: 'organic',
    sdfFile: 'MOL-046.sdf', hasSdf: true,
    hybridization: 'sp³', bond_angles: { 'C-C-C': 109.5 },
  },
  {
    id: 'MOL-047', name_cn: '异丁烷', name_en: 'Isobutane', formula: 'C₄H₁₀',
    level: '高中选修', category: 'alkane', subcategory: 'organic',
    sdfFile: 'MOL-047.sdf', hasSdf: true,
    hybridization: 'sp³', features: '2-甲基丙烷',
  },
  {
    id: 'MOL-048', name_cn: '正戊烷', name_en: 'Pentane', formula: 'C₅H₁₂',
    level: '高中选修', category: 'alkane', subcategory: 'organic',
    sdfFile: 'MOL-048.sdf', hasSdf: true,
    hybridization: 'sp³',
  },
];

const alkeneMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-049', name_cn: '乙烯', name_en: 'Ethylene', formula: 'C₂H₄',
    level: '高中必修', category: 'alkene', subcategory: 'organic',
    sdfFile: 'MOL-049.sdf', hasSdf: true,
    hybridization: 'sp²', bond_angles: { 'H-C=C': 120 },
    features: '平面结构，不能自由旋转',
  },
  {
    id: 'MOL-050', name_cn: '丙烯', name_en: 'Propylene', formula: 'C₃H₆',
    level: '高中选修', category: 'alkene', subcategory: 'organic',
    sdfFile: 'MOL-050.sdf', hasSdf: true,
    hybridization: 'sp²/sp³',
  },
  {
    id: 'MOL-051', name_cn: '1-丁烯', name_en: '1-Butene', formula: 'C₄H₈',
    level: '高中选修', category: 'alkene', subcategory: 'organic',
    sdfFile: 'MOL-051.sdf', hasSdf: true,
    hybridization: 'sp²/sp³',
  },
  {
    id: 'MOL-052', name_cn: '2-丁烯', name_en: '2-Butene', formula: 'C₄H₈',
    level: '高中选修', category: 'alkene', subcategory: 'organic',
    sdfFile: 'MOL-052.sdf', hasSdf: true,
    hybridization: 'sp²', features: '顺反异构',
  },
];

const alkyneMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-053', name_cn: '乙炔', name_en: 'Acetylene', formula: 'C₂H₂',
    level: '高中必修', category: 'alkyne', subcategory: 'organic',
    sdfFile: 'MOL-053.sdf', hasSdf: true,
    hybridization: 'sp', geometry: '直线形',
    bond_angles: { 'H-C≡C': 180 },
  },
  {
    id: 'MOL-054', name_cn: '丙炔', name_en: 'Propyne', formula: 'C₃H₄',
    level: '高中选修', category: 'alkyne', subcategory: 'organic',
    sdfFile: 'MOL-054.sdf', hasSdf: true,
    hybridization: 'sp/sp³',
  },
];

const aromaticMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-055', name_cn: '苯', name_en: 'Benzene', formula: 'C₆H₆',
    level: '高中必修', category: 'aromatic', subcategory: 'organic',
    sdfFile: 'MOL-055.sdf', hasSdf: true,
    hybridization: 'sp²', geometry: '平面正六边形',
    features: '离域π键',
  },
  {
    id: 'MOL-056', name_cn: '甲苯', name_en: 'Toluene', formula: 'C₇H₈',
    level: '高中选修', category: 'aromatic', subcategory: 'organic',
    sdfFile: 'MOL-056.sdf', hasSdf: true,
    hybridization: 'sp²/sp³', features: '甲基可绕轴转',
  },
  {
    id: 'MOL-057', name_cn: '萘', name_en: 'Naphthalene', formula: 'C₁₀H₈',
    level: '拓展', category: 'aromatic', subcategory: 'organic',
    sdfFile: 'MOL-057.sdf', hasSdf: true,
    hybridization: 'sp²', features: '两个共面苯环',
  },
];

const alcoholAcidMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-058', name_cn: '甲醇', name_en: 'Methanol', formula: 'CH₃OH',
    level: '高中必修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    sdfFile: 'MOL-058.sdf', hasSdf: true,
    functional_group: '-OH',
  },
  {
    id: 'MOL-059', name_cn: '乙醇', name_en: 'Ethanol', formula: 'C₂H₅OH',
    level: '高中必修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    sdfFile: 'MOL-059.sdf', hasSdf: true,
    functional_group: '-OH',
  },
  {
    id: 'MOL-060', name_cn: '甲醛', name_en: 'Formaldehyde', formula: 'HCHO',
    level: '高中选修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    sdfFile: 'MOL-060.sdf', hasSdf: true,
    functional_group: '-CHO', hybridization: 'sp²',
  },
  {
    id: 'MOL-061', name_cn: '乙醛', name_en: 'Acetaldehyde', formula: 'CH₃CHO',
    level: '高中选修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    sdfFile: 'MOL-061.sdf', hasSdf: true,
    functional_group: '-CHO',
  },
  {
    id: 'MOL-062', name_cn: '甲酸', name_en: 'Formic acid', formula: 'HCOOH',
    level: '高中选修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    sdfFile: 'MOL-062.sdf', hasSdf: true,
    functional_group: '-COOH',
  },
  {
    id: 'MOL-063', name_cn: '乙酸', name_en: 'Acetic acid', formula: 'CH₃COOH',
    level: '高中必修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    sdfFile: 'MOL-063.sdf', hasSdf: true,
    functional_group: '-COOH',
  },
  {
    id: 'MOL-064', name_cn: '乙酸乙酯', name_en: 'Ethyl acetate', formula: 'CH₃COOC₂H₅',
    level: '高中选修', category: 'alcohol_aldehyde_acid_ester', subcategory: 'organic',
    sdfFile: 'MOL-064.sdf', hasSdf: true,
    functional_group: '-COO-',
  },
];

const nitrogenOrganicMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-065', name_cn: '甲胺', name_en: 'Methylamine', formula: 'CH₃NH₂',
    level: '高中选修', category: 'nitrogen_organic', subcategory: 'organic',
    sdfFile: 'MOL-065.sdf', hasSdf: true,
    functional_group: '-NH₂',
  },
  {
    id: 'MOL-066', name_cn: '苯胺', name_en: 'Aniline', formula: 'C₆H₅NH₂',
    level: '高中选修', category: 'nitrogen_organic', subcategory: 'organic',
    sdfFile: 'MOL-066.sdf', hasSdf: true,
    functional_group: '-NH₂', features: 'C-N与苯环共轭缩短',
  },
  {
    id: 'MOL-067', name_cn: '硝基甲烷', name_en: 'Nitromethane', formula: 'CH₃NO₂',
    level: '拓展', category: 'nitrogen_organic', subcategory: 'organic',
    sdfFile: 'MOL-067.sdf', hasSdf: true,
    functional_group: '-NO₂',
  },
  {
    id: 'MOL-068', name_cn: '尿素', name_en: 'Urea', formula: 'CO(NH₂)₂',
    level: '高中选修', category: 'nitrogen_organic', subcategory: 'organic',
    sdfFile: 'MOL-068.sdf', hasSdf: true,
  },
];

const polymerMonomerMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-069', name_cn: '氯乙烯', name_en: 'Vinyl chloride', formula: 'CH₂=CHCl',
    level: '高中选修', category: 'polymer_monomer', subcategory: 'organic',
    sdfFile: 'MOL-069.sdf', hasSdf: true,
    features: '加聚',
  },
  {
    id: 'MOL-070', name_cn: '四氟乙烯', name_en: 'Tetrafluoroethylene', formula: 'CF₂=CF₂',
    level: '拓展', category: 'polymer_monomer', subcategory: 'organic',
    sdfFile: 'MOL-070.sdf', hasSdf: true,
    features: '加聚',
  },
  {
    id: 'MOL-071', name_cn: '葡萄糖', name_en: 'Glucose', formula: 'C₆H₁₂O₆',
    level: '高中选修', category: 'polymer_monomer', subcategory: 'organic',
    sdfFile: 'MOL-071.sdf', hasSdf: true,
    features: '开链结构，含醛基（CHO）',
    functional_group: '多羟基醛',
    skipElectronFormula: true, // 复杂开链结构，电子式呈现效果差
  },
];

// ============ 无机含氧酸 ============

const inorganicAcidMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-075', name_cn: '硫酸', name_en: 'Sulfuric acid', formula: 'H₂SO₄',
    level: '初中', category: 'inorganic_acid', subcategory: 'inorganic',
    sdfFile: 'MOL-075.sdf', hasSdf: true,
    central_atom: 'S', vsepr: 'AX4', geometry: '四面体',
    bond_pairs: 4, lone_pairs: 0,
  },
  {
    id: 'MOL-076', name_cn: '硝酸', name_en: 'Nitric acid', formula: 'HNO₃',
    level: '初中', category: 'inorganic_acid', subcategory: 'inorganic',
    sdfFile: 'MOL-076.sdf', hasSdf: true,
    central_atom: 'N', vsepr: 'AX3', geometry: '平面三角形',
    bond_pairs: 3, lone_pairs: 0,
  },
  {
    id: 'MOL-077', name_cn: '磷酸', name_en: 'Phosphoric acid', formula: 'H₃PO₄',
    level: '高中选修', category: 'inorganic_acid', subcategory: 'inorganic',
    sdfFile: 'MOL-077.sdf', hasSdf: true,
    central_atom: 'P', vsepr: 'AX4', geometry: '四面体',
    bond_pairs: 4, lone_pairs: 0,
  },
  {
    id: 'MOL-078', name_cn: '碳酸', name_en: 'Carbonic acid', formula: 'H₂CO₃',
    level: '初中', category: 'inorganic_acid', subcategory: 'inorganic',
    sdfFile: 'MOL-078.sdf', hasSdf: true,
    central_atom: 'C', vsepr: 'AX3', geometry: '平面三角形',
    bond_pairs: 3, lone_pairs: 0,
  },
  {
    id: 'MOL-079', name_cn: '次氯酸', name_en: 'Hypochlorous acid', formula: 'HClO',
    level: '高中必修', category: 'inorganic_acid', subcategory: 'inorganic',
    sdfFile: 'MOL-079.sdf', hasSdf: true,
  },
  {
    id: 'MOL-080', name_cn: '亚硫酸', name_en: 'Sulfurous acid', formula: 'H₂SO₃',
    level: '高中选修', category: 'inorganic_acid', subcategory: 'inorganic',
    sdfFile: 'MOL-080.sdf', hasSdf: true,
    central_atom: 'S', vsepr: 'AX3E1', geometry: '三角锥形',
    bond_pairs: 3, lone_pairs: 1,
  },
  {
    id: 'MOL-081', name_cn: '偏硅酸', name_en: 'Metasilicic acid', formula: 'H₂SiO₃',
    level: '高中选修', category: 'inorganic_acid', subcategory: 'inorganic',
    sdfFile: 'MOL-081.sdf', hasSdf: true,
    central_atom: 'Si',
  },
  {
    id: 'MOL-085', name_cn: '高氯酸', name_en: 'Perchloric acid', formula: 'HClO₄',
    level: '拓展', category: 'inorganic_acid', subcategory: 'inorganic',
    sdfFile: 'MOL-085.sdf', hasSdf: true, has3D: false,
    central_atom: 'Cl', vsepr: 'AX4', geometry: '四面体',
    bond_pairs: 4, lone_pairs: 0,
  },
];

// ============ 其他无机物 ============

const otherInorganicMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-074', name_cn: '五氧化二磷', name_en: 'Phosphorus pentoxide', formula: 'P₄O₁₀',
    level: '高中选修', category: 'polyatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-074.sdf', hasSdf: true,
    features: '笼状分子',
    skipElectronFormula: true, // 复杂笼状结构，电子式呈现效果差，高中不考察
  },
  {
    id: 'MOL-082', name_cn: '过氧化氢', name_en: 'Hydrogen peroxide', formula: 'H₂O₂',
    level: '高中必修', category: 'triatomic', subcategory: 'inorganic',
    sdfFile: 'MOL-082.sdf', hasSdf: true,
    features: '过氧键 O-O',
  },
];

// ============ 生物分子 ============

const biomolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-072', name_cn: 'α-D-吡喃葡萄糖', name_en: 'alpha-D-Glucopyranose', formula: 'C₆H₁₂O₆',
    level: '高中选修', category: 'biomolecule', subcategory: 'organic',
    sdfFile: 'MOL-072.sdf', hasSdf: true,
    features: '吡喃环（α构型）',
    skipElectronFormula: true, // 复杂环状结构，电子式呈现效果差
  },
  {
    id: 'MOL-073', name_cn: 'β-D-吡喃葡萄糖', name_en: 'beta-D-Glucopyranose', formula: 'C₆H₁₂O₆',
    level: '高中选修', category: 'biomolecule', subcategory: 'organic',
    sdfFile: 'MOL-073.sdf', hasSdf: true,
    features: '吡喃环（β构型）',
    skipElectronFormula: true, // 复杂环状结构，电子式呈现效果差
  },
  {
    id: 'MOL-092', name_cn: '链状葡萄糖', name_en: 'D-Glucose (open-chain)', formula: 'C₆H₁₂O₆',
    level: '高中选修', category: 'biomolecule', subcategory: 'organic',
    sdfFile: 'MOL-092.sdf', hasSdf: true, has3D: true,
    features: '开链结构，CHO–(CHOH)₄–CH₂OH',
    functional_group: '醛基+多羟基',
    skipElectronFormula: true, // 开链大分子，电子式呈现效果差
  },
  {
    id: 'MOL-084', name_cn: '甘氨酸', name_en: 'Glycine', formula: 'C₂H₅NO₂',
    level: '高中选修', category: 'biomolecule', subcategory: 'organic',
    sdfFile: 'MOL-084.sdf', hasSdf: true,
    features: '最简氨基酸',
    functional_group: '氨基+羧基',
  },
  {
    id: 'MOL-083', name_cn: '苯酚', name_en: 'Phenol', formula: 'C₆H₅OH',
    level: '高中选修', category: 'aromatic', subcategory: 'organic',
    sdfFile: 'MOL-083.sdf', hasSdf: true,
    features: '酚羟基',
    functional_group: '酚羟基',
  },
];

// ============ 配合物 ============

const coordinationMolecules: MoleculeMetadata[] = [
  {
    id: 'MOL-086', name_cn: '银氨配离子', name_en: 'Diamminesilver(I)', formula: '[Ag(NH₃)₂]⁺',
    level: '高中选修', category: 'coordination', subcategory: 'inorganic',
    sdfFile: 'MOL-086.sdf', hasSdf: true, has3D: true,
    charge: 1, central_atom: 'Ag',
    geometry: '直线形', features: '银镜反应配离子',
    bondTypeOverrides: [
      { from: 0, to: 1, type: 'coordinate' },
      { from: 0, to: 2, type: 'coordinate' },
    ],
    // Ag⁺(+1), NH₃配体N为配位键供体→FC=0
    formalChargeOverrides: { 0: 1, 1: 0, 2: 0 },
  },
  {
    id: 'MOL-087', name_cn: '铜氨配离子', name_en: 'Tetraamminecopper(II)', formula: '[Cu(NH₃)₄]²⁺',
    level: '高中选修', category: 'coordination', subcategory: 'inorganic',
    sdfFile: 'MOL-087.sdf', hasSdf: true, has3D: true,
    charge: 2, central_atom: 'Cu',
    geometry: '平面正方形', features: '铜氨络离子（深蓝色）',
    bondTypeOverrides: [
      { from: 0, to: 1, type: 'coordinate' },
      { from: 0, to: 2, type: 'coordinate' },
      { from: 0, to: 3, type: 'coordinate' },
      { from: 0, to: 4, type: 'coordinate' },
    ],
    // Cu²⁺(+2), NH₃配体N为配位键供体→FC=0
    formalChargeOverrides: { 0: 2, 1: 0, 2: 0, 3: 0, 4: 0 },
  },
  {
    id: 'MOL-088', name_cn: '硫氰酸铁', name_en: 'Iron(III) thiocyanate', formula: 'Fe(SCN)₃',
    level: '高中必修', category: 'coordination', subcategory: 'inorganic', // 必修：Fe³⁺检验
    sdfFile: 'MOL-088.sdf', hasSdf: true, has3D: true,
    central_atom: 'Fe',
    geometry: '八面体(fac)',
    features: 'Fe³⁺检验（血红色）',
    bondTypeOverrides: [
      { from: 0, to: 1, type: 'coordinate' },
      { from: 0, to: 2, type: 'coordinate' },
      { from: 0, to: 3, type: 'coordinate' },
    ],
    // Fe³⁺(+3), 3个SCN⁻ → S各-1
    formalChargeOverrides: { 0: 3, 1: -1, 2: -1, 3: -1 },
    skipElectronFormula: true, // 复杂结构，电子式呈现效果差
  },
  {
    id: 'MOL-089', name_cn: '四羟基合铝酸根', name_en: 'Tetrahydroxoaluminate', formula: '[Al(OH)₄]⁻',
    level: '高中必修', category: 'coordination', subcategory: 'inorganic', // 必修：铝的两性反应
    sdfFile: 'MOL-089.sdf', hasSdf: true, has3D: true,
    charge: -1, central_atom: 'Al',
    vsepr: 'AX4', geometry: '四面体', hybridization: 'sp³',
    features: '铝的两性反应产物',
    bondTypeOverrides: [
      { from: 0, to: 1, type: 'coordinate' },
      { from: 0, to: 2, type: 'coordinate' },
      { from: 0, to: 3, type: 'coordinate' },
      { from: 0, to: 4, type: 'coordinate' },
    ],
    // Al³⁺(+3), 4个OH⁻各-1，总计 +3-4 = -1
    formalChargeOverrides: { 0: 3, 1: -1, 2: -1, 3: -1, 4: -1 },
  },
  {
    id: 'MOL-090', name_cn: '四羟基合锌酸根', name_en: 'Tetrahydroxozincate', formula: '[Zn(OH)₄]²⁻',
    level: '高中选修', category: 'coordination', subcategory: 'inorganic',
    sdfFile: 'MOL-090.sdf', hasSdf: true, has3D: true,
    charge: -2, central_atom: 'Zn',
    geometry: '四面体', features: '锌的两性反应产物',
    bondTypeOverrides: [
      { from: 0, to: 1, type: 'coordinate' },
      { from: 0, to: 2, type: 'coordinate' },
      { from: 0, to: 3, type: 'coordinate' },
      { from: 0, to: 7, type: 'coordinate' },
    ],
    // Zn²⁺(+2), 4个OH⁻各-1，总计 +2-4 = -2
    formalChargeOverrides: { 0: 2, 1: -1, 2: -1, 3: -1, 7: -1 },
  },
];

/** 全部分子元数据 */
export const ALL_MOLECULES: MoleculeMetadata[] = [
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
  ...inorganicAcidMolecules,
  ...otherInorganicMolecules,
  ...biomolecules,
  ...coordinationMolecules,
];

/** 按 ID 索引 */
export const MOLECULE_MAP = new Map<string, MoleculeMetadata>(
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
  inorganic_acid: '无机含氧酸',
  coordination: '配合物',
  biomolecule: '生物分子',
};

export const LEVEL_OPTIONS = ['全部', '初中', '高中必修', '高中选修', '拓展'] as const;
