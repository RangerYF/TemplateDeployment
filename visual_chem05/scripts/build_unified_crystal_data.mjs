import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const originRoot = path.join(repoRoot, 'data_origin');
const originCrystalsRoot = path.join(originRoot, 'crystals');
const outputRoot = path.join(repoRoot, 'data');
const outputCrystalsRoot = path.join(outputRoot, 'crystals');
const sourceDocPath = path.join(repoRoot, 'docx', '晶体结构字段来源表.md');

const C05_DOC_PATH = 'docs/需求文档md/C-05 化学键与晶体结构查看器 — 晶体结构数据.md';
const PRD_DOC_PATH = 'docs/需求文档md/C化学教具产品线 — 产品需求文档（PRD）.md';

const C05_COVERED_IDS = new Set([
  'CRY-001', 'CRY-002', 'CRY-003', 'CRY-004', 'CRY-005', 'CRY-006', 'CRY-007',
  'CRY-008', 'CRY-009', 'CRY-010', 'CRY-011', 'CRY-012', 'CRY-013', 'CRY-014',
]);

const C05_ATOM_COORD_IDS = new Set([
  'CRY-001', 'CRY-002', 'CRY-003', 'CRY-004', 'CRY-005', 'CRY-008', 'CRY-009', 'CRY-010',
]);

const CRYSTAL_SYSTEM_LABELS = {
  cubic: '立方',
  tetragonal: '四方',
  hexagonal: '六方',
  orthorhombic: '正交',
  monoclinic: '单斜',
  triclinic: '三斜',
  trigonal: '三方',
};

const BOND_LABELS = {
  ionic: '离子键',
  'covalent-sigma': '共价键（σ键）',
  'covalent-pi': '共价键（π键）',
  metallic: '金属键',
  hydrogen: '氢键',
  vanDerWaals: '分子间作用力（范德华力）',
};

const DOC_KEY_PARAMETERS = {
  'CRY-001': [
    { id: 'structure_type', label: '结构类型', value: '岩盐型' },
  ],
  'CRY-002': [
    { id: 'structure_type', label: '结构类型', value: '氯化铯型（体心立方）' },
  ],
  'CRY-003': [
    { id: 'structure_type', label: '结构类型', value: '萤石型' },
  ],
  'CRY-004': [
    { id: 'structure_type', label: '结构类型', value: '金红石型' },
  ],
  'CRY-005': [
    { id: 'bond_length_c_c', label: '键长', value: 'C-C: 154 pm' },
    { id: 'bond_angle', label: '键角', value: '109.5°' },
    { id: 'hybridization', label: '杂化', value: 'sp³' },
  ],
  'CRY-006': [
    { id: 'bond_length_si_o', label: '键长', value: 'Si-O: 161 pm' },
    { id: 'bond_angle_o_si_o', label: '键角', value: 'O-Si-O: 109.5°' },
    { id: 'bond_angle_si_o_si', label: '键角', value: 'Si-O-Si: 144°' },
  ],
  'CRY-007': [
    { id: 'polymorph', label: '晶胞参数（3C）', value: 'a = 436 pm' },
    { id: 'bond_length_si_c', label: '键长', value: 'Si-C: 189 pm' },
  ],
  'CRY-008': [
    { id: 'packing_sequence', label: '堆积方式', value: 'ABCABC（面心立方密堆积）' },
    { id: 'packing_efficiency', label: '空间利用率', value: '74.05%' },
  ],
  'CRY-009': [
    { id: 'packing_sequence', label: '堆积方式', value: '体心立方（非密堆积）' },
    { id: 'packing_efficiency', label: '空间利用率', value: '68.02%' },
  ],
  'CRY-010': [
    { id: 'packing_sequence', label: '堆积方式', value: 'ABABAB（六方密堆积）' },
    { id: 'packing_efficiency', label: '空间利用率', value: '74.05%' },
  ],
  'CRY-011': [
    { id: 'hydrogen_bond_distance', label: 'O-H···O 距离', value: '276 pm' },
    { id: 'density', label: '密度', value: '0.917 g/cm³（低于液态水）' },
  ],
  'CRY-012': [
    { id: 'intermolecular_force', label: '分子间作用力', value: '范德华力' },
    { id: 'sublimation_temperature', label: '升华温度', value: '-78.5°C' },
  ],
  'CRY-013': [
    { id: 'bond_length_in_plane', label: '层内 C-C 键长', value: '142 pm' },
    { id: 'layer_spacing', label: '层间距', value: '335 pm' },
    { id: 'bond_angle', label: '键角', value: '120°（层内）' },
    { id: 'hybridization', label: '杂化', value: 'sp²' },
  ],
  'CRY-014': [
    { id: 'structure_feature', label: '结构特征', value: 'Cl⁻ 层 - Cd²⁺ 层 - Cl⁻ 层交替' },
  ],
};

