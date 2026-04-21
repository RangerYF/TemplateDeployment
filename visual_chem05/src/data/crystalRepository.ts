import type {
  AtomSite,
  BondDefinition,
  BondType,
  CrystalCategory,
  CrystalStructure,
  GradeLevel,
  PolyhedronDef,
} from '@/engine/types';
import type { UnifiedCrystalRecord } from '@/data/unifiedCrystalTypes';

const recordModules = import.meta.glob('/data/crystals/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, UnifiedCrystalRecord>;

function inferFallbackBondType(record: UnifiedCrystalRecord): BondType | undefined {
  if (record.render.fallback_bond_type) {
    return record.render.fallback_bond_type;
  }

  if (record.render.bond_types.length > 0) {
    return record.render.bond_types[0];
  }

  switch (record.render.category) {
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

function mapAtoms(record: UnifiedCrystalRecord): AtomSite[] {
  return record.atoms.map((atom) => ({
    element: atom.element,
    label: atom.label,
    fracCoords: [atom.x, atom.y, atom.z],
    colorOverride: atom.color_override ?? undefined,
    radiusOverride: atom.radius_override_angstrom ?? undefined,
    charge: atom.charge ?? undefined,
  }));
}

function mapBonds(record: UnifiedCrystalRecord): BondDefinition[] {
  const labelToIndex = new Map(record.atoms.map((atom, index) => [atom.id, index]));

  return record.render.bonds.flatMap((bond): BondDefinition[] => {
      const fromIndex = labelToIndex.get(bond.from_atom_id);
      const toIndex = labelToIndex.get(bond.to_atom_id);

      if (fromIndex === undefined || toIndex === undefined) {
        return [];
      }

      return [{
        siteIndices: [fromIndex, toIndex],
        cellOffset: bond.cell_offset ?? [0, 0, 0],
        bondType: bond.type,
        bondOrder: bond.order ?? undefined,
        expectedLength: bond.expected_length_pm ?? undefined,
      }];
    });
}

function mapPolyhedra(record: UnifiedCrystalRecord): PolyhedronDef[] | undefined {
  if (!record.render.polyhedra.length) {
    return undefined;
  }

  const labelToIndex = new Map(record.atoms.map((atom, index) => [atom.id, index]));

  const mapped = record.render.polyhedra.flatMap((polyhedron): PolyhedronDef[] => {
      const centerSiteIndex = labelToIndex.get(polyhedron.center_atom_id);
      if (centerSiteIndex === undefined) {
        return [];
      }

      return [{
        centerSiteIndex,
        label: polyhedron.label,
        polyhedronType: polyhedron.polyhedron_type,
        neighborCutoff: polyhedron.neighbor_cutoff_angstrom,
      }];
    });

  return mapped.length > 0 ? mapped : undefined;
}

function mapRecordToCrystal(record: UnifiedCrystalRecord): CrystalStructure {
  return {
    id: record.id,
    name: record.render.name || record.name_cn,
    formula: record.formula,
    formulaHtml: record.render.formula_html || record.formula,
    category: record.render.category,
    gradeLevel: record.level as GradeLevel,
    structureType: record.render.structure_type || record.name_cn,
    crystalSystem: record.render.crystal_system_code,
    spaceGroup: record.render.space_group_symbol,
    spaceGroupNumber: record.render.space_group_number ?? undefined,
    lattice: {
      a: record.lattice_params.a,
      b: record.lattice_params.b,
      c: record.lattice_params.c,
      alpha: record.lattice_params.alpha,
      beta: record.lattice_params.beta,
      gamma: record.lattice_params.gamma,
    },
    z: record.z,
    atomSites: mapAtoms(record),
    bonds: mapBonds(record),
    coordinationNumber: record.coord_number,
    coordinationGeometry: record.render.coordination_geometry ?? undefined,
    teachingPoints: record.teaching_points,
    polyhedra: mapPolyhedra(record),
    neighborCutoff: record.render.neighbor_cutoff_angstrom ?? undefined,
    packingType: record.render.packing_type ?? undefined,
    packingEfficiency: record.render.packing_efficiency ?? undefined,
    bondLengths: record.render.bond_lengths_pm ?? undefined,
    hybridization: record.render.hybridization ?? undefined,
    dataSource: record.render.source_summary || record.render.data_source || undefined,
    fallbackBondType: inferFallbackBondType(record),
    bondGeneration: record.render.bond_generation,
    structureOrigin: 'document',
  };
}

function buildRepository() {
  return Object.entries(recordModules)
    .map(([filePath, record]) => ({
      filePath,
      record,
      crystal: mapRecordToCrystal(record),
    }))
    .sort((a, b) => a.crystal.id.localeCompare(b.crystal.id));
}

const repository = buildRepository();
const crystalById = new Map(repository.map((entry) => [entry.crystal.id, entry.crystal]));
const recordById = new Map(repository.map((entry) => [entry.record.id, entry.record]));

export const CRYSTAL_STRUCTURES: CrystalStructure[] = repository.map((entry) => entry.crystal);
export const CRYSTAL_RECORDS: UnifiedCrystalRecord[] = repository.map((entry) => entry.record);

export function getCrystalById(id: string): CrystalStructure | undefined {
  return crystalById.get(id);
}

export function getCrystalRecordById(id: string): UnifiedCrystalRecord | undefined {
  return recordById.get(id);
}

export function getCrystalsByCategory(category: CrystalCategory): CrystalStructure[] {
  return CRYSTAL_STRUCTURES.filter((crystal) => crystal.category === category);
}
