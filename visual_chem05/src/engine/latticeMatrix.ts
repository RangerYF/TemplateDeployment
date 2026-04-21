/**
 * Lattice matrix math: conversions between fractional and Cartesian coordinates,
 * unit cell geometry, and basic vector operations.
 *
 * Convention:
 * - Lattice params use pm (picometers) for lengths and degrees for angles.
 * - All Cartesian outputs are in Angstroms (pm / 100).
 * - The lattice matrix rows are the three lattice vectors a, b, c:
 *     a lies along +x
 *     b lies in the xy-plane
 *     c is determined by all three angles
 */

import type { Vec3, Matrix3, LatticeParams } from './types';

const DEG2RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Lattice matrix construction
// ---------------------------------------------------------------------------

/**
 * Convert lattice parameters (pm, degrees) to a 3x3 matrix whose rows are the
 * lattice vectors in Angstroms.
 *
 * Standard crystallographic convention:
 *   a = (a, 0, 0)
 *   b = (b*cos(gamma), b*sin(gamma), 0)
 *   c = (cx, cy, cz)  determined by alpha, beta, gamma
 */
export function buildLatticeMatrix(lattice: LatticeParams): Matrix3 {
  // Convert pm -> Angstroms
  const a = lattice.a / 100;
  const b = lattice.b / 100;
  const c = lattice.c / 100;

  const alpha = lattice.alpha * DEG2RAD;
  const beta = lattice.beta * DEG2RAD;
  const gamma = lattice.gamma * DEG2RAD;

  const cosAlpha = Math.cos(alpha);
  const cosBeta = Math.cos(beta);
  const cosGamma = Math.cos(gamma);
  const sinGamma = Math.sin(gamma);

  // a vector along x
  const ax = a;
  const ay = 0;
  const az = 0;

  // b vector in xy-plane
  const bx = b * cosGamma;
  const by = b * sinGamma;
  const bz = 0;

  // c vector
  const cx = c * cosBeta;
  const cy = c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
  const cz = c * Math.sqrt(
    1 - cosBeta * cosBeta
      - ((cosAlpha - cosBeta * cosGamma) / sinGamma) ** 2
  );

  return [
    [ax, ay, az],
    [bx, by, bz],
    [cx, cy, cz],
  ];
}

// ---------------------------------------------------------------------------
// Coordinate conversions
// ---------------------------------------------------------------------------

/**
 * Fractional coordinates to Cartesian (Angstroms).
 * cart = frac[0]*a + frac[1]*b + frac[2]*c
 */
export function fracToCart(frac: Vec3, matrix: Matrix3): Vec3 {
  const [a, b, c] = matrix;
  return [
    frac[0] * a[0] + frac[1] * b[0] + frac[2] * c[0],
    frac[0] * a[1] + frac[1] * b[1] + frac[2] * c[1],
    frac[0] * a[2] + frac[1] * b[2] + frac[2] * c[2],
  ];
}

/**
 * Cartesian (Angstroms) to fractional coordinates.
 * Solves M^T * frac = cart  where M rows are lattice vectors.
 * Uses explicit 3x3 inverse.
 */
export function cartToFrac(cart: Vec3, matrix: Matrix3): Vec3 {
  const inv = invert3x3(matrix);
  // frac = inv * cart  (treating inv rows as the transform)
  return [
    inv[0][0] * cart[0] + inv[0][1] * cart[1] + inv[0][2] * cart[2],
    inv[1][0] * cart[0] + inv[1][1] * cart[1] + inv[1][2] * cart[2],
    inv[2][0] * cart[0] + inv[2][1] * cart[1] + inv[2][2] * cart[2],
  ];
}

/**
 * Invert a 3x3 matrix (rows = vectors).
 * For a matrix M where cart = frac * M (row-vector convention),
 * frac = cart * M^{-1}.
 * We compute the inverse of the transpose so that cartToFrac(cart, M)
 * returns the correct fractional coords.
 */
function invert3x3(m: Matrix3): Matrix3 {
  // We need inverse of the matrix whose columns are the lattice vectors,
  // i.e. the transpose of our row-based matrix.
  // inv(M^T) where M^T columns = m rows.

  const a = m[0][0], b = m[1][0], c = m[2][0];
  const d = m[0][1], e = m[1][1], f = m[2][1];
  const g = m[0][2], h = m[1][2], i = m[2][2];

  const det = a * (e * i - f * h)
            - b * (d * i - f * g)
            + c * (d * h - e * g);

  if (Math.abs(det) < 1e-12) {
    throw new Error('Singular lattice matrix — cannot invert');
  }

  const invDet = 1 / det;

  return [
    [
      (e * i - f * h) * invDet,
      (c * h - b * i) * invDet,
      (b * f - c * e) * invDet,
    ],
    [
      (f * g - d * i) * invDet,
      (a * i - c * g) * invDet,
      (c * d - a * f) * invDet,
    ],
    [
      (d * h - e * g) * invDet,
      (b * g - a * h) * invDet,
      (a * e - b * d) * invDet,
    ],
  ];
}

// ---------------------------------------------------------------------------
// Unit cell geometry
// ---------------------------------------------------------------------------

/**
 * Build the 8 corner vertices of the unit cell in Cartesian coordinates.
 * Ordered by binary expansion of (i, j, k) where i,j,k in {0,1}:
 *   index 0 = (0,0,0), 1 = (1,0,0), 2 = (0,1,0), 3 = (1,1,0),
 *   4 = (0,0,1), 5 = (1,0,1), 6 = (0,1,1), 7 = (1,1,1)
 */
export function buildUnitCellVertices(matrix: Matrix3): Vec3[] {
  const vertices: Vec3[] = [];
  for (let k = 0; k <= 1; k++) {
    for (let j = 0; j <= 1; j++) {
      for (let i = 0; i <= 1; i++) {
        vertices.push(fracToCart([i, j, k], matrix));
      }
    }
  }
  return vertices;
}

/**
 * Build the 12 edges of the unit cell as pairs of vertex indices.
 * Vertex indexing matches buildUnitCellVertices.
 */
export function buildUnitCellEdges(): [number, number][] {
  return [
    // Bottom face (k=0)
    [0, 1], // i-edge
    [2, 3], // i-edge
    [0, 2], // j-edge
    [1, 3], // j-edge
    // Top face (k=1)
    [4, 5],
    [6, 7],
    [4, 6],
    [5, 7],
    // Vertical edges (k-direction)
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
}

// ---------------------------------------------------------------------------
// Vector operations
// ---------------------------------------------------------------------------

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vec3Distance(a: Vec3, b: Vec3): number {
  return vec3Length(vec3Sub(a, b));
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len < 1e-12) return [0, 0, 0];
  return vec3Scale(v, 1 / len);
}