const RENDER_NOTES = {
  'CRY-011': '当前渲染为教学简化的氢键网络模型，场景中保留 O 位点与氢键拓扑；真实 H 原子坐标已在 data_origin/materials-project.cif 中保留但未直接用于当前渲染。',
};

const AUTO_BOND_REFERENCE_IDS = new Set([
  'CRY-003',
  'CRY-004',
  'CRY-006',
  'CRY-014',
  'CRY-015',
  'CRY-016',
  'CRY-019',
  'CRY-021',
]);

const AUTO_COORDINATION_SPECS = {
  'CRY-005': {
    bondType: 'covalent-sigma',
    targetsByElement: { C: 4 },
    allowSameElement: true,
  },
  'CRY-003': {
    bondType: 'ionic',
    targetsByElement: { Ca: 8, F: 4 },
  },
  'CRY-004': {
    bondType: 'ionic',
    targetsByElement: { Ti: 6, O: 3 },
  },
  'CRY-006': {
    bondType: 'covalent-sigma',
    targetsByElement: { Si: 4, O: 2 },
  },
  'CRY-014': {
    bondType: 'ionic',
    targetsByElement: { Cd: 6, Cl: 3 },
  },
  'CRY-015': {
    bondType: 'ionic',
    targetsByElement: { Zn: 4, S: 4 },
  },
  'CRY-016': {
    bondType: 'ionic',
    targetsByElement: { Zn: 4, S: 4 },
  },
  'CRY-019': {
    bondType: 'covalent-sigma',
    targetsByElement: { Ga: 4, N: 4 },
  },
  'CRY-021': {
    bondType: 'ionic',
    targetsByLabel: {
      Y1: 8,
      Ba1: 8,
      Ba2: 8,
      Cu2: 5,
      Cu3: 5,
    },
    manualBonds: [
      { from_atom_id: 'Cu1', to_atom_id: 'O1', cell_offset: [0, 0, 0] },
      { from_atom_id: 'Cu1', to_atom_id: 'O1', cell_offset: [0, -1, 0] },
      { from_atom_id: 'Cu1', to_atom_id: 'O6', cell_offset: [0, 0, 0] },
      { from_atom_id: 'Cu1', to_atom_id: 'O7', cell_offset: [0, 0, -1] },
    ],
  },
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetOutputDir() {
  ensureDir(outputCrystalsRoot);
  for (const entry of fs.readdirSync(outputCrystalsRoot, { withFileTypes: true })) {
    if (entry.isFile()) {
      fs.rmSync(path.join(outputCrystalsRoot, entry.name), { force: true });
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, 'utf8');
}

function formatFormulaHtml(formula) {
  return formula.replace(/(\d+)/g, '<sub>$1</sub>');
}

function formatFraction(value) {
  const known = [
    [0, '0'],
    [0.125, '1/8'],
    [0.25, '1/4'],
    [1 / 3, '1/3'],
    [0.375, '3/8'],
    [0.5, '1/2'],
    [0.625, '5/8'],
    [2 / 3, '2/3'],
    [0.75, '3/4'],
    [0.875, '7/8'],
    [1, '1'],
  ];

  for (const [target, label] of known) {
    if (Math.abs(value - target) < 1e-6) {
      return label;
    }
  }

  return `${value}`;
}

function normalizePackingEfficiency(value) {
  if (typeof value !== 'number') {
    return null;
  }
  return value > 1 ? value / 100 : value;
}

function buildLatticeMatrix(lattice) {
  const deg = Math.PI / 180;
  const alpha = lattice.alpha * deg;
  const beta = lattice.beta * deg;
  const gamma = lattice.gamma * deg;
  const ax = lattice.a / 100;
  const by = lattice.b / 100;
  const cz = lattice.c / 100;

  const cosAlpha = Math.cos(alpha);
  const cosBeta = Math.cos(beta);
  const cosGamma = Math.cos(gamma);
  const sinGamma = Math.sin(gamma);

  const aVec = [ax, 0, 0];
  const bVec = [by * cosGamma, by * sinGamma, 0];
  const cX = cz * cosBeta;
  const cY = cz * (cosAlpha - cosBeta * cosGamma) / sinGamma;
  const cZ = Math.sqrt(Math.max(0, cz * cz - cX * cX - cY * cY));

  return [aVec, bVec, [cX, cY, cZ]];
}

function fracToCart(fracCoords, matrix) {
  return [
    fracCoords[0] * matrix[0][0] + fracCoords[1] * matrix[1][0] + fracCoords[2] * matrix[2][0],
    fracCoords[0] * matrix[0][1] + fracCoords[1] * matrix[1][1] + fracCoords[2] * matrix[2][1],
    fracCoords[0] * matrix[0][2] + fracCoords[1] * matrix[1][2] + fracCoords[2] * matrix[2][2],
  ];
}

function distance3(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function canonicalBondKey(fromIndex, toIndex, offset) {
  const direct = `${fromIndex}|${toIndex}|${offset.join(',')}`;
  const reverse = `${toIndex}|${fromIndex}|${[-offset[0], -offset[1], -offset[2]].join(',')}`;
  return direct < reverse ? direct : reverse;
}

function localizedCrystalSystem(viewer) {
  if (viewer.id === 'CRY-006') {
    return '三方（六方格子）';
  }
  return CRYSTAL_SYSTEM_LABELS[viewer.crystalSystem] ?? viewer.crystalSystem;
}

function displaySpaceGroup(viewer) {
  if (viewer.spaceGroupNumber) {
    return `${viewer.spaceGroup} (No. ${viewer.spaceGroupNumber})`;
  }
  return viewer.spaceGroup;
}

function uniqueBondTypes(viewer, renderBonds = []) {
  const types = new Set(renderBonds.map((bond) => bond.type));
  if (types.size === 0) {
    for (const bond of viewer.bonds) {
      types.add(bond.bondType);
    }
  }
  if (types.size === 0 && viewer.fallbackBondType) {
    types.add(viewer.fallbackBondType);
  }
  if (types.size === 0 && viewer.neighborCutoff) {
    switch (viewer.category) {
      case 'ionic':
        types.add('ionic');
        break;
      case 'metallic':
        types.add('metallic');
        break;
      case 'molecular':
        types.add('vanDerWaals');
        break;
      default:
        types.add('covalent-sigma');
        break;
    }
  }
  return Array.from(types);
}

function displayBondType(viewer, renderBonds = []) {
  const labels = uniqueBondTypes(viewer, renderBonds)
    .map((type) => BOND_LABELS[type] ?? type);
  return labels.join(' + ');
}

function buildKeyParameters(viewer) {
  if (DOC_KEY_PARAMETERS[viewer.id]) {
    return DOC_KEY_PARAMETERS[viewer.id];
  }

  const derived = [];
  if (viewer.structureType) {
    derived.push({ id: 'structure_type', label: '结构类型', value: viewer.structureType });
  }
  if (viewer.bondLengths) {
    for (const [label, value] of Object.entries(viewer.bondLengths)) {
      derived.push({
        id: `bond_length_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        label: '键长',
        value: `${label}: ${value} pm`,
      });
    }
  }
  if (viewer.hybridization) {
    derived.push({ id: 'hybridization', label: '杂化', value: viewer.hybridization });
  }
  if (viewer.packingType) {
    derived.push({ id: 'packing_type', label: '堆积方式', value: viewer.packingType });
  }
  if (viewer.packingEfficiency != null) {
    const normalized = normalizePackingEfficiency(viewer.packingEfficiency);
    if (normalized != null) {
      derived.push({
        id: 'packing_efficiency',
        label: '空间利用率',
        value: `${(normalized * 100).toFixed(2)}%`,
      });
    }
  }
  return derived;
}

function buildAtoms(viewer) {
  return viewer.atomSites.map((site) => ({
    id: site.label ?? site.element,
    element: site.element,
    label: site.label ?? site.element,
    x: site.fracCoords[0],
    y: site.fracCoords[1],
    z: site.fracCoords[2],
    x_expr: formatFraction(site.fracCoords[0]),
    y_expr: formatFraction(site.fracCoords[1]),
    z_expr: formatFraction(site.fracCoords[2]),
    charge: site.charge ?? null,
    color_override: site.colorOverride ?? null,
    radius_override_angstrom: site.radiusOverride ?? null,
  }));
}

function buildManualRenderBonds(viewer) {
  return viewer.bonds.map((bond, index) => {
    const from = viewer.atomSites[bond.siteIndices[0]];
    const to = viewer.atomSites[bond.siteIndices[1]];

    return {
      id: `BOND-${String(index + 1).padStart(3, '0')}`,
      from_atom_id: from?.label ?? `${bond.siteIndices[0]}`,
      to_atom_id: to?.label ?? `${bond.siteIndices[1]}`,
      cell_offset: bond.cellOffset ?? [0, 0, 0],
      type: bond.bondType,
      order: bond.bondOrder ?? null,
      expected_length_pm: bond.expectedLength ?? null,
    };
  });
}

function buildAutoCoordinationBonds(viewer) {
  const spec = AUTO_COORDINATION_SPECS[viewer.id];
  if (!spec) {
    return null;
  }

  const matrix = buildLatticeMatrix(viewer.lattice);
  const atoms = viewer.atomSites.map((site) => ({
    id: site.label ?? site.element,
    element: site.element,
    fracCoords: site.fracCoords,
  }));
  const labelToIndex = new Map(atoms.map((atom, index) => [atom.id, index]));
  const seen = new Set();
  const generated = [];

  function pushBond(fromAtomId, toAtomId, offset, bondType) {
    const fromIndex = labelToIndex.get(fromAtomId);
    const toIndex = labelToIndex.get(toAtomId);
    if (fromIndex === undefined || toIndex === undefined) {
      return;
    }

    const key = canonicalBondKey(fromIndex, toIndex, offset);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const fromCart = fracToCart(atoms[fromIndex].fracCoords, matrix);
    const toCart = fracToCart(
      [
        atoms[toIndex].fracCoords[0] + offset[0],
        atoms[toIndex].fracCoords[1] + offset[1],
        atoms[toIndex].fracCoords[2] + offset[2],
      ],
      matrix,
    );

    generated.push({
      id: '',
      from_atom_id: fromAtomId,
      to_atom_id: toAtomId,
      cell_offset: offset,
      type: bondType,
      order: null,
      expected_length_pm: Math.round(distance3(fromCart, toCart) * 100),
    });
  }

  for (const atom of atoms) {
    const targetCount = spec.targetsByLabel?.[atom.id] ?? spec.targetsByElement?.[atom.element];
    if (!targetCount) {
      continue;
    }

    const fromCart = fracToCart(atom.fracCoords, matrix);
    const candidates = [];

    for (const otherAtom of atoms) {
      if (otherAtom.id === atom.id) {
        continue;
      }
      if (otherAtom.element === atom.element && !spec.allowSameElement) {
        continue;
      }

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            const offset = [dx, dy, dz];
            const otherCart = fracToCart(
              [
                otherAtom.fracCoords[0] + dx,
                otherAtom.fracCoords[1] + dy,
                otherAtom.fracCoords[2] + dz,
              ],
              matrix,
            );
            const distance = distance3(fromCart, otherCart);
            if (distance < 1e-6) {
              continue;
            }
            candidates.push({
              to_atom_id: otherAtom.id,
              cell_offset: offset,
              distance,
            });
          }
        }
      }
    }

    candidates.sort((a, b) =>
      a.distance - b.distance ||
      a.to_atom_id.localeCompare(b.to_atom_id) ||
      a.cell_offset[0] - b.cell_offset[0] ||
      a.cell_offset[1] - b.cell_offset[1] ||
      a.cell_offset[2] - b.cell_offset[2],
    );

    for (const candidate of candidates.slice(0, targetCount)) {
      pushBond(atom.id, candidate.to_atom_id, candidate.cell_offset, spec.bondType);
    }
  }

  if (spec.manualBonds) {
    for (const bond of spec.manualBonds) {
      pushBond(bond.from_atom_id, bond.to_atom_id, bond.cell_offset, spec.bondType);
    }
  }

  if (spec.preserveTypes?.length) {
    const preserved = buildManualRenderBonds(viewer)
      .filter((bond) => spec.preserveTypes.includes(bond.type));
    for (const bond of preserved) {
      pushBond(bond.from_atom_id, bond.to_atom_id, bond.cell_offset ?? [0, 0, 0], bond.type);
    }
  }

  return generated
    .map((bond, index) => ({
      ...bond,
      id: `BOND-${String(index + 1).padStart(3, '0')}`,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildRenderBonds(viewer) {
  if (viewer.id === 'CRY-013') {
    return [
      { from_atom_id: 'C1', to_atom_id: 'C2', cell_offset: [0, 0, 0], type: 'covalent-sigma', order: 1.5, expected_length_pm: 142 },
      { from_atom_id: 'C1', to_atom_id: 'C2', cell_offset: [0, -1, 0], type: 'covalent-sigma', order: 1.5, expected_length_pm: 142 },
      { from_atom_id: 'C1', to_atom_id: 'C2', cell_offset: [-1, -1, 0], type: 'covalent-sigma', order: 1.5, expected_length_pm: 142 },
      { from_atom_id: 'C3', to_atom_id: 'C4', cell_offset: [0, 0, 0], type: 'covalent-sigma', order: 1.5, expected_length_pm: 142 },
      { from_atom_id: 'C3', to_atom_id: 'C4', cell_offset: [-1, 0, 0], type: 'covalent-sigma', order: 1.5, expected_length_pm: 142 },
      { from_atom_id: 'C3', to_atom_id: 'C4', cell_offset: [-1, -1, 0], type: 'covalent-sigma', order: 1.5, expected_length_pm: 142 },
    ].map((bond, index) => ({
      id: `BOND-${String(index + 1).padStart(3, '0')}`,
      ...bond,
    }));
  }

  return buildAutoCoordinationBonds(viewer) ?? buildManualRenderBonds(viewer);
}

function buildRenderPolyhedra(viewer) {
  if (!viewer.polyhedra?.length) {
    return [];
  }

  return viewer.polyhedra.map((polyhedron, index) => {
    const center = viewer.atomSites[polyhedron.centerSiteIndex];
    return {
      id: `POLY-${String(index + 1).padStart(3, '0')}`,
      center_atom_id: center?.label ?? `${polyhedron.centerSiteIndex}`,
      label: polyhedron.label,
      polyhedron_type: polyhedron.polyhedronType,
      neighbor_cutoff_angstrom: polyhedron.neighborCutoff,
    };
  });
}

function buildReferences(originFolderName, viewer, materialsProject) {
  const references = [];

  if (C05_COVERED_IDS.has(viewer.id)) {
    references.push({
      id: 'c05',
      label: 'C-05 化学键与晶体结构查看器 — 晶体结构数据.md',
      type: 'document',
      path: C05_DOC_PATH,
    });
  }

  references.push({
    id: 'prd',
    label: 'C化学教具产品线 — 产品需求文档（PRD）.md',
    type: 'document',
    path: PRD_DOC_PATH,
  });

  references.push({
    id: 'origin',
    label: `data_origin/crystals/${originFolderName}/document.json`,
    type: 'origin',
    path: `data_origin/crystals/${originFolderName}/document.json`,
  });

  if (viewer.dataSource || viewer.codId) {
    references.push({
      id: 'cod',
      label: viewer.dataSource ?? `COD #${viewer.codId}`,
      type: 'database',
      url: viewer.codId ? `https://www.crystallography.net/cod/${viewer.codId}.html` : null,
    });
  }

  if (materialsProject?.materialId) {
    references.push({
      id: 'mp',
      label: `Materials Project ${materialsProject.materialId}`,
      type: 'database',
      url: materialsProject.sourceUrl ?? null,
    });
  }

  references.push({
    id: 'chem',
    label: '基于结构类别、显式键定义和教师教学口径的化学类型整理',
    type: 'inference',
  });

  if (AUTO_BOND_REFERENCE_IDS.has(viewer.id)) {
    references.push({
      id: 'coordination_auto',
      label: '按最近异种原子第一配位层与目标配位数自动生成键连关系',
      type: 'inference',
    });
  }

  if (RENDER_NOTES[viewer.id]) {
    references.push({
      id: 'render_note',
      label: '渲染表示说明',
      type: 'note',
    });
  }

  return references;
}

function buildFieldSources(viewer) {
  const fieldSources = {
    id: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin'],
    name_cn: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'prd'],
    formula: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'prd'],
    level: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'prd', 'origin'] : ['prd', 'origin'],
    crystal_system: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'cod', 'mp'],
    space_group: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'cod', 'mp'],
    lattice_params: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'cod', 'mp'],
    atoms: C05_ATOM_COORD_IDS.has(viewer.id)
      ? ['c05', 'origin']
      : ['origin', 'cod', 'mp'],
    bond_type: ['chem', ...(C05_COVERED_IDS.has(viewer.id) ? ['c05'] : []), 'origin'],
    coord_number: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'cod'],
    z: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'cod', 'mp'],
    teaching_points: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'prd'],
    key_parameters: C05_COVERED_IDS.has(viewer.id) ? ['c05', 'origin'] : ['origin', 'prd', 'cod', 'mp'],
    'render.category': ['origin', 'prd'],
    'render.structure_type': ['origin', ...(C05_COVERED_IDS.has(viewer.id) ? ['c05'] : [])],
    'render.crystal_system_code': ['origin'],
    'render.space_group_symbol': ['origin', 'cod', 'mp'],
    'render.space_group_number': ['origin', 'cod', 'mp'],
    'render.bond_generation': ['origin'],
    'render.fallback_bond_type': ['origin', 'chem'],
    'render.neighbor_cutoff_angstrom': ['origin'],
    'render.bonds': ['origin', 'chem', ...(AUTO_BOND_REFERENCE_IDS.has(viewer.id) ? ['coordination_auto'] : []), 'cod', 'mp'],
    'render.polyhedra': ['origin'],
    'render.coordination_geometry': ['origin'],
    'render.bond_lengths_pm': ['origin', ...(C05_COVERED_IDS.has(viewer.id) ? ['c05'] : [])],
    'render.hybridization': ['origin', ...(C05_COVERED_IDS.has(viewer.id) ? ['c05'] : [])],
    'render.packing_type': ['origin', ...(C05_COVERED_IDS.has(viewer.id) ? ['c05'] : [])],
    'render.packing_efficiency': ['origin', ...(C05_COVERED_IDS.has(viewer.id) ? ['c05'] : [])],
    'render.data_source': ['origin', 'cod', 'mp'],
    'render.representation_note': RENDER_NOTES[viewer.id] ? ['render_note', 'origin'] : ['origin'],
  };

  return fieldSources;
}

