import { COLORS, RADIUS } from '@/styles/tokens';
import { useCrystalStore } from '@/store';
import { getCrystalById, getCrystalRecordById } from '@/data/crystalRepository';
import { BOND_COLORS } from '@/engine/types';
import type { BondType } from '@/engine/types';

// ---------------------------------------------------------------------------
// Density helpers (I-018)
// ---------------------------------------------------------------------------

const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Na: 22.990,
  Mg: 24.305, Si: 28.086, S: 32.065, Cl: 35.453, Ca: 40.078, Ti: 47.867,
  Fe: 55.845, Cu: 63.546, Zn: 65.38, Ga: 69.723, Cd: 112.411, Cs: 132.905,
  Ba: 137.327, I: 126.904, Y: 88.906,
};

/** Parse a chemical formula string into element→count map.
 *  e.g. "NaCl" → {Na:1, Cl:1}, "CaF2" → {Ca:1, F:2}, "Fe2O3" → {Fe:2, O:3} */
function parseFormula(formula: string): Record<string, number> {
  const result: Record<string, number> = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    if (!m[1]) continue;
    const el = m[1];
    const count = m[2] ? parseInt(m[2], 10) : 1;
    result[el] = (result[el] ?? 0) + count;
  }
  return result;
}

/** Molar mass from formula string (g/mol). Returns 0 if any element is unknown. */
function molarMass(formula: string): number {
  const elems = parseFormula(formula);
  let mass = 0;
  for (const [el, count] of Object.entries(elems)) {
    const am = ATOMIC_MASS[el];
    if (am === undefined) return 0;
    mass += am * count;
  }
  return mass;
}

/** Unit cell volume in pm³ from general lattice parameters (a, b, c in pm, angles in degrees). */
function cellVolumePm3(lattice: { a: number; b: number; c: number; alpha: number; beta: number; gamma: number }): number {
  const { a, b, c, alpha, beta, gamma } = lattice;
  const ar = alpha * Math.PI / 180;
  const br = beta * Math.PI / 180;
  const gr = gamma * Math.PI / 180;
  const cosA = Math.cos(ar);
  const cosB = Math.cos(br);
  const cosG = Math.cos(gr);
  return a * b * c * Math.sqrt(1 - cosA * cosA - cosB * cosB - cosG * cosG + 2 * cosA * cosB * cosG);
}

/** Crystal density in g/cm³. Returns 0 on failure. */
function calcDensity(z: number, formula: string, lattice: { a: number; b: number; c: number; alpha: number; beta: number; gamma: number }): number {
  const M = molarMass(formula);
  if (M <= 0) return 0;
  const Vpm3 = cellVolumePm3(lattice);
  if (Vpm3 <= 0) return 0;
  const Vcm3 = Vpm3 * 1e-30; // pm³ → cm³
  const Na = 6.022e23;
  return (z * M) / (Vcm3 * Na);
}

