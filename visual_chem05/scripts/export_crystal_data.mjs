import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, 'src', 'data', 'crystalStructures.ts');
const outputRoot = path.join(repoRoot, 'data', 'crystals');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanOutput() {
  ensureDir(outputRoot);
  for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      fs.rmSync(path.join(outputRoot, entry.name), { recursive: true, force: true });
    }
  }
}

function extractCrystalArray(sourceText) {
  const match = sourceText.match(
    /export const CRYSTAL_STRUCTURES:[\s\S]*?=\s*(\[[\s\S]*?\n\]);\n\n\/\/ ---------------------------------------------------------------------------\n\/\/ Helper functions/,
  );
  if (!match?.[1]) {
    throw new Error('Unable to locate CRYSTAL_STRUCTURES array.');
  }
  return match[1];
}

function loadStructures() {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const arrayLiteral = extractCrystalArray(sourceText);
  const sandbox = { CRYSTAL_STRUCTURES: [] };
  vm.runInNewContext(`CRYSTAL_STRUCTURES = ${arrayLiteral};`, sandbox);
  return sandbox.CRYSTAL_STRUCTURES;
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'crystal';
}

function inferPrimaryBondType(structure) {
  if (structure.bonds?.length) {
    return structure.bonds[0].bondType;
  }

  switch (structure.category) {
    case 'ionic':
      return 'ionic';
    case 'metallic':
      return 'metallic';
    case 'molecular':
      return 'vanDerWaals';
    default:
      return 'covalent-sigma';
  }
}

function inferRequirementSource(structure) {
  const c05Path = 'docs/需求文档md/C-05 化学键与晶体结构查看器 — 晶体结构数据.md';
  const prdPath = 'docs/需求文档md/C化学教具产品线 — 产品需求文档（PRD）.md';

  if (Number.parseInt(structure.id.replace('CRY-', ''), 10) <= 14) {
    return [c05Path, prdPath];
  }

  return [prdPath];
}

function createDocumentPayload(structure) {
  return {
    id: structure.id,
    slug: slugify(`${structure.id}-${structure.formula}-${structure.name}`),
    requirementSources: inferRequirementSource(structure),
    requirementSnapshot: {
      id: structure.id,
      name_cn: structure.name,
      formula: structure.formula,
      level: structure.gradeLevel,
      crystal_system: structure.crystalSystem,
      space_group: structure.spaceGroup,
      lattice_params: structure.lattice,
      atoms: structure.atomSites.map((site) => ({
        element: site.element,
        label: site.label ?? site.element,
        x: site.fracCoords[0],
        y: site.fracCoords[1],
        z: site.fracCoords[2],
        charge: site.charge ?? null,
      })),
      bond_type: inferPrimaryBondType(structure),
      coord_number: structure.coordinationNumber,
      z: structure.z,
      teaching_points: structure.teachingPoints,
      bond_lengths: structure.bondLengths ?? {},
      hybridization: structure.hybridization ?? null,
      render_hints: {
        default_render_mode: 'ballAndStick',
        supported_render_modes: ['ballAndStick', 'spaceFilling', 'polyhedral', 'wireframe'],
        show_unit_cell: true,
        show_bonds: true,
      },
    },
    viewerStructure: structure,
  };
}

function createDemoPayload(structure) {
  return {
    crystalId: structure.id,
    recommendedView: {
      expansionRange: { x: [0, 1], y: [0, 1], z: [0, 1] },
      renderMode: 'ballAndStick',
      showUnitCell: true,
      showBonds: true,
      showLabels: false,
    },
    animationClips: [
      {
        id: `${structure.id}-rotate`,
        label: '基础旋转展示',
        kind: 'orbit',
        durationMs: 6000,
      },
    ],
    packingReference: structure.packingType
      ? {
          type: structure.packingType,
          packingEfficiency: structure.packingEfficiency ?? null,
        }
      : null,
  };
}

function createMaterialsProjectPayload(structure, folderName) {
  return {
    crystalId: structure.id,
    folder: folderName,
    status: 'pending',
    apiSource: 'Materials Project mp-api',
    query: {
      formula: structure.formula,
      spaceGroupNumber: structure.spaceGroupNumber ?? null,
      structureType: structure.structureType,
    },
    materialId: null,
    downloadedAt: null,
    cifFile: 'materials-project.cif',
    notes: [
      'Pending download from Materials Project.',
      'If multiple polymorphs exist, select the candidate matching the requirement space group first.',
    ],
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const structures = loadStructures();
  cleanOutput();
  ensureDir(outputRoot);

  const manifest = [];

  for (const structure of structures) {
    const folderName = `${structure.id}_${slugify(structure.formula)}`;
    const folderPath = path.join(outputRoot, folderName);
    ensureDir(folderPath);

    writeJson(path.join(folderPath, 'document.json'), createDocumentPayload(structure));
    writeJson(path.join(folderPath, 'demo.json'), createDemoPayload(structure));
    writeJson(
      path.join(folderPath, 'materials-project.json'),
      createMaterialsProjectPayload(structure, folderName),
    );

    manifest.push({
      id: structure.id,
      folder: folderName,
      formula: structure.formula,
      name: structure.name,
      spaceGroupNumber: structure.spaceGroupNumber ?? null,
    });
  }

  writeJson(path.join(repoRoot, 'data', 'crystal-manifest.json'), manifest);
}

main();