function buildUnifiedRecord(originFolderName, originDocument, materialsProject) {
  const viewer = originDocument.viewerStructure;
  const renderBonds = buildRenderBonds(viewer);
  const keyParameters = buildKeyParameters(viewer);
  const packingEfficiency = normalizePackingEfficiency(viewer.packingEfficiency);
  const uniqueTypes = uniqueBondTypes(viewer, renderBonds);
  const primaryType = uniqueTypes[0] ?? null;

  const sourceSummary = [
    C05_COVERED_IDS.has(viewer.id) ? 'C-05 数据文档' : null,
    viewer.dataSource ?? null,
    materialsProject?.materialId ? `Materials Project ${materialsProject.materialId}` : null,
  ].filter(Boolean).join(' + ');

  return {
    id: viewer.id,
    name_cn: viewer.name,
    formula: viewer.formula,
    level: viewer.gradeLevel,
    crystal_system: localizedCrystalSystem(viewer),
    space_group: displaySpaceGroup(viewer),
    lattice_params: {
      a: viewer.lattice.a,
      b: viewer.lattice.b,
      c: viewer.lattice.c,
      alpha: viewer.lattice.alpha,
      beta: viewer.lattice.beta,
      gamma: viewer.lattice.gamma,
    },
    atoms: buildAtoms(viewer),
    bond_type: displayBondType(viewer, renderBonds),
    coord_number: viewer.coordinationNumber,
    z: viewer.z,
    teaching_points: viewer.teachingPoints,
    key_parameters: keyParameters,
    render: {
      category: viewer.category,
      name: viewer.name,
      formula_html: viewer.formulaHtml ?? formatFormulaHtml(viewer.formula),
      grade_level: viewer.gradeLevel,
      structure_type: viewer.structureType ?? null,
      crystal_system_code: viewer.crystalSystem,
      space_group_symbol: viewer.spaceGroup,
      space_group_number: viewer.spaceGroupNumber ?? null,
      bond_generation: 'explicit',
      fallback_bond_type: viewer.fallbackBondType ?? primaryType,
      neighbor_cutoff_angstrom: viewer.neighborCutoff ?? null,
      bond_types: uniqueTypes,
      bonds: renderBonds,
      polyhedra: buildRenderPolyhedra(viewer),
      coordination_geometry: viewer.coordinationGeometry ?? null,
      bond_lengths_pm: viewer.bondLengths ?? {},
      hybridization: viewer.hybridization ?? null,
      packing_type: viewer.packingType ?? null,
      packing_efficiency: packingEfficiency,
      data_source: viewer.dataSource ?? null,
      mp_material_id: materialsProject?.materialId ?? null,
      representation_note: RENDER_NOTES[viewer.id] ?? null,
      source_summary: sourceSummary || null,
    },
    provenance: {
      references: buildReferences(originFolderName, viewer, materialsProject),
      field_sources: buildFieldSources(viewer),
    },
  };
}

