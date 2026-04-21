import type { CrystalStructure, CrystalCategory } from '../engine/types';

// ---------------------------------------------------------------------------
// Complete crystal structure database (21 structures)
// All lattice parameters and fractional coordinates sourced from the
// Crystallography Open Database (COD, https://www.crystallography.net/cod/).
// Each entry includes a codId referencing the original CIF data.
// See src/data/cif/README.md for the full source citation table.
// ---------------------------------------------------------------------------

export const CRYSTAL_STRUCTURES: CrystalStructure[] = [
  // ==========================================================================
  // IONIC CRYSTALS
  // ==========================================================================

  // CRY-001: NaCl (Rock salt)
  {
    id: 'CRY-001',
    name: '氯化钠 (岩盐型)',
    formula: 'NaCl',
    formulaHtml: 'NaCl',
    category: 'ionic',
    gradeLevel: '高中必修',
    structureType: '岩盐型',
    crystalSystem: 'cubic',
    spaceGroup: 'Fm3\u0304m',
    spaceGroupNumber: 225,
    lattice: { a: 564.1, b: 564.1, c: 564.1, alpha: 90, beta: 90, gamma: 90 },
    z: 4,
    atomSites: [
      { element: 'Na', label: 'Na1', fracCoords: [0, 0, 0], charge: '+1' },
      { element: 'Na', label: 'Na2', fracCoords: [0.5, 0.5, 0], charge: '+1' },
      { element: 'Na', label: 'Na3', fracCoords: [0.5, 0, 0.5], charge: '+1' },
      { element: 'Na', label: 'Na4', fracCoords: [0, 0.5, 0.5], charge: '+1' },
      { element: 'Cl', label: 'Cl1', fracCoords: [0.5, 0, 0], charge: '-1' },
      { element: 'Cl', label: 'Cl2', fracCoords: [0, 0.5, 0], charge: '-1' },
      { element: 'Cl', label: 'Cl3', fracCoords: [0, 0, 0.5], charge: '-1' },
      { element: 'Cl', label: 'Cl4', fracCoords: [0.5, 0.5, 0.5], charge: '-1' },
    ],
    bonds: [
      // Na1(0,0,0) -> Cl1(0.5,0,0)
      { siteIndices: [0, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na1(0,0,0) -> Cl2(0,0.5,0)
      { siteIndices: [0, 5], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na1(0,0,0) -> Cl3(0,0,0.5)
      { siteIndices: [0, 6], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na1(0,0,0) -> Cl from adjacent cell (-0.5,0,0) = Cl1 at [-1,0,0]
      { siteIndices: [0, 4], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na1(0,0,0) -> Cl from adjacent cell (0,-0.5,0) = Cl2 at [0,-1,0]
      { siteIndices: [0, 5], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 282 },
      // Na1(0,0,0) -> Cl from adjacent cell (0,0,-0.5) = Cl3 at [0,0,-1]
      { siteIndices: [0, 6], cellOffset: [0, 0, -1], bondType: 'ionic', expectedLength: 282 },
      // Na2(0.5,0.5,0) -> Cl1(0.5,0,0)
      { siteIndices: [1, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na2(0.5,0.5,0) -> Cl2(0,0.5,0)
      { siteIndices: [1, 5], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na2(0.5,0.5,0) -> Cl4(0.5,0.5,0.5)
      { siteIndices: [1, 7], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na2(0.5,0.5,0) -> Cl1(0.5,1,0) = Cl1 at [0,1,0]
      { siteIndices: [1, 5], cellOffset: [1, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na2(0.5,0.5,0) -> Cl2(1,0.5,0) = Cl2 at [1,0,0]
      { siteIndices: [1, 4], cellOffset: [0, 1, 0], bondType: 'ionic', expectedLength: 282 },
      // Na2(0.5,0.5,0) -> Cl4(0.5,0.5,-0.5) = Cl4 at [0,0,-1]
      { siteIndices: [1, 7], cellOffset: [0, 0, -1], bondType: 'ionic', expectedLength: 282 },
      // Na3(0.5,0,0.5) -> Cl1(0.5,0,0)
      { siteIndices: [2, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na3(0.5,0,0.5) -> Cl3(0,0,0.5)
      { siteIndices: [2, 6], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na3(0.5,0,0.5) -> Cl4(0.5,0.5,0.5)
      { siteIndices: [2, 7], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na3(0.5,0,0.5) -> Cl1(0.5,0,1) = Cl1 at [0,0,1]
      { siteIndices: [2, 4], cellOffset: [0, 0, 1], bondType: 'ionic', expectedLength: 282 },
      // Na3(0.5,0,0.5) -> Cl3(1,0,0.5) = Cl3 at [1,0,0]
      { siteIndices: [2, 6], cellOffset: [1, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na3(0.5,0,0.5) -> Cl4(0.5,-0.5,0.5) = Cl4 at [0,-1,0]
      { siteIndices: [2, 7], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 282 },
      // Na4(0,0.5,0.5) -> Cl2(0,0.5,0)
      { siteIndices: [3, 5], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na4(0,0.5,0.5) -> Cl3(0,0,0.5)
      { siteIndices: [3, 6], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na4(0,0.5,0.5) -> Cl4(0.5,0.5,0.5)
      { siteIndices: [3, 7], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 282 },
      // Na4(0,0.5,0.5) -> Cl2(0,0.5,1) = Cl2 at [0,0,1]
      { siteIndices: [3, 5], cellOffset: [0, 0, 1], bondType: 'ionic', expectedLength: 282 },
      // Na4(0,0.5,0.5) -> Cl3(0,1,0.5) = Cl3 at [0,1,0]
      { siteIndices: [3, 6], cellOffset: [0, 1, 0], bondType: 'ionic', expectedLength: 282 },
      // Na4(0,0.5,0.5) -> Cl4(-0.5,0.5,0.5) = Cl4 at [-1,0,0]
      { siteIndices: [3, 7], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 282 },
    ],
    coordinationNumber: '6:6',
    coordinationGeometry: '正八面体',
    polyhedra: [
      { centerSiteIndex: 0, label: 'NaO6', polyhedronType: 'octahedron', neighborCutoff: 3.0 },
    ],
    teachingPoints: [
      '每个Na+周围有6个Cl-，形成正八面体配位（配位数6:6）',
      '晶胞中含有4个NaCl（Na:4个在棱中点和体心位置，Cl:4个在顶点和面心位置）',
      'NaCl晶体中不存在"NaCl分子"，只有离子',
      '晶格能较高(786 kJ/mol)，熔点801°C',
      '等径球最密堆积的八面体空隙全部被填充',
    ],
    bondLengths: { 'Na-Cl': 282 },
    codId: 9008678,
    dataSource: 'COD #9008678 — Wyckoff, Crystal Structures 1, 85-237 (1963)',
  },

  // CRY-002: CsCl
  {
    id: 'CRY-002',
    name: '氯化铯',
    formula: 'CsCl',
    formulaHtml: 'CsCl',
    category: 'ionic',
    gradeLevel: '高中必修',
    structureType: '氯化铯型',
    crystalSystem: 'cubic',
    spaceGroup: 'Pm3\u0304m',
    spaceGroupNumber: 221,
    lattice: { a: 412.3, b: 412.3, c: 412.3, alpha: 90, beta: 90, gamma: 90 },
    z: 1,
    atomSites: [
      { element: 'Cs', label: 'Cs1', fracCoords: [0, 0, 0], charge: '+1' },
      { element: 'Cl', label: 'Cl1', fracCoords: [0.5, 0.5, 0.5], charge: '-1' },
    ],
    bonds: [
      // Cs(0,0,0) -> Cl(0.5,0.5,0.5)
      { siteIndices: [0, 1], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 357 },
      // Cs(0,0,0) -> Cl(-0.5,-0.5,0.5) = Cl at [-1,-1,0]
      { siteIndices: [0, 1], cellOffset: [-1, -1, 0], bondType: 'ionic', expectedLength: 357 },
      // Cs(0,0,0) -> Cl(-0.5,0.5,-0.5) = Cl at [-1,0,-1]
      { siteIndices: [0, 1], cellOffset: [-1, 0, -1], bondType: 'ionic', expectedLength: 357 },
      // Cs(0,0,0) -> Cl(0.5,-0.5,-0.5) = Cl at [0,-1,-1]
      { siteIndices: [0, 1], cellOffset: [0, -1, -1], bondType: 'ionic', expectedLength: 357 },
      // Cs(0,0,0) -> Cl(-0.5,0.5,0.5) = Cl at [-1,0,0]
      { siteIndices: [0, 1], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 357 },
      // Cs(0,0,0) -> Cl(0.5,-0.5,0.5) = Cl at [0,-1,0]
      { siteIndices: [0, 1], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 357 },
      // Cs(0,0,0) -> Cl(0.5,0.5,-0.5) = Cl at [0,0,-1]
      { siteIndices: [0, 1], cellOffset: [0, 0, -1], bondType: 'ionic', expectedLength: 357 },
      // Cs(0,0,0) -> Cl(-0.5,-0.5,-0.5) = Cl at [-1,-1,-1]
      { siteIndices: [0, 1], cellOffset: [-1, -1, -1], bondType: 'ionic', expectedLength: 357 },
    ],
    coordinationNumber: '8:8',
    coordinationGeometry: '立方体',
    polyhedra: [
      { centerSiteIndex: 0, label: 'CsCl8', polyhedronType: 'cube', neighborCutoff: 3.8 },
    ],
    teachingPoints: [
      'CsCl结构不是体心立方(BCC)！顶点和体心是不同离子',
      '每个Cs+周围有8个Cl-，形成立方体配位（配位数8:8）',
      '每个晶胞含1个CsCl（Cs在顶点共享8个晶胞，贡献1/8×8=1；Cl在体心贡献1）',
      'Cs+半径较大(167pm)，能容纳8个Cl-围绕',
      '简单立方堆积，立方体空隙被填充',
    ],
    bondLengths: { 'Cs-Cl': 357 },
    codId: 9008789,
    dataSource: 'COD #9008789 — Wyckoff, Crystal Structures 1, 85-237 (1963)',
  },

  // CRY-003: CaF2 (Fluorite)
  {
    id: 'CRY-003',
    name: '氟化钙 (萤石)',
    formula: 'CaF2',
    formulaHtml: 'CaF<sub>2</sub>',
    category: 'ionic',
    gradeLevel: '高中选修',
    structureType: '萤石型',
    crystalSystem: 'cubic',
    spaceGroup: 'Fm3\u0304m',
    spaceGroupNumber: 225,
    lattice: { a: 546.2, b: 546.2, c: 546.2, alpha: 90, beta: 90, gamma: 90 },
    z: 4,
    atomSites: [
      { element: 'Ca', label: 'Ca1', fracCoords: [0, 0, 0], charge: '+2' },
      { element: 'Ca', label: 'Ca2', fracCoords: [0.5, 0.5, 0], charge: '+2' },
      { element: 'Ca', label: 'Ca3', fracCoords: [0.5, 0, 0.5], charge: '+2' },
      { element: 'Ca', label: 'Ca4', fracCoords: [0, 0.5, 0.5], charge: '+2' },
      { element: 'F', label: 'F1', fracCoords: [0.25, 0.25, 0.25], charge: '-1' },
      { element: 'F', label: 'F2', fracCoords: [0.75, 0.75, 0.25], charge: '-1' },
      { element: 'F', label: 'F3', fracCoords: [0.75, 0.25, 0.75], charge: '-1' },
      { element: 'F', label: 'F4', fracCoords: [0.25, 0.75, 0.75], charge: '-1' },
      { element: 'F', label: 'F5', fracCoords: [0.25, 0.75, 0.25], charge: '-1' },
      { element: 'F', label: 'F6', fracCoords: [0.75, 0.25, 0.25], charge: '-1' },
      { element: 'F', label: 'F7', fracCoords: [0.25, 0.25, 0.75], charge: '-1' },
      { element: 'F', label: 'F8', fracCoords: [0.75, 0.75, 0.75], charge: '-1' },
    ],
    bonds: [
      // Ca1(0,0,0) -> F1(0.25,0.25,0.25)
      { siteIndices: [0, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 236 },
      // Ca1(0,0,0) -> F5(0.25,0.75,0.25) -> actually need adjacent cell F
      // Ca1 is coordinated by 8 F- in a cube
      { siteIndices: [0, 5], cellOffset: [-1, -1, 0], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [0, 6], cellOffset: [-1, 0, -1], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [0, 7], cellOffset: [0, -1, -1], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [0, 8], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [0, 9], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [0, 10], cellOffset: [0, 0, -1], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [0, 11], cellOffset: [-1, -1, -1], bondType: 'ionic', expectedLength: 236 },
      // Ca2(0.5,0.5,0) neighbors
      { siteIndices: [1, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [1, 5], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [1, 8], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [1, 9], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [1, 10], cellOffset: [0, 0, -1], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [1, 11], cellOffset: [0, 0, -1], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [1, 6], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 236 },
      { siteIndices: [1, 7], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 236 },
    ],
    coordinationNumber: 'Ca:8, F:4',
    coordinationGeometry: 'Ca:立方体, F:正四面体',
    polyhedra: [
      { centerSiteIndex: 0, label: 'CaF8', polyhedronType: 'cube', neighborCutoff: 2.5 },
    ],
    teachingPoints: [
      'Ca2+配位数为8（立方体配位），F-配位数为4（正四面体配位）',
      '晶胞含4个CaF2（Ca在FCC位置4个，F填充全部8个四面体空隙）',
      '反萤石结构：阳离子和阴离子位置互换（如Na2O）',
      'F-形成简单立方子晶格，Ca2+占据交替的立方体空隙',
      '萤石是重要的光学材料和冶金助熔剂',
    ],
    bondLengths: { 'Ca-F': 236 },
    codId: 1000043,
    dataSource: 'COD #1000043 — Cheetham et al., J. Phys. C 4, 3107-3121 (1971)',
  },

  // CRY-004: TiO2 (Rutile)
  {
    id: 'CRY-004',
    name: '二氧化钛 (金红石)',
    formula: 'TiO2',
    formulaHtml: 'TiO<sub>2</sub>',
    category: 'ionic',
    gradeLevel: '高中选修',
    structureType: '金红石型',
    crystalSystem: 'tetragonal',
    spaceGroup: 'P4\u2082/mnm',
    spaceGroupNumber: 136,
    lattice: { a: 459.3, b: 459.3, c: 295.9, alpha: 90, beta: 90, gamma: 90 },
    z: 2,
    atomSites: [
      { element: 'Ti', label: 'Ti1', fracCoords: [0, 0, 0], charge: '+4' },
      { element: 'Ti', label: 'Ti2', fracCoords: [0.5, 0.5, 0.5], charge: '+4' },
      { element: 'O', label: 'O1', fracCoords: [0.305, 0.305, 0], charge: '-2' },
      { element: 'O', label: 'O2', fracCoords: [0.695, 0.695, 0], charge: '-2' },
      { element: 'O', label: 'O3', fracCoords: [0.805, 0.195, 0.5], charge: '-2' },
      { element: 'O', label: 'O4', fracCoords: [0.195, 0.805, 0.5], charge: '-2' },
    ],
    bonds: [
      // Ti1(0,0,0) -> O1(0.305,0.305,0)
      { siteIndices: [0, 2], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 198 },
      // Ti1(0,0,0) -> O2(0.695,0.695,0)
      { siteIndices: [0, 3], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 198 },
      // Ti1(0,0,0) -> O1(-0.305,-0.305,0) = O2 at [-1,-1,0]
      { siteIndices: [0, 3], cellOffset: [-1, -1, 0], bondType: 'ionic', expectedLength: 198 },
      // Ti1(0,0,0) -> O2(-0.695,-0.695,0) = O1 at [-1,-1,0]
      { siteIndices: [0, 2], cellOffset: [-1, -1, 0], bondType: 'ionic', expectedLength: 198 },
      // Ti1(0,0,0) -> O3(0.805,0.195,0.5) -> apical
      { siteIndices: [0, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 195 },
      // Ti1(0,0,0) -> O4(0.195,0.805,0.5) -> apical
      { siteIndices: [0, 5], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 195 },
      // Ti2(0.5,0.5,0.5) -> O3(0.805,0.195,0.5)
      { siteIndices: [1, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 198 },
      // Ti2(0.5,0.5,0.5) -> O4(0.195,0.805,0.5)
      { siteIndices: [1, 5], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 198 },
      // Ti2(0.5,0.5,0.5) -> O3(0.195,0.805,0.5) adjacent
      { siteIndices: [1, 4], cellOffset: [-1, 1, 0], bondType: 'ionic', expectedLength: 198 },
      { siteIndices: [1, 5], cellOffset: [1, -1, 0], bondType: 'ionic', expectedLength: 198 },
      // Ti2 apical bonds
      { siteIndices: [1, 2], cellOffset: [0, 0, 1], bondType: 'ionic', expectedLength: 195 },
      { siteIndices: [1, 3], cellOffset: [0, 0, 1], bondType: 'ionic', expectedLength: 195 },
    ],
    coordinationNumber: 'Ti:6, O:3',
    coordinationGeometry: 'Ti:变形八面体, O:平面三角形',
    polyhedra: [
      { centerSiteIndex: 0, label: 'TiO6', polyhedronType: 'octahedron', neighborCutoff: 2.1 },
      { centerSiteIndex: 1, label: 'TiO6', polyhedronType: 'octahedron', neighborCutoff: 2.1 },
    ],
    teachingPoints: [
      'Ti4+配位数为6（变形八面体配位），O2-配位数为3（平面三角形配位）',
      '每个晶胞含2个TiO2（Ti:顶点1+体心1=2，O:4个在胞内）',
      'TiO6八面体共棱连接形成链，链间共顶点连接',
      '金红石是TiO2最稳定的多晶型，广泛用于白色颜料和光催化',
      '四方晶系：a=b≠c，α=β=γ=90°',
    ],
    bondLengths: { 'Ti-O(eq)': 198, 'Ti-O(ap)': 195 },
    codId: 9004141,
    dataSource: 'COD #9004141 — Meagher & Lager, Can. Mineral. 17, 77-85 (1979)',
  },

  // ==========================================================================
  // ATOMIC CRYSTALS
  // ==========================================================================

  // CRY-005: Diamond
  {
    id: 'CRY-005',
    name: '金刚石',
    formula: 'C',
    formulaHtml: 'C (金刚石)',
    category: 'atomic',
    gradeLevel: '高中必修',
    structureType: '金刚石型',
    crystalSystem: 'cubic',
    spaceGroup: 'Fd3\u0304m',
    spaceGroupNumber: 227,
    lattice: { a: 356.7, b: 356.7, c: 356.7, alpha: 90, beta: 90, gamma: 90 },
    z: 8,
    atomSites: [
      { element: 'C', label: 'C1', fracCoords: [0, 0, 0] },
      { element: 'C', label: 'C2', fracCoords: [0.5, 0.5, 0] },
      { element: 'C', label: 'C3', fracCoords: [0.5, 0, 0.5] },
      { element: 'C', label: 'C4', fracCoords: [0, 0.5, 0.5] },
      { element: 'C', label: 'C5', fracCoords: [0.25, 0.25, 0.25] },
      { element: 'C', label: 'C6', fracCoords: [0.75, 0.75, 0.25] },
      { element: 'C', label: 'C7', fracCoords: [0.75, 0.25, 0.75] },
      { element: 'C', label: 'C8', fracCoords: [0.25, 0.75, 0.75] },
    ],
    bonds: [
      // C1(0,0,0) -> C5(0.25,0.25,0.25)
      { siteIndices: [0, 4], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C2(0.5,0.5,0) -> C5(0.25,0.25,0.25)
      { siteIndices: [1, 4], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C2(0.5,0.5,0) -> C6(0.75,0.75,0.25)
      { siteIndices: [1, 5], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C3(0.5,0,0.5) -> C5(0.25,0.25,0.25) -> no, distance too far
      // C3(0.5,0,0.5) -> C7(0.75,0.25,0.75)
      { siteIndices: [2, 6], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C4(0,0.5,0.5) -> C8(0.25,0.75,0.75)
      { siteIndices: [3, 7], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C6(0.75,0.75,0.25) -> C2(0.5,0.5,0) already done
      // C6(0.75,0.75,0.25) -> C3(0.5,0,0.5) -> no
      // C6(0.75,0.75,0.25) -> C1(1,1,0) = C1 at [1,1,0]
      { siteIndices: [5, 0], cellOffset: [1, 1, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C6(0.75,0.75,0.25) -> C3(1,0.5,0.5) = C3 at [1,0,0]
      { siteIndices: [5, 2], cellOffset: [1, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C6(0.75,0.75,0.25) -> C4(0.5,0.75+0.25=1,0.5) -> C4 at [0,1,0]? No.
      // C6(0.75,0.75,0.25) -> C4(0.5,1,0.5)  = no match
      // Let me be more systematic: each inner C bonds to 1 FCC + 3 adjacent FCC
      // C5(0.25,0.25,0.25): bonds to C1(0,0,0), C2(0.5,0.5,0), C3(0.5,0,0.5), C4(0,0.5,0.5)
      { siteIndices: [4, 2], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      { siteIndices: [4, 3], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C7(0.75,0.25,0.75): bonds to C3(0.5,0,0.5), C1(1,0,1)=[1,0,1], C2(1,0.5,0.5)=[1,0,0]? No
      // C7(0.75,0.25,0.75) -> C3(0.5,0,0.5)  already have [2,6]
      // C7(0.75,0.25,0.75) -> C1(1,0,1) = C1 at [1,0,1]
      { siteIndices: [6, 0], cellOffset: [1, 0, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C7(0.75,0.25,0.75) -> C4(1,0.5,0.5) = C4 at [1,0,0]
      { siteIndices: [6, 3], cellOffset: [1, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C7(0.75,0.25,0.75) -> C2(0.5,0.5,1) = C2 at [0,0,1]
      { siteIndices: [6, 1], cellOffset: [0, 0, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C8(0.25,0.75,0.75): bonds to C4(0,0.5,0.5), C1(0,1,1)=[0,1,1], C2(0.5,0.5,1)=[0,0,1], C3(0,0.5,1)? no
      // C8(0.25,0.75,0.75) -> C4(0,0.5,0.5) already have [3,7]
      // C8(0.25,0.75,0.75) -> C1(0,1,1) = C1 at [0,1,1]
      { siteIndices: [7, 0], cellOffset: [0, 1, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C8(0.25,0.75,0.75) -> C2(0.5,1,0.5)? No, dist = sqrt(0.0625+0.0625+0.0625)*357=154 if 0.25 apart
      // C8(0.25,0.75,0.75) -> C3(0,0.75+0.25=1,0.5)? -> no
      // C8(0.25,0.75,0.75) -> C2(0.5,0.5,1) = [0,0,1]? dist=(0.25,0.25,0.25) yes
      { siteIndices: [7, 1], cellOffset: [0, 0, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C8(0.25,0.75,0.75) -> C3(0,1,0.5)? = [0,1,0]? no dist doesn't work
      // C8 -> C3(0.5,0,0.5)? dist (0.25,0.75,0.25) too far
      // C8(0.25,0.75,0.75) -> C2(0,1,1)? No. Let me recalculate.
      // Actually C8 at (0.25,0.75,0.75). Nearest FCC are those within 0.25*sqrt(3):
      // (0,0.5,0.5)=C4 dist 0.25sqrt3 YES
      // (0,1,1)=C1[0,1,1] dist 0.25sqrt3 YES
      // (0.5,0.5,1)=C2[0,0,1] dist 0.25sqrt3 YES
      // (0.5,1,0.5)=C4[0,1,0] dist 0.25sqrt3 YES
      { siteIndices: [7, 3], cellOffset: [0, 1, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
      // C6(0.75,0.75,0.25) remaining bond: C4(0.5,1,0.5) = C4[0,1,0]
      { siteIndices: [5, 3], cellOffset: [0, 1, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 154 },
    ],
    coordinationNumber: '4',
    coordinationGeometry: '正四面体',
    hybridization: 'sp3',
    teachingPoints: [
      '每个C原子与4个C原子形成共价键，sp3杂化，正四面体构型（键角109.5°）',
      'C-C键长154pm，键能很强(347 kJ/mol)',
      '晶胞含8个C原子（FCC位置4个 + 四面体空隙4个）',
      '金刚石是已知最硬的天然物质（莫氏硬度10）',
      '整个晶体是一个巨大的共价键网络，不存在单个分子',
      '金刚石结构=两套FCC子晶格沿体对角线平移1/4',
    ],
    bondLengths: { 'C-C': 154 },
    codId: 9008564,
    dataSource: 'COD #9008564 — Wyckoff, Crystal Structures 1, 7-83 (1963)',
  },

  // CRY-006: SiO2 (Alpha-Quartz)
  {
    id: 'CRY-006',
    name: '二氧化硅 (\u03B1-石英)',
    formula: 'SiO2',
    formulaHtml: 'SiO<sub>2</sub> (\u03B1-石英)',
    category: 'atomic',
    gradeLevel: '高中必修',
    structureType: '\u03B1-石英型',
    crystalSystem: 'trigonal',
    spaceGroup: 'P3\u2081\u0032\u0031',
    spaceGroupNumber: 152,
    lattice: { a: 491.3, b: 491.3, c: 540.5, alpha: 90, beta: 90, gamma: 120 },
    z: 3,
    atomSites: [
      { element: 'Si', label: 'Si1', fracCoords: [0.4697, 0, 0.333] },
      { element: 'Si', label: 'Si2', fracCoords: [0, 0.4697, 0.667] },
      { element: 'Si', label: 'Si3', fracCoords: [0.5303, 0.5303, 0] },
      { element: 'O', label: 'O1', fracCoords: [0.4135, 0.2669, 0.2144] },
      { element: 'O', label: 'O2', fracCoords: [0.7331, 0.1466, 0.5477] },
      { element: 'O', label: 'O3', fracCoords: [0.8534, 0.5865, 0.8811] },
      { element: 'O', label: 'O4', fracCoords: [0.2669, 0.4135, 0.7856] },
      { element: 'O', label: 'O5', fracCoords: [0.1466, 0.7331, 0.4523] },
      { element: 'O', label: 'O6', fracCoords: [0.5865, 0.8534, 0.1189] },
    ],
    bonds: [
      // Si1 -> O1, O2 (within cell)
      { siteIndices: [0, 3], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [0, 4], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [0, 8], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [0, 6], cellOffset: [0, 0, -1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      // Si2 -> O neighbors
      { siteIndices: [1, 6], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [1, 7], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [1, 3], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [1, 5], cellOffset: [0, 0, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      // Si3 -> O neighbors
      { siteIndices: [2, 5], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [2, 8], cellOffset: [0, 1, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [2, 4], cellOffset: [1, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
      { siteIndices: [2, 7], cellOffset: [0, 1, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 161 },
    ],
    coordinationNumber: 'Si:4, O:2',
    coordinationGeometry: 'Si:正四面体, O:角顶连接',
    polyhedra: [
      { centerSiteIndex: 0, label: 'SiO4', polyhedronType: 'tetrahedron', neighborCutoff: 1.8 },
      { centerSiteIndex: 1, label: 'SiO4', polyhedronType: 'tetrahedron', neighborCutoff: 1.8 },
      { centerSiteIndex: 2, label: 'SiO4', polyhedronType: 'tetrahedron', neighborCutoff: 1.8 },
    ],
    hybridization: 'sp3',
    teachingPoints: [
      '每个Si与4个O形成共价键（sp3杂化，正四面体），每个O桥接2个Si',
      'Si-O键长161pm，Si-O-Si键角约144°',
      '所有SiO4四面体共顶点连接，形成三维网络',
      '石英具有压电效应，广泛用于电子振荡器',
      '整个晶体是一个共价键网络，无独立SiO2分子',
      '三方晶系，具有手性（左旋/右旋石英）',
    ],
    bondLengths: { 'Si-O': 161 },
    codId: 9013321,
    dataSource: 'COD #9013321 — Antao et al., Can. Mineral. (2008)',
  },

  // CRY-007: SiC (3C-SiC, Zinc Blende type)
  {
    id: 'CRY-007',
    name: '碳化硅',
    formula: 'SiC',
    formulaHtml: 'SiC',
    category: 'atomic',
    gradeLevel: '拓展',
    structureType: '闪锌矿型(3C)',
    crystalSystem: 'cubic',
    spaceGroup: 'F\u030443m',
    spaceGroupNumber: 216,
    lattice: { a: 435.8, b: 435.8, c: 435.8, alpha: 90, beta: 90, gamma: 90 },
    z: 4,
    atomSites: [
      { element: 'Si', label: 'Si1', fracCoords: [0, 0, 0] },
      { element: 'Si', label: 'Si2', fracCoords: [0.5, 0.5, 0] },
      { element: 'Si', label: 'Si3', fracCoords: [0.5, 0, 0.5] },
      { element: 'Si', label: 'Si4', fracCoords: [0, 0.5, 0.5] },
      { element: 'C', label: 'C1', fracCoords: [0.25, 0.25, 0.25] },
      { element: 'C', label: 'C2', fracCoords: [0.75, 0.75, 0.25] },
      { element: 'C', label: 'C3', fracCoords: [0.75, 0.25, 0.75] },
      { element: 'C', label: 'C4', fracCoords: [0.25, 0.75, 0.75] },
    ],
    bonds: [
      // Same topology as diamond but Si-C bonds
      // C1(0.25,0.25,0.25) -> Si1(0,0,0), Si2(0.5,0.5,0), Si3(0.5,0,0.5), Si4(0,0.5,0.5)
      { siteIndices: [0, 4], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [1, 4], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [2, 4], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [3, 4], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      // C2(0.75,0.75,0.25) -> Si2(0.5,0.5,0), Si1[1,1,0], Si3[1,0,0], Si4[0,1,0]
      { siteIndices: [1, 5], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [5, 0], cellOffset: [1, 1, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [5, 2], cellOffset: [1, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [5, 3], cellOffset: [0, 1, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      // C3(0.75,0.25,0.75) -> Si3(0.5,0,0.5), Si1[1,0,1], Si2[0,0,1], Si4[1,0,0]
      { siteIndices: [2, 6], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [6, 0], cellOffset: [1, 0, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [6, 1], cellOffset: [0, 0, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [6, 3], cellOffset: [1, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      // C4(0.25,0.75,0.75) -> Si4(0,0.5,0.5), Si1[0,1,1], Si2[0,0,1], Si3[0,1,0]
      { siteIndices: [3, 7], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [7, 0], cellOffset: [0, 1, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [7, 1], cellOffset: [0, 0, 1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
      { siteIndices: [7, 2], cellOffset: [0, 1, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 189 },
    ],
    coordinationNumber: '4',
    coordinationGeometry: '正四面体',
    hybridization: 'sp3',
    teachingPoints: [
      '与金刚石结构相同（闪锌矿型），但交替排列Si和C',
      '每个Si与4个C成键，每个C与4个Si成键，均为sp3杂化',
      'Si-C键长189pm，介于Si-Si(235pm)和C-C(154pm)之间',
      'SiC硬度极高（莫氏硬度9.5），仅次于金刚石',
      '第三代半导体材料，耐高温、高击穿电压',
      '自然界极罕见，主要为人工合成',
    ],
    bondLengths: { 'Si-C': 189 },
    codId: 1011031,
    dataSource: 'COD #1011031 — Moissanite 3C (cubic SiC)',
  },

  // ==========================================================================
  // METALLIC CRYSTALS
  // ==========================================================================

  // CRY-008: Cu (FCC)
  {
    id: 'CRY-008',
    name: '铜',
    formula: 'Cu',
    formulaHtml: 'Cu',
    category: 'metallic',
    gradeLevel: '高中必修',
    structureType: '面心立方(FCC)',
    crystalSystem: 'cubic',
    spaceGroup: 'Fm3\u0304m',
    spaceGroupNumber: 225,
    lattice: { a: 361.5, b: 361.5, c: 361.5, alpha: 90, beta: 90, gamma: 90 },
    z: 4,
    atomSites: [
      { element: 'Cu', label: 'Cu1', fracCoords: [0, 0, 0] },
      { element: 'Cu', label: 'Cu2', fracCoords: [0.5, 0.5, 0] },
      { element: 'Cu', label: 'Cu3', fracCoords: [0.5, 0, 0.5] },
      { element: 'Cu', label: 'Cu4', fracCoords: [0, 0.5, 0.5] },
    ],
    bonds: [],
    neighborCutoff: 2.56,
    packingType: 'FCC',
    packingEfficiency: 74.05,
    coordinationNumber: '12',
    coordinationGeometry: '立方八面体',
    teachingPoints: [
      '面心立方(FCC)堆积，配位数12，空间利用率74.05%',
      '堆积方式为ABCABC...（立方最密堆积CCP）',
      '每个晶胞含4个Cu原子（顶点1/8×8=1，面心1/2×6=3）',
      '12个最近邻原子距离均为a/√2=255pm',
      '延展性极好（金属键无方向性），优良导体',
      'Cu还可形成多种合金：黄铜(Cu-Zn)、青铜(Cu-Sn)等',
    ],
    bondLengths: { 'Cu-Cu': 255 },
    codId: 9008468,
    dataSource: 'COD #9008468 — Wyckoff, Crystal Structures 1, 7-83 (1963)',
  },

  // CRY-009: Alpha-Fe (BCC)
  {
    id: 'CRY-009',
    name: '\u03B1-铁',
    formula: 'Fe',
    formulaHtml: 'Fe (\u03B1)',
    category: 'metallic',
    gradeLevel: '高中必修',
    structureType: '体心立方(BCC)',
    crystalSystem: 'cubic',
    spaceGroup: 'Im3\u0304m',
    spaceGroupNumber: 229,
    lattice: { a: 286.7, b: 286.7, c: 286.7, alpha: 90, beta: 90, gamma: 90 },
    z: 2,
    atomSites: [
      { element: 'Fe', label: 'Fe1', fracCoords: [0, 0, 0] },
      { element: 'Fe', label: 'Fe2', fracCoords: [0.5, 0.5, 0.5] },
    ],
    bonds: [],
    neighborCutoff: 2.49,
    packingType: 'BCC',
    packingEfficiency: 68.02,
    coordinationNumber: '8',
    coordinationGeometry: '立方体',
    teachingPoints: [
      '体心立方(BCC)堆积，配位数8，空间利用率68.02%',
      '每个晶胞含2个Fe原子（顶点1/8×8=1，体心1）',
      '8个最近邻原子距离为a√3/2=249pm',
      '铁在912°C以上转变为γ-Fe(FCC)，1394°C以上转为δ-Fe(BCC)',
      'BCC不是最密堆积，但高温下Fe会转变为FCC最密堆积',
      'α-Fe具有铁磁性（居里温度770°C）',
    ],
    bondLengths: { 'Fe-Fe': 249 },
    codId: 9008536,
    dataSource: 'COD #9008536 — Wyckoff, Crystal Structures 1, 7-83 (1963)',
  },

  // CRY-010: Mg (HCP)
  {
    id: 'CRY-010',
    name: '镁',
    formula: 'Mg',
    formulaHtml: 'Mg',
    category: 'metallic',
    gradeLevel: '高中选修',
    structureType: '六方最密堆积(HCP)',
    crystalSystem: 'hexagonal',
    spaceGroup: 'P6\u2083/mmc',
    spaceGroupNumber: 194,
    lattice: { a: 320.9, b: 320.9, c: 521.0, alpha: 90, beta: 90, gamma: 120 },
    z: 2,
    atomSites: [
      { element: 'Mg', label: 'Mg1', fracCoords: [1 / 3, 2 / 3, 0.25] },
      { element: 'Mg', label: 'Mg2', fracCoords: [2 / 3, 1 / 3, 0.75] },
    ],
    bonds: [],
    neighborCutoff: 3.21,
    packingType: 'HCP',
    packingEfficiency: 74.05,
    coordinationNumber: '12',
    coordinationGeometry: '反棱柱（三方反棱柱套三棱柱）',
    teachingPoints: [
      '六方最密堆积(HCP)，配位数12，空间利用率74.05%（与FCC相同）',
      '堆积方式为ABAB...（六方最密堆积）',
      '每个晶胞含2个Mg原子',
      '理想c/a比为√(8/3)≈1.633，Mg实际c/a=1.623接近理想值',
      '12个最近邻：同层6个 + 上层3个 + 下层3个',
      'Mg密度低(1.738 g/cm³)，是最轻的结构金属之一',
    ],
    bondLengths: { 'Mg-Mg': 321 },
    codId: 9008506,
    dataSource: 'COD #9008506 — Wyckoff, Crystal Structures 1, 7-83 (1963)',
  },

  // ==========================================================================
  // MOLECULAR CRYSTALS
  // ==========================================================================

  // CRY-011: Ice Ih
  {
    id: 'CRY-011',
    name: '冰 (Ih)',
    formula: 'H2O',
    formulaHtml: 'H<sub>2</sub>O (冰Ih)',
    category: 'molecular',
    gradeLevel: '高中必修',
    structureType: '六方冰(Ih)',
    crystalSystem: 'hexagonal',
    spaceGroup: 'P6\u2083/mmc',
    spaceGroupNumber: 194,
    lattice: { a: 452, b: 452, c: 736, alpha: 90, beta: 90, gamma: 120 },
    z: 4,
    atomSites: [
      // Simplified: O atoms at tetrahedral positions in hexagonal lattice
      { element: 'O', label: 'O1', fracCoords: [1 / 3, 2 / 3, 0.0625] },
      { element: 'O', label: 'O2', fracCoords: [2 / 3, 1 / 3, 0.5625] },
      { element: 'O', label: 'O3', fracCoords: [1 / 3, 2 / 3, 0.4375] },
      { element: 'O', label: 'O4', fracCoords: [2 / 3, 1 / 3, 0.9375] },
    ],
    bonds: [
      // O-H covalent bonds within water molecules (simplified as O-O hydrogen bonds)
      // Hydrogen bonds between water molecules (~276pm)
      { siteIndices: [0, 2], cellOffset: [0, 0, 0], bondType: 'hydrogen', expectedLength: 276 },
      { siteIndices: [1, 3], cellOffset: [0, 0, 0], bondType: 'hydrogen', expectedLength: 276 },
      { siteIndices: [2, 1], cellOffset: [0, 0, 0], bondType: 'hydrogen', expectedLength: 276 },
      { siteIndices: [3, 0], cellOffset: [0, 0, 1], bondType: 'hydrogen', expectedLength: 276 },
      // Inter-layer hydrogen bonds
      { siteIndices: [0, 1], cellOffset: [0, 0, 0], bondType: 'hydrogen', expectedLength: 276 },
      { siteIndices: [0, 1], cellOffset: [-1, 0, 0], bondType: 'hydrogen', expectedLength: 276 },
      { siteIndices: [0, 1], cellOffset: [0, -1, 0], bondType: 'hydrogen', expectedLength: 276 },
      { siteIndices: [2, 3], cellOffset: [0, 0, 0], bondType: 'hydrogen', expectedLength: 276 },
      { siteIndices: [2, 3], cellOffset: [-1, 0, 0], bondType: 'hydrogen', expectedLength: 276 },
      { siteIndices: [2, 3], cellOffset: [0, -1, 0], bondType: 'hydrogen', expectedLength: 276 },
    ],
    coordinationNumber: '4 (氢键)',
    coordinationGeometry: '近似正四面体',
    teachingPoints: [
      '每个水分子通过4个氢键与周围水分子相连（四面体排列）',
      'O-H···O氢键长度约276pm，其中O-H共价键~96pm，H···O氢键~180pm',
      '冰的密度(0.917 g/cm³)小于水(1.0 g/cm³)——氢键使结构疏松',
      '六方冰(Ih)结构与金刚石的拓扑结构相似（四配位网络）',
      '氢键比共价键弱得多(~20 kJ/mol vs ~460 kJ/mol)，但对性质影响巨大',
      '水的反常膨胀和冰浮于水上都是氢键的结果',
    ],
    bondLengths: { 'O-H': 96, 'O···H': 180, 'O-H···O': 276 },
    codId: 1011023,
    dataSource: 'COD #1011023 — Bernal & Fowler, J. Chem. Phys. (1933)',
  },

  // CRY-012: Dry Ice (CO2)
  {
    id: 'CRY-012',
    name: '干冰',
    formula: 'CO2',
    formulaHtml: 'CO<sub>2</sub> (干冰)',
    category: 'molecular',
    gradeLevel: '高中必修',
    structureType: '分子晶体(FCC)',
    crystalSystem: 'cubic',
    spaceGroup: 'Pa3\u0304',
    spaceGroupNumber: 205,
    lattice: { a: 563, b: 563, c: 563, alpha: 90, beta: 90, gamma: 90 },
    z: 4,
    atomSites: [
      // CO2 molecules at FCC positions, linear molecule along body diagonal
      { element: 'C', label: 'C1', fracCoords: [0, 0, 0] },
      { element: 'O', label: 'O1a', fracCoords: [0.118, 0.118, 0.118] },
      { element: 'O', label: 'O1b', fracCoords: [-0.118, -0.118, -0.118] },
      { element: 'C', label: 'C2', fracCoords: [0.5, 0.5, 0] },
      { element: 'O', label: 'O2a', fracCoords: [0.618, 0.382, 0.118] },
      { element: 'O', label: 'O2b', fracCoords: [0.382, 0.618, -0.118] },
      { element: 'C', label: 'C3', fracCoords: [0.5, 0, 0.5] },
      { element: 'O', label: 'O3a', fracCoords: [0.618, 0.118, 0.382] },
      { element: 'O', label: 'O3b', fracCoords: [0.382, -0.118, 0.618] },
      { element: 'C', label: 'C4', fracCoords: [0, 0.5, 0.5] },
      { element: 'O', label: 'O4a', fracCoords: [0.118, 0.382, 0.618] },
      { element: 'O', label: 'O4b', fracCoords: [-0.118, 0.618, 0.382] },
    ],
    bonds: [
      // Intramolecular C=O covalent bonds
      { siteIndices: [0, 1], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 2, expectedLength: 116 },
      { siteIndices: [0, 2], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 2, expectedLength: 116 },
      { siteIndices: [3, 4], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 2, expectedLength: 116 },
      { siteIndices: [3, 5], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 2, expectedLength: 116 },
      { siteIndices: [6, 7], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 2, expectedLength: 116 },
      { siteIndices: [6, 8], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 2, expectedLength: 116 },
      { siteIndices: [9, 10], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 2, expectedLength: 116 },
      { siteIndices: [9, 11], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 2, expectedLength: 116 },
      // Intermolecular van der Waals (representative)
      { siteIndices: [0, 3], cellOffset: [0, 0, 0], bondType: 'vanDerWaals', expectedLength: 397 },
      { siteIndices: [0, 6], cellOffset: [0, 0, 0], bondType: 'vanDerWaals', expectedLength: 397 },
      { siteIndices: [0, 9], cellOffset: [0, 0, 0], bondType: 'vanDerWaals', expectedLength: 397 },
    ],
    coordinationNumber: '12 (分子间)',
    coordinationGeometry: '线性分子(O=C=O), FCC分子排列',
    teachingPoints: [
      '干冰是CO2的分子晶体，分子间通过范德华力结合',
      'CO2为直线形分子（O=C=O），C=O键长116pm',
      '分子在FCC位置排列，每个CO2周围有12个最近邻CO2分子',
      '升华温度-78.5°C（范德华力弱，易升华）',
      '分子内共价键强(C=O 805kJ/mol)，分子间范德华力弱(~25kJ/mol)',
      '注意区分：分子内共价键 vs 分子间范德华力',
    ],
    bondLengths: { 'C=O': 116 },
    codId: 1010060,
    dataSource: 'COD #1010060 — Solid CO₂ (Pa-3)',
  },

  // ==========================================================================
  // LAYERED STRUCTURES
  // ==========================================================================

  // CRY-013: Graphite
  {
    id: 'CRY-013',
    name: '石墨',
    formula: 'C',
    formulaHtml: 'C (石墨)',
    category: 'layered',
    gradeLevel: '高中必修',
    structureType: '层状结构',
    crystalSystem: 'hexagonal',
    spaceGroup: 'P6\u2083/mmc',
    spaceGroupNumber: 194,
    lattice: { a: 245.6, b: 245.6, c: 669.6, alpha: 90, beta: 90, gamma: 120 },
    z: 4,
    atomSites: [
      { element: 'C', label: 'C1', fracCoords: [0, 0, 0.25] },
      { element: 'C', label: 'C2', fracCoords: [1 / 3, 2 / 3, 0.25] },
      { element: 'C', label: 'C3', fracCoords: [0, 0, 0.75] },
      { element: 'C', label: 'C4', fracCoords: [2 / 3, 1 / 3, 0.75] },
    ],
    bonds: [
      // Layer 1 (z=0.25): C1-C2 bonds (in-plane covalent)
      { siteIndices: [0, 1], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1.5, expectedLength: 142 },
      { siteIndices: [0, 1], cellOffset: [-1, 0, 0], bondType: 'covalent-sigma', bondOrder: 1.5, expectedLength: 142 },
      { siteIndices: [0, 1], cellOffset: [0, -1, 0], bondType: 'covalent-sigma', bondOrder: 1.5, expectedLength: 142 },
      // Layer 2 (z=0.75): C3-C4 bonds (in-plane covalent)
      { siteIndices: [2, 3], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1.5, expectedLength: 142 },
      { siteIndices: [2, 3], cellOffset: [-1, 0, 0], bondType: 'covalent-sigma', bondOrder: 1.5, expectedLength: 142 },
      { siteIndices: [2, 3], cellOffset: [0, -1, 0], bondType: 'covalent-sigma', bondOrder: 1.5, expectedLength: 142 },
      // Interlayer van der Waals (C1-C3 stacking)
      { siteIndices: [0, 2], cellOffset: [0, 0, 0], bondType: 'vanDerWaals', expectedLength: 335 },
      { siteIndices: [0, 2], cellOffset: [0, 0, -1], bondType: 'vanDerWaals', expectedLength: 335 },
    ],
    coordinationNumber: '3 (层内)',
    coordinationGeometry: '平面三角形(层内)',
    hybridization: 'sp2',
    teachingPoints: [
      '每个C原子在层内与3个C以sp2杂化成键，平面六元环结构',
      'C-C键长142pm（介于单键154pm和双键134pm之间），键级约1.33',
      '层间距335pm，层间以范德华力结合（容易滑动→润滑性）',
      '离域π电子可自由移动→石墨能导电（沿层方向）',
      '石墨同时具有原子晶体（层内共价键）和分子晶体（层间范德华力）的特征',
      '注意对比金刚石(sp3, 3D网络)和石墨(sp2, 2D层状)',
    ],
    bondLengths: { 'C-C(层内)': 142, 'C···C(层间)': 335 },
    codId: 9008569,
    dataSource: 'COD #9008569 — Wyckoff, Crystal Structures 1, 7-83 (1963)',
  },

  // CRY-014: CdCl2
  {
    id: 'CRY-014',
    name: '氯化镉',
    formula: 'CdCl2',
    formulaHtml: 'CdCl<sub>2</sub>',
    category: 'layered',
    gradeLevel: '拓展',
    structureType: '层状结构(CdCl2型)',
    crystalSystem: 'trigonal',
    spaceGroup: 'R3\u0304m',
    spaceGroupNumber: 166,
    lattice: { a: 386, b: 386, c: 1742, alpha: 90, beta: 90, gamma: 120 },
    z: 3,
    atomSites: [
      { element: 'Cd', label: 'Cd1', fracCoords: [0, 0, 0], charge: '+2' },
      { element: 'Cl', label: 'Cl1', fracCoords: [1 / 3, 2 / 3, 0.075], charge: '-1' },
      { element: 'Cl', label: 'Cl2', fracCoords: [2 / 3, 1 / 3, -0.075], charge: '-1' },
    ],
    bonds: [
      // Cd -> 6 Cl in octahedral coordination within layer
      { siteIndices: [0, 1], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 264 },
      { siteIndices: [0, 1], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 264 },
      { siteIndices: [0, 1], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 264 },
      { siteIndices: [0, 2], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 264 },
      { siteIndices: [0, 2], cellOffset: [1, 0, 0], bondType: 'ionic', expectedLength: 264 },
      { siteIndices: [0, 2], cellOffset: [0, 1, 0], bondType: 'ionic', expectedLength: 264 },
      // Interlayer van der Waals
      { siteIndices: [1, 2], cellOffset: [0, 0, 1], bondType: 'vanDerWaals', expectedLength: 369 },
    ],
    coordinationNumber: 'Cd:6, Cl:3',
    coordinationGeometry: 'Cd:八面体, Cl:三角锥',
    polyhedra: [
      { centerSiteIndex: 0, label: 'CdCl6', polyhedronType: 'octahedron', neighborCutoff: 2.8 },
    ],
    teachingPoints: [
      'CdCl2为典型层状结构：Cl-Cd-Cl三明治层通过范德华力堆叠',
      'Cd2+位于两层Cl-之间的八面体空隙中，配位数6',
      'Cl-层为立方最密堆积(CCP)，Cd2+填充交替的八面体层',
      '层间以范德华力结合，可沿层方向解理',
      '层内Cd-Cl键有较强离子性，层间为分子间力',
      '类似结构：MgCl2、FeCl2、NiCl2等',
    ],
    bondLengths: { 'Cd-Cl': 264 },
    codId: 1011332,
    dataSource: 'COD #1011332 — CdCl₂ (R-3m)',
  },

  // ==========================================================================
  // SUPPLEMENTARY CRYSTALS
  // ==========================================================================

  // CRY-015: ZnS Sphalerite
  {
    id: 'CRY-015',
    name: '硫化锌 (闪锌矿)',
    formula: 'ZnS',
    formulaHtml: 'ZnS (闪锌矿)',
    category: 'ionic',
    gradeLevel: '高中选修',
    structureType: '闪锌矿型',
    crystalSystem: 'cubic',
    spaceGroup: 'F\u030443m',
    spaceGroupNumber: 216,
    lattice: { a: 541.5, b: 541.5, c: 541.5, alpha: 90, beta: 90, gamma: 90 },
    z: 4,
    atomSites: [
      { element: 'Zn', label: 'Zn1', fracCoords: [0, 0, 0], charge: '+2' },
      { element: 'Zn', label: 'Zn2', fracCoords: [0.5, 0.5, 0], charge: '+2' },
      { element: 'Zn', label: 'Zn3', fracCoords: [0.5, 0, 0.5], charge: '+2' },
      { element: 'Zn', label: 'Zn4', fracCoords: [0, 0.5, 0.5], charge: '+2' },
      { element: 'S', label: 'S1', fracCoords: [0.25, 0.25, 0.25], charge: '-2' },
      { element: 'S', label: 'S2', fracCoords: [0.75, 0.75, 0.25], charge: '-2' },
      { element: 'S', label: 'S3', fracCoords: [0.75, 0.25, 0.75], charge: '-2' },
      { element: 'S', label: 'S4', fracCoords: [0.25, 0.75, 0.75], charge: '-2' },
    ],
    bonds: [
      // Zn1(0,0,0) -> S1(0.25,0.25,0.25)
      { siteIndices: [0, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [0, 5], cellOffset: [-1, -1, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [0, 6], cellOffset: [-1, 0, -1], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [0, 7], cellOffset: [0, -1, -1], bondType: 'ionic', expectedLength: 234 },
      // Zn2(0.5,0.5,0) -> S1, S2, etc.
      { siteIndices: [1, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [1, 5], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [1, 6], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [1, 7], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 234 },
      // Zn3(0.5,0,0.5) -> neighbors
      { siteIndices: [2, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [2, 6], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [2, 5], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [2, 7], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 234 },
      // Zn4(0,0.5,0.5) -> neighbors
      { siteIndices: [3, 4], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [3, 7], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [3, 5], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 234 },
      { siteIndices: [3, 6], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 234 },
    ],
    coordinationNumber: '4:4',
    coordinationGeometry: '正四面体',
    polyhedra: [
      { centerSiteIndex: 0, label: 'ZnS4', polyhedronType: 'tetrahedron', neighborCutoff: 2.5 },
    ],
    teachingPoints: [
      '闪锌矿与金刚石结构相同，但Zn和S交替占据位置',
      'Zn2+和S2-均为四面体配位（配位数4:4）',
      'Zn-S键长234pm，键有部分共价性',
      '闪锌矿是ZnS的低温相，高温转变为纤锌矿(CRY-016)',
      '半导体材料，带隙3.68eV，用于光电器件',
      '结构可看作两套FCC子晶格（Zn和S各一套）相互嵌套',
    ],
    bondLengths: { 'Zn-S': 234 },
    codId: 1100043,
    dataSource: 'COD #1100043 — ZnS Sphalerite (F-43m)',
  },

  // CRY-016: ZnS Wurtzite
  {
    id: 'CRY-016',
    name: '硫化锌 (纤锌矿)',
    formula: 'ZnS',
    formulaHtml: 'ZnS (纤锌矿)',
    category: 'ionic',
    gradeLevel: '拓展',
    structureType: '纤锌矿型',
    crystalSystem: 'hexagonal',
    spaceGroup: 'P6\u2083mc',
    spaceGroupNumber: 186,
    lattice: { a: 381.1, b: 381.1, c: 623.4, alpha: 90, beta: 90, gamma: 120 },
    z: 2,
    atomSites: [
      { element: 'Zn', label: 'Zn1', fracCoords: [1 / 3, 2 / 3, 0], charge: '+2' },
      { element: 'Zn', label: 'Zn2', fracCoords: [2 / 3, 1 / 3, 0.5], charge: '+2' },
      { element: 'S', label: 'S1', fracCoords: [1 / 3, 2 / 3, 0.375], charge: '-2' },
      { element: 'S', label: 'S2', fracCoords: [2 / 3, 1 / 3, 0.875], charge: '-2' },
    ],
    bonds: [
      // Zn1(1/3,2/3,0) -> S1(1/3,2/3,0.375) axial
      { siteIndices: [0, 2], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 235 },
      // Zn1 -> S2 in adjacent cells (3 equatorial)
      { siteIndices: [0, 3], cellOffset: [0, 0, -1], bondType: 'ionic', expectedLength: 235 },
      { siteIndices: [0, 3], cellOffset: [-1, 0, -1], bondType: 'ionic', expectedLength: 235 },
      { siteIndices: [0, 3], cellOffset: [0, -1, -1], bondType: 'ionic', expectedLength: 235 },
      // Zn2(2/3,1/3,0.5) -> S2(2/3,1/3,0.875) axial
      { siteIndices: [1, 3], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 235 },
      // Zn2 -> S1 (3 equatorial)
      { siteIndices: [1, 2], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 235 },
      { siteIndices: [1, 2], cellOffset: [1, 0, 0], bondType: 'ionic', expectedLength: 235 },
      { siteIndices: [1, 2], cellOffset: [0, 1, 0], bondType: 'ionic', expectedLength: 235 },
    ],
    coordinationNumber: '4:4',
    coordinationGeometry: '正四面体',
    polyhedra: [
      { centerSiteIndex: 0, label: 'ZnS4', polyhedronType: 'tetrahedron', neighborCutoff: 2.5 },
      { centerSiteIndex: 1, label: 'ZnS4', polyhedronType: 'tetrahedron', neighborCutoff: 2.5 },
    ],
    teachingPoints: [
      '纤锌矿是ZnS的六方变体，与闪锌矿为多晶型关系',
      'Zn和S均为四面体配位（配位数4:4），与闪锌矿相同',
      '区别在于堆积方式：纤锌矿ABAB(HCP)，闪锌矿ABCABC(CCP)',
      '纤锌矿是ZnS的高温稳定相（>1020°C）',
      '许多II-VI族半导体采用纤锌矿结构（如GaN、AlN、ZnO）',
      'c/a比=1.638，接近理想值1.633',
    ],
    bondLengths: { 'Zn-S': 235 },
    codId: 9008878,
    dataSource: 'COD #9008878 — Wyckoff, Crystal Structures 1, 85-237 (1963)',
  },

  // CRY-017: Na (BCC)
  {
    id: 'CRY-017',
    name: '钠',
    formula: 'Na',
    formulaHtml: 'Na',
    category: 'metallic',
    gradeLevel: '高中必修',
    structureType: '体心立方(BCC)',
    crystalSystem: 'cubic',
    spaceGroup: 'Im3\u0304m',
    spaceGroupNumber: 229,
    lattice: { a: 422.5, b: 422.5, c: 422.5, alpha: 90, beta: 90, gamma: 90 },
    z: 2,
    atomSites: [
      { element: 'Na', label: 'Na1', fracCoords: [0, 0, 0] },
      { element: 'Na', label: 'Na2', fracCoords: [0.5, 0.5, 0.5] },
    ],
    bonds: [],
    neighborCutoff: 3.72,
    packingType: 'BCC',
    packingEfficiency: 68.02,
    coordinationNumber: '8',
    coordinationGeometry: '立方体',
    teachingPoints: [
      '体心立方(BCC)结构，配位数8，空间利用率68.02%',
      '每个晶胞含2个Na原子',
      '8个最近邻距离为a√3/2=372pm',
      'Na是典型的活泼金属，金属键较弱（密度低0.97g/cm³，熔点98°C）',
      '与α-Fe相同的BCC结构，但Na原子半径更大(186pm)',
      'Na可与Cl形成NaCl(CRY-001)，完全不同的结构类型',
    ],
    bondLengths: { 'Na-Na': 372 },
    codId: 9008544,
    dataSource: 'COD #9008544 — Wyckoff, Crystal Structures (1963), T=5K',
  },

  // CRY-018: I2 (Iodine)
  {
    id: 'CRY-018',
    name: '碘',
    formula: 'I2',
    formulaHtml: 'I<sub>2</sub>',
    category: 'molecular',
    gradeLevel: '高中选修',
    structureType: '分子晶体(正交)',
    crystalSystem: 'orthorhombic',
    spaceGroup: 'Cmca',
    spaceGroupNumber: 64,
    lattice: { a: 725.5, b: 479.5, c: 978, alpha: 90, beta: 90, gamma: 90 },
    z: 4,
    atomSites: [
      { element: 'I', label: 'I1a', fracCoords: [0.0, 0.1539, 0.1174] },
      { element: 'I', label: 'I1b', fracCoords: [0.0, 0.3461, 0.3826] },
      { element: 'I', label: 'I2a', fracCoords: [0.5, 0.6539, 0.1174] },
      { element: 'I', label: 'I2b', fracCoords: [0.5, 0.8461, 0.3826] },
      { element: 'I', label: 'I3a', fracCoords: [0.0, 0.8461, 0.6174] },
      { element: 'I', label: 'I3b', fracCoords: [0.0, 0.6539, 0.8826] },
      { element: 'I', label: 'I4a', fracCoords: [0.5, 0.3461, 0.6174] },
      { element: 'I', label: 'I4b', fracCoords: [0.5, 0.1539, 0.8826] },
    ],
    bonds: [
      // Intramolecular I-I covalent bonds (4 molecules)
      { siteIndices: [0, 1], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 267 },
      { siteIndices: [2, 3], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 267 },
      { siteIndices: [4, 5], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 267 },
      { siteIndices: [6, 7], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 267 },
      // Intermolecular van der Waals (representative nearest contacts)
      { siteIndices: [0, 2], cellOffset: [0, 0, 0], bondType: 'vanDerWaals', expectedLength: 350 },
      { siteIndices: [0, 4], cellOffset: [0, 0, 0], bondType: 'vanDerWaals', expectedLength: 350 },
      { siteIndices: [1, 3], cellOffset: [0, 0, 0], bondType: 'vanDerWaals', expectedLength: 350 },
      { siteIndices: [1, 5], cellOffset: [0, 0, 0], bondType: 'vanDerWaals', expectedLength: 350 },
    ],
    coordinationNumber: '1 (分子内)',
    coordinationGeometry: '哑铃形分子',
    teachingPoints: [
      'I2是典型的分子晶体，I-I共价键(267pm)在分子内，分子间靠范德华力',
      '碘分子排列在正交晶格中，每个晶胞含4个I2分子',
      '碘在常温下为紫黑色固体，易升华（分子间力弱）',
      '分子间最短距离约350pm，远大于I-I共价键长267pm',
      '碘分子的色散力较强（分子量大，电子云易极化）',
      '对比：碘的共价键(I-I 151kJ/mol) vs 分子间力(~40kJ/mol)',
    ],
    bondLengths: { 'I-I': 267 },
    codId: 1010091,
    dataSource: 'COD #1010091 — Harris, Mack & Blake (1928)',
  },

  // CRY-019: GaN
  {
    id: 'CRY-019',
    name: '氮化镓',
    formula: 'GaN',
    formulaHtml: 'GaN',
    category: 'atomic',
    gradeLevel: '拓展',
    structureType: '纤锌矿型',
    crystalSystem: 'hexagonal',
    spaceGroup: 'P6\u2083mc',
    spaceGroupNumber: 186,
    lattice: { a: 318.0, b: 318.0, c: 516.6, alpha: 90, beta: 90, gamma: 120 },
    z: 2,
    atomSites: [
      { element: 'Ga', label: 'Ga1', fracCoords: [1 / 3, 2 / 3, 0] },
      { element: 'Ga', label: 'Ga2', fracCoords: [2 / 3, 1 / 3, 0.5] },
      { element: 'N', label: 'N1', fracCoords: [1 / 3, 2 / 3, 0.385] },
      { element: 'N', label: 'N2', fracCoords: [2 / 3, 1 / 3, 0.885] },
    ],
    bonds: [
      // Ga1 -> N1 axial
      { siteIndices: [0, 2], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 195 },
      // Ga1 -> N2 equatorial (3 bonds)
      { siteIndices: [0, 3], cellOffset: [0, 0, -1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 195 },
      { siteIndices: [0, 3], cellOffset: [-1, 0, -1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 195 },
      { siteIndices: [0, 3], cellOffset: [0, -1, -1], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 195 },
      // Ga2 -> N2 axial
      { siteIndices: [1, 3], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 195 },
      // Ga2 -> N1 equatorial (3 bonds)
      { siteIndices: [1, 2], cellOffset: [0, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 195 },
      { siteIndices: [1, 2], cellOffset: [1, 0, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 195 },
      { siteIndices: [1, 2], cellOffset: [0, 1, 0], bondType: 'covalent-sigma', bondOrder: 1, expectedLength: 195 },
    ],
    coordinationNumber: '4',
    coordinationGeometry: '正四面体',
    hybridization: 'sp3',
    teachingPoints: [
      'GaN采用纤锌矿结构，与ZnS纤锌矿(CRY-016)同型',
      'Ga和N均为四面体配位（sp3杂化）',
      'Ga-N键长约195pm，键有部分离子性和部分共价性',
      'GaN是重要的第三代半导体（宽禁带3.4eV）',
      '蓝光LED和激光的核心材料（2014年诺贝尔物理学奖）',
      '应用于5G通信、电力电子、紫外探测等领域',
    ],
    bondLengths: { 'Ga-N': 195 },
    codId: 9008868,
    dataSource: 'COD #9008868 — Wyckoff, Crystal Structures 1, 85-237 (1963)',
  },

  // CRY-020: CuZn Beta-Brass
  {
    id: 'CRY-020',
    name: '\u03B2-黄铜',
    formula: 'CuZn',
    formulaHtml: 'CuZn (\u03B2-黄铜)',
    category: 'metallic',
    gradeLevel: '拓展',
    structureType: '有序BCC(CsCl型)',
    crystalSystem: 'cubic',
    spaceGroup: 'Pm3\u0304m',
    spaceGroupNumber: 221,
    lattice: { a: 294.5, b: 294.5, c: 294.5, alpha: 90, beta: 90, gamma: 90 },
    z: 1,
    atomSites: [
      { element: 'Cu', label: 'Cu1', fracCoords: [0, 0, 0] },
      { element: 'Zn', label: 'Zn1', fracCoords: [0.5, 0.5, 0.5] },
    ],
    bonds: [],
    neighborCutoff: 2.56,
    packingType: 'BCC',
    packingEfficiency: 68.02,
    coordinationNumber: '8',
    coordinationGeometry: '立方体',
    teachingPoints: [
      '\u03B2-黄铜采用CsCl型有序结构：Cu在顶点，Zn在体心',
      '与CsCl(CRY-002)结构类型相同，但为金属间化合物（金属键）',
      '每个Cu周围8个Zn最近邻，每个Zn周围8个Cu最近邻',
      'Cu-Zn距离为a√3/2=255pm',
      '高温下(>470°C)发生有序-无序转变，成为无序BCC合金',
      '合金是不同金属的混合，结构可与纯金属不同',
    ],
    bondLengths: { 'Cu-Zn': 255 },
    codId: 9008814,
    dataSource: 'COD #9008814 — Wyckoff, Crystal Structures 1, 85-237 (1963)',
  },

  // CRY-021: YBCO (YBa2Cu3O7)
  {
    id: 'CRY-021',
    name: '钇钡铜氧 (YBCO)',
    formula: 'YBa2Cu3O7',
    formulaHtml: 'YBa<sub>2</sub>Cu<sub>3</sub>O<sub>7</sub>',
    category: 'ionic',
    gradeLevel: '拓展',
    structureType: '钙钛矿衍生型',
    crystalSystem: 'orthorhombic',
    spaceGroup: 'Pmmm',
    spaceGroupNumber: 47,
    lattice: { a: 382.0, b: 388.5, c: 1168.3, alpha: 90, beta: 90, gamma: 90 },
    z: 1,
    atomSites: [
      { element: 'Y', label: 'Y1', fracCoords: [0.5, 0.5, 0.5], charge: '+3' },
      { element: 'Ba', label: 'Ba1', fracCoords: [0.5, 0.5, 0.184], charge: '+2' },
      { element: 'Ba', label: 'Ba2', fracCoords: [0.5, 0.5, 0.816], charge: '+2' },
      { element: 'Cu', label: 'Cu1', fracCoords: [0, 0, 0], charge: '+2' },
      { element: 'Cu', label: 'Cu2', fracCoords: [0, 0, 0.356], charge: '+2' },
      { element: 'Cu', label: 'Cu3', fracCoords: [0, 0, 0.644], charge: '+2' },
      { element: 'O', label: 'O1', fracCoords: [0, 0.5, 0], charge: '-2' },
      { element: 'O', label: 'O2', fracCoords: [0.5, 0, 0.378], charge: '-2' },
      { element: 'O', label: 'O3', fracCoords: [0, 0.5, 0.378], charge: '-2' },
      { element: 'O', label: 'O4', fracCoords: [0.5, 0, 0.622], charge: '-2' },
      { element: 'O', label: 'O5', fracCoords: [0, 0.5, 0.622], charge: '-2' },
      { element: 'O', label: 'O6', fracCoords: [0, 0.5, 0.159], charge: '-2' },
      { element: 'O', label: 'O7', fracCoords: [0, 0.5, 0.841], charge: '-2' },
    ],
    bonds: [
      // Cu1(0,0,0) -> O1(0,0.5,0) chain bonds
      { siteIndices: [3, 6], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 194 },
      { siteIndices: [3, 6], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 194 },
      // Cu2(0,0,0.356) -> O2(0.5,0,0.378)
      { siteIndices: [4, 7], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 196 },
      { siteIndices: [4, 7], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 196 },
      // Cu2(0,0,0.356) -> O3(0,0.5,0.378)
      { siteIndices: [4, 8], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 196 },
      { siteIndices: [4, 8], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 196 },
      // Cu2(0,0,0.356) -> O6(0,0.5,0.159) apical
      { siteIndices: [4, 11], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 230 },
      // Cu3(0,0,0.644) -> O4(0.5,0,0.622)
      { siteIndices: [5, 9], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 196 },
      { siteIndices: [5, 9], cellOffset: [-1, 0, 0], bondType: 'ionic', expectedLength: 196 },
      // Cu3(0,0,0.644) -> O5(0,0.5,0.622)
      { siteIndices: [5, 10], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 196 },
      { siteIndices: [5, 10], cellOffset: [0, -1, 0], bondType: 'ionic', expectedLength: 196 },
      // Cu3(0,0,0.644) -> O7(0,0.5,0.841) apical
      { siteIndices: [5, 12], cellOffset: [0, 0, 0], bondType: 'ionic', expectedLength: 230 },
    ],
    coordinationNumber: 'Cu1:4(平面), Cu2/Cu3:5(锥形)',
    coordinationGeometry: 'Cu1:平面正方形, Cu2/Cu3:四方锥',
    polyhedra: [
      { centerSiteIndex: 3, label: 'Cu1O4', polyhedronType: 'other', neighborCutoff: 2.0 },
      { centerSiteIndex: 4, label: 'Cu2O5', polyhedronType: 'other', neighborCutoff: 2.4 },
      { centerSiteIndex: 5, label: 'Cu3O5', polyhedronType: 'other', neighborCutoff: 2.4 },
    ],
    teachingPoints: [
      'YBCO是第一个液氮温区高温超导体（Tc=92K，超过液氮77K）',
      '结构由缺氧钙钛矿三层叠加而成：CuO链层-BaO层-CuO2面层-Y层-CuO2面层-BaO层-CuO链层',
      'CuO2面（Cu2/Cu3位置）是超导电性的关键层',
      'Cu1位于链位（平面四配位），Cu2/Cu3位于面位（四方锥五配位）',
      'O含量对超导性至关重要：YBa2Cu3O7为超导体，YBa2Cu3O6为绝缘体',
      '正交晶系(a≠b≠c)，由氧有序排列导致的对称性降低',
      '1987年发现，开启高温超导研究热潮',
    ],
    bondLengths: { 'Cu1-O': 194, 'Cu2-O(面内)': 196, 'Cu2-O(顶点)': 230 },
    codId: 1000030,
    dataSource: 'COD #1000030 — YBa₂Cu₃O₆.₉ (Pmmm)',
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Look up a crystal structure by its ID (e.g. "CRY-001").
 */
export function getCrystalById(id: string): CrystalStructure | undefined {
  return CRYSTAL_STRUCTURES.find((c) => c.id === id);
}

/**
 * Return all crystal structures belonging to a given category.
 */
export function getCrystalsByCategory(category: CrystalCategory): CrystalStructure[] {
  return CRYSTAL_STRUCTURES.filter((c) => c.category === category);
}
