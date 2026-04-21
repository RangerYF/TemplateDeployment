/**
 * Core type definitions for the crystal structure viewer engine.
 */

/** 3D vector as a tuple */
export type Vec3 = [number, number, number];

/** 3x3 matrix as three row vectors */
export type Matrix3 = [Vec3, Vec3, Vec3];

export type CrystalSystem =
  | 'cubic'
  | 'tetragonal'
  | 'hexagonal'
  | 'orthorhombic'
  | 'monoclinic'
  | 'triclinic'
  | 'trigonal';

export type CrystalCategory =
  | 'ionic'
  | 'atomic'
  | 'metallic'
  | 'molecular'
  | 'layered';

export type GradeLevel = '高中必修' | '高中选修' | '拓展';

export type BondType =
  | 'ionic'
  | 'covalent-sigma'
  | 'covalent-pi'
  | 'metallic'
  | 'hydrogen'
  | 'vanDerWaals';

export type RenderMode =
  | 'ballAndStick'
  | 'spaceFilling'
  | 'polyhedral'
  | 'wireframe';

export type PackingType = 'SC' | 'BCC' | 'FCC' | 'HCP';

// ---------------------------------------------------------------------------
// Lattice & structure definitions
// ---------------------------------------------------------------------------

export interface LatticeParams {
  a: number; b: number; c: number;          // in pm (picometers)
  alpha: number; beta: number; gamma: number; // in degrees
}

export interface AtomSite {
  element: string;
  label?: string;
  fracCoords: Vec3;
  colorOverride?: string;
  radiusOverride?: number;
  charge?: string; // e.g. "+2", "-1"
}

export interface BondDefinition {
  siteIndices: [number, number];
  cellOffset?: Vec3;     // lattice-vector translation for the 2nd atom
  bondType: BondType;
  bondOrder?: number;
  expectedLength?: number; // pm
}

export interface PolyhedronDef {
  centerSiteIndex: number;
  label: string;
  polyhedronType:
    | 'tetrahedron'
    | 'octahedron'
    | 'cube'
    | 'trigonalPrism'
    | 'other';
  neighborCutoff: number; // Angstroms
}

export interface CrystalStructure {
  id: string;
  name: string;
  formula: string;
  formulaHtml: string;
  category: CrystalCategory;
  gradeLevel: GradeLevel;
  structureType: string;
  crystalSystem: CrystalSystem;
  spaceGroup: string;
  spaceGroupNumber?: number;
  lattice: LatticeParams;
  z: number; // formula units per unit cell
  atomSites: AtomSite[];
  bonds: BondDefinition[];
  coordinationNumber: string;
  coordinationGeometry?: string;
  teachingPoints: string[];
  polyhedra?: PolyhedronDef[];
  neighborCutoff?: number;        // Angstroms, for distance-based bond detection
  packingType?: PackingType;
  packingEfficiency?: number;     // 0-1 fraction
  bondLengths?: Record<string, number>; // label -> pm
  hybridization?: string;
  codId?: number;                 // Crystallography Open Database entry ID
  dataSource?: string;            // Citation for crystallographic data
  fallbackBondType?: BondType;    // Used when bonds are generated from CIF coordinates
  bondGeneration?: 'explicit' | 'cutoff' | 'shell';
  structureOrigin?: 'document' | 'cif';
}

// ---------------------------------------------------------------------------
// Instance types (expanded for rendering)
// ---------------------------------------------------------------------------

export interface AtomInstance {
  index: number;
  element: string;
  label: string;
  position: Vec3;       // Cartesian, Angstroms
  color: string;
  radius: number;       // display radius, Angstroms
  cellIndex: Vec3;      // which unit cell [i,j,k]
  siteIndex: number;    // index into atomSites
  isPrimary: boolean;   // true if in the [0,0,0] cell
  charge?: string;
}

export interface BondInstance {
  startPosition: Vec3;
  endPosition: Vec3;
  bondType: BondType;
  color: string;
  radius: number;       // cylinder radius, Angstroms
  dashed: boolean;
  startAtomIndex: number;
  endAtomIndex: number;
}

export interface CrystalScene {
  atoms: AtomInstance[];
  bonds: BondInstance[];
  unitCellVertices: Vec3[];
  unitCellEdges: [number, number][];
  latticeVectors: [Vec3, Vec3, Vec3];
}

export interface ExpansionRange {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

// ---------------------------------------------------------------------------
// Bond color mapping per PRD requirements
// ---------------------------------------------------------------------------

export const BOND_COLORS: Record<BondType, { color: string; dashed: boolean; label: string }> = {
  'ionic':          { color: '#E53E3E', dashed: true,  label: '离子键' },
  'covalent-sigma': { color: '#3182CE', dashed: false, label: 'σ共价键' },
  'covalent-pi':    { color: '#3182CE', dashed: true,  label: 'π共价键' },
  'metallic':       { color: '#D69E2E', dashed: false, label: '金属键' },
  'hydrogen':       { color: '#48BB78', dashed: true,  label: '氢键' },
  'vanDerWaals':    { color: '#A0AEC0', dashed: true,  label: '范德华力' },
};

// ---------------------------------------------------------------------------
// Bond display radius per type (Angstroms)
// ---------------------------------------------------------------------------

export const BOND_RADII: Record<BondType, number> = {
  'ionic':          0.06,
  'covalent-sigma': 0.08,
  'covalent-pi':    0.05,
  'metallic':       0.06,
  'hydrogen':       0.04,
  'vanDerWaals':    0.03,
};