function flattenFieldRows(record) {
  return [
    ['id', record.id],
    ['name_cn', record.name_cn],
    ['formula', record.formula],
    ['level', record.level],
    ['crystal_system', record.crystal_system],
    ['space_group', record.space_group],
    ['lattice_params', `a=${record.lattice_params.a}, b=${record.lattice_params.b}, c=${record.lattice_params.c}`],
    ['atoms', `${record.atoms.length} 个原子位点`],
    ['bond_type', record.bond_type],
    ['coord_number', record.coord_number],
    ['z', `${record.z}`],
    ['teaching_points', `${record.teaching_points.length} 条`],
    ['key_parameters', `${record.key_parameters.length} 项`],
    ['render.category', record.render.category],
    ['render.structure_type', record.render.structure_type ?? '—'],
    ['render.crystal_system_code', record.render.crystal_system_code],
    ['render.space_group_symbol', record.render.space_group_symbol],
    ['render.space_group_number', record.render.space_group_number ?? '—'],
    ['render.bond_generation', record.render.bond_generation],
    ['render.fallback_bond_type', record.render.fallback_bond_type ?? '—'],
    ['render.neighbor_cutoff_angstrom', record.render.neighbor_cutoff_angstrom ?? '—'],
    ['render.bonds', `${record.render.bonds.length} 条`],
    ['render.polyhedra', `${record.render.polyhedra.length} 个`],
    ['render.coordination_geometry', record.render.coordination_geometry ?? '—'],
    ['render.bond_lengths_pm', Object.keys(record.render.bond_lengths_pm).length ? Object.entries(record.render.bond_lengths_pm).map(([k, v]) => `${k}:${v}`).join('; ') : '—'],
    ['render.hybridization', record.render.hybridization ?? '—'],
    ['render.packing_type', record.render.packing_type ?? '—'],
    ['render.packing_efficiency', record.render.packing_efficiency != null ? `${(record.render.packing_efficiency * 100).toFixed(2)}%` : '—'],
    ['render.data_source', record.render.data_source ?? '—'],
    ['render.mp_material_id', record.render.mp_material_id ?? '—'],
    ['render.representation_note', record.render.representation_note ?? '—'],
  ];
}