export function CrystalInfoPanel() {
  const selectedCrystalId = useCrystalStore((s) => s.selectedCrystalId);
  const crystal = getCrystalById(selectedCrystalId);
  const record = getCrystalRecordById(selectedCrystalId);

  if (!crystal) {
    return (
      <p className="text-xs" style={{ color: COLORS.textPlaceholder }}>
        未选择晶体
      </p>
    );
  }

  const { lattice } = crystal;
  const density = calcDensity(crystal.z, crystal.formula, lattice);

  // Collect unique bond types in this crystal
  const bondTypeSet = new Set<BondType>(crystal.bonds.map((b) => b.bondType));
  if (bondTypeSet.size === 0 && crystal.fallbackBondType) {
    bondTypeSet.add(crystal.fallbackBondType);
  }
  const bondTypes = Array.from(bondTypeSet);

  // Polarization annotation (B-009)
  const polarizingCations = ['Ag', 'Cd', 'Zn', 'Pb', 'Tl'];
  const hasCovalentCharacter = bondTypes.includes('ionic') &&
    polarizingCations.some(c => crystal.formula.includes(c));

  return (
    <div className="space-y-3">
      {/* Formula (large) */}
      <div>
        <div
          className="text-xl font-bold leading-tight"
          style={{ color: COLORS.text }}
          dangerouslySetInnerHTML={{ __html: crystal.formulaHtml }}
        />
        <p className="text-sm mt-0.5" style={{ color: COLORS.textSecondary }}>
          {crystal.name}
        </p>
      </div>

      {/* Basic info rows */}
      <div className="space-y-1.5">
        <InfoRow label="结构类型" value={crystal.structureType} />
        <InfoRow label="晶系" value={record?.crystal_system ?? crystal.crystalSystem} />
        <InfoRow label="空间群" value={record?.space_group ?? crystal.spaceGroup} />
        <InfoRow label="配位数" value={crystal.coordinationNumber} />
        {crystal.coordinationGeometry && (
          <InfoRow label="配位构型" value={crystal.coordinationGeometry} />
        )}
        <InfoRow label="Z值" value={String(crystal.z)} />
        {density > 0 && <InfoRow label="密度" value={`${density.toFixed(3)} g/cm³`} />}
        {crystal.hybridization && (
          <InfoRow label="杂化方式" value={crystal.hybridization} />
        )}
        {record?.render.mp_material_id && (
          <InfoRow label="MP 材料" value={record.render.mp_material_id} />
        )}
      </div>

      {/* Lattice parameters table */}
      <div>
        <p
          className="text-xs font-semibold mb-1.5"
          style={{ color: COLORS.textSecondary }}
        >
          晶格参数
        </p>
        <div
          className="text-xs"
          style={{
            borderRadius: RADIUS.xs,
            border: `1px solid ${COLORS.border}`,
            overflow: 'hidden',
          }}
        >
          <table className="w-full">
            <tbody>
              <LatticeRow label="a" value={`${lattice.a} pm`} />
              <LatticeRow label="b" value={`${lattice.b} pm`} even />
              <LatticeRow label="c" value={`${lattice.c} pm`} />
              <LatticeRow
                label={'\u03B1'}
                value={`${lattice.alpha}\u00B0`}
                even
              />
              <LatticeRow
                label={'\u03B2'}
                value={`${lattice.beta}\u00B0`}
              />
              <LatticeRow
                label={'\u03B3'}
                value={`${lattice.gamma}\u00B0`}
                even
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Key parameters from unified data schema */}
      {record?.key_parameters?.length ? (
        <div>
          <p
            className="text-xs font-semibold mb-1.5"
            style={{ color: COLORS.textSecondary }}
          >
            关键参数
          </p>
          <div className="space-y-0.5">
            {record.key_parameters.map((parameter) => (
              <div key={parameter.id} className="flex justify-between gap-3 text-xs">
                <span style={{ color: COLORS.textMuted }}>{parameter.label}</span>
                <span className="text-right" style={{ color: COLORS.text }}>
                  {parameter.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Bond types */}
      {bondTypes.length > 0 && (
        <div>
          <p
            className="text-xs font-semibold mb-1.5"
            style={{ color: COLORS.textSecondary }}
          >
            键类型
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bondTypes.map((bt) => {
              const info = BOND_COLORS[bt];
              return (
                <span
                  key={bt}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5"
                  style={{
                    borderRadius: RADIUS.xs,
                    backgroundColor: COLORS.bgMuted,
                    color: COLORS.textSecondary,
                  }}
                >
                  <span
                    className="inline-block w-2.5 h-0.5"
                    style={{
                      backgroundColor: info.color,
                      borderTop: info.dashed ? `1px dashed ${info.color}` : 'none',
                    }}
                  />
                  {info.label}
                </span>
              );
            })}
          </div>
          {/* Polarization annotation (B-009) */}
          {hasCovalentCharacter && (
            <p className="text-[10px] mt-1" style={{ color: COLORS.textSecondary }}>
              ⚡ 该晶体的离子键具有较强共价性（极化效应）
            </p>
          )}
        </div>
      )}

      {/* Bond lengths */}
      {crystal.bondLengths && Object.keys(crystal.bondLengths).length > 0 && (
        <div>
          <p
            className="text-xs font-semibold mb-1.5"
            style={{ color: COLORS.textSecondary }}
          >
            键长
          </p>
          <div className="space-y-0.5">
            {Object.entries(crystal.bondLengths).map(([label, length]) => (
              <div key={label} className="flex justify-between text-xs">
                <span style={{ color: COLORS.text }}>{label}</span>
                <span style={{ color: COLORS.textMuted }}>{length} pm</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data source citation (S-016) */}
      {record?.render.source_summary && (
        <div className="space-y-1">
          <p className="text-[10px] mt-2" style={{ color: COLORS.textPlaceholder }}>
            数据来源: {record.render.source_summary}
          </p>
          {record.render.representation_note && (
            <p className="text-[10px]" style={{ color: COLORS.warning }}>
              表示说明: {record.render.representation_note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span className="font-medium" style={{ color: COLORS.text }}>
        {value}
      </span>
    </div>
  );
}

function LatticeRow({
  label,
  value,
  even = false,
}: {
  label: string;
  value: string;
  even?: boolean;
}) {
  return (
    <tr style={{ backgroundColor: even ? COLORS.bgMuted : 'transparent' }}>
      <td
        className="px-3 py-1 font-medium"
        style={{ color: COLORS.textMuted }}
      >
        {label}
      </td>
      <td
        className="px-3 py-1 text-right"
        style={{ color: COLORS.text }}
      >
        {value}
      </td>
    </tr>
  );
}
