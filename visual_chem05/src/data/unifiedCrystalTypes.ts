import type {
  BondType,
  CrystalCategory,
  CrystalSystem,
  PackingType,
} from '@/engine/types';

export interface UnifiedCrystalLatticeParams {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export interface UnifiedCrystalAtom {
  id: string;
  element: string;
  label: string;
  x: number;
  y: number;
  z: number;
  x_expr?: string;
  y_expr?: string;
  z_expr?: string;
  charge?: string | null;
  color_override?: string | null;
  radius_override_angstrom?: number | null;
}

export interface UnifiedCrystalKeyParameter {
  id: string;
  label: string;
  value: string;
}

export interface UnifiedRenderBond {
  id: string;
  from_atom_id: string;
  to_atom_id: string;
  cell_offset?: [number, number, number];
  type: BondType;
  order?: number | null;
  expected_length_pm?: number | null;
}

export interface UnifiedRenderPolyhedron {
  id: string;
  center_atom_id: string;
  label: string;
  polyhedron_type: 'tetrahedron' | 'octahedron' | 'cube' | 'trigonalPrism' | 'other';
  neighbor_cutoff_angstrom: number;
}

export interface UnifiedRenderConfig {
  category: CrystalCategory;
  name: string;
  formula_html?: string;
  grade_level: string;
  structure_type?: string | null;
  crystal_system_code: CrystalSystem;
  space_group_symbol: string;
  space_group_number?: number | null;
  bond_generation: 'explicit' | 'cutoff' | 'shell';
  fallback_bond_type?: BondType | null;
  neighbor_cutoff_angstrom?: number | null;
  bond_types: BondType[];
  bonds: UnifiedRenderBond[];
  polyhedra: UnifiedRenderPolyhedron[];
  coordination_geometry?: string | null;
  bond_lengths_pm?: Record<string, number>;
  hybridization?: string | null;
  packing_type?: PackingType | null;
  packing_efficiency?: number | null;
  data_source?: string | null;
  mp_material_id?: string | null;
  representation_note?: string | null;
  source_summary?: string | null;
}

export interface UnifiedSourceReference {
  id: string;
  label: string;
  type: 'document' | 'origin' | 'database' | 'inference' | 'note';
  path?: string | null;
  url?: string | null;
}

export interface UnifiedCrystalProvenance {
  references: UnifiedSourceReference[];
  field_sources: Record<string, string[]>;
}

export interface UnifiedCrystalRecord {
  id: string;
  name_cn: string;
  formula: string;
  level: string;
  crystal_system: string;
  space_group: string;
  lattice_params: UnifiedCrystalLatticeParams;
  atoms: UnifiedCrystalAtom[];
  bond_type: string;
  coord_number: string;
  z: number;
  teaching_points: string[];
  key_parameters: UnifiedCrystalKeyParameter[];
  render: UnifiedRenderConfig;
  provenance: UnifiedCrystalProvenance;
}