function renderSourceTable(records) {
  const sections = [
    '# 晶体结构字段来源表',
    '',
    '> 自动生成于 `scripts/build_unified_crystal_data.mjs`',
    '',
  ];

  for (const record of records) {
    const refs = new Map(record.provenance.references.map((ref) => [ref.id, ref]));
    sections.push(`## ${record.id} ${record.name_cn}`);
    sections.push('');
    sections.push('| 字段 | 当前值摘要 | 来源 | 备注 |');
    sections.push('|------|------------|------|------|');

    for (const [field, summary] of flattenFieldRows(record)) {
      const refIds = record.provenance.field_sources[field] ?? ['origin'];
      const sourceText = refIds
        .map((refId) => refs.get(refId)?.label ?? refId)
        .join(' + ');
      sections.push(`| ${field} | ${summary} | ${sourceText} | — |`);
    }

    if (record.key_parameters.length > 0) {
      for (const parameter of record.key_parameters) {
        const refIds = record.provenance.field_sources.key_parameters ?? ['origin'];
        const sourceText = refIds
          .map((refId) => refs.get(refId)?.label ?? refId)
          .join(' + ');
        sections.push(`| key_parameters.${parameter.id} | ${parameter.label}: ${parameter.value} | ${sourceText} | — |`);
      }
    }

    sections.push('');
    sections.push('参考来源：');
    for (const ref of record.provenance.references) {
      const target = ref.path ?? ref.url ?? '';
      sections.push(`- ${ref.id}: ${ref.label}${target ? ` (${target})` : ''}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

function renderReadme(records) {
  return [
    '# Unified Crystal Data',
    '',
    '本目录为 C-05 统一晶体数据层。',
    '',
    '## 设计原则',
    '',
    '- 顶层字段对齐 `C-05 化学键与晶体结构查看器 — 晶体结构数据.md` 的字段命名与教学口径。',
    '- `render` 段维护渲染必需的结构化字段，避免运行时再依赖 CIF 模式推断。',
    '- `provenance` 段维护字段来源，用于生成字段来源对照文档。',
    '',
    '## 文件结构',
    '',
    '- `crystals/*.json`: 每个晶体一个 JSON。',
    '- `crystal-manifest.json`: 列表索引。',
    '',
    '## 顶层字段',
    '',
    '| 字段 | 类型 | 说明 |',
    '|------|------|------|',
    '| `id` | `string` | 编号 `CRY-XXX` |',
    '| `name_cn` | `string` | 中文名 |',
    '| `formula` | `string` | 化学式 |',
    '| `level` | `string` | 学段 |',
    '| `crystal_system` | `string` | 晶系（按 C-05 文档中文口径） |',
    '| `space_group` | `string` | 空间群（含 No. 编号） |',
    '| `lattice_params` | `object` | 晶胞参数 a, b, c (pm), α, β, γ (°) |',
    '| `atoms` | `array` | 原子分数坐标与电荷信息 |',
    '| `bond_type` | `string` | 教学展示主键类型 / 组合键类型 |',
    '| `coord_number` | `string` | 配位数展示值 |',
    '| `z` | `number` | 每晶胞化学式单位数 |',
    '| `teaching_points` | `array` | 教学要点 |',
    '| `key_parameters` | `array` | C-05 文档中各晶体额外参数行的结构化维护 |',
    '| `render` | `object` | 渲染层字段 |',
    '| `provenance` | `object` | 字段来源引用 |',
    '',
    '## 统计',
    '',
    `- 晶体总数: ${records.length}`,
    `- 覆盖 C-05 文档模型: ${records.filter((record) => C05_COVERED_IDS.has(record.id)).length}`,
    '',
  ].join('\n');
}

function main() {
  ensureDir(outputRoot);
  ensureDir(outputCrystalsRoot);
  resetOutputDir();

  const records = [];

  for (const entry of fs.readdirSync(originCrystalsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const originFolderName = entry.name;
    const originDir = path.join(originCrystalsRoot, originFolderName);
    const originDocument = readJson(path.join(originDir, 'document.json'));
    const materialsProjectPath = path.join(originDir, 'materials-project.json');
    const materialsProject = fs.existsSync(materialsProjectPath) ? readJson(materialsProjectPath) : null;

    const record = buildUnifiedRecord(originFolderName, originDocument, materialsProject);
    const outputName = `${originFolderName}.json`;
    writeJson(path.join(outputCrystalsRoot, outputName), record);

    records.push({
      ...record,
      file_name: outputName,
    });
  }

  records.sort((a, b) => a.id.localeCompare(b.id));

  writeJson(
    path.join(outputRoot, 'crystal-manifest.json'),
    records.map((record) => ({
      id: record.id,
      file_name: record.file_name,
      name_cn: record.name_cn,
      formula: record.formula,
      level: record.level,
      category: record.render.category,
    })),
  );

  writeText(path.join(outputRoot, 'README.md'), renderReadme(records));
  writeText(sourceDocPath, renderSourceTable(records));
}

main();
