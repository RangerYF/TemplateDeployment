import { COLORS, RADIUS } from '@/styles/tokens';
import { useCrystalStore } from '@/store';
import { getCrystalById } from '@/data/crystalRepository';
import type { Vec3 } from '@/engine/types';

// ---------------------------------------------------------------------------
// Position contribution rules for atom counting
// ---------------------------------------------------------------------------

function getPositionContribution(frac: Vec3): { label: string; fraction: string; value: number } {
  const [x, y, z] = frac;
  const eps = 1e-6;

  // Check if on corner (all coords are 0 or 1)
  const isCornerCoord = (v: number) => Math.abs(v) < eps || Math.abs(v - 1) < eps;
  // Check if on face (exactly one coord is 0 or 1)
  const isFaceCoord = (v: number) => Math.abs(v) < eps || Math.abs(v - 1) < eps;
  // Check if on edge (exactly two coords are 0 or 1)

  const onBoundary = [isFaceCoord(x), isFaceCoord(y), isFaceCoord(z)];
  const boundaryCount = onBoundary.filter(Boolean).length;

  if (boundaryCount === 3 && isCornerCoord(x) && isCornerCoord(y) && isCornerCoord(z)) {
    return { label: '顶点', fraction: '1/8', value: 1 / 8 };
  }
  if (boundaryCount === 2) {
    return { label: '棱', fraction: '1/4', value: 1 / 4 };
  }
  if (boundaryCount === 1) {
    return { label: '面', fraction: '1/2', value: 1 / 2 };
  }
  return { label: '体内', fraction: '1', value: 1 };
}

function formatFrac(v: number): string {
  // Show up to 4 decimal places, trimming trailing zeros
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

// ---------------------------------------------------------------------------
// FractionalCoordsPanel
// ---------------------------------------------------------------------------

export function FractionalCoordsPanel() {
  const selectedCrystalId = useCrystalStore((s) => s.selectedCrystalId);
  const crystal = getCrystalById(selectedCrystalId);

  if (!crystal) {
    return (
      <p className="text-xs" style={{ color: COLORS.textPlaceholder }}>
        未选择晶体
      </p>
    );
  }

  const sites = crystal.atomSites;

  // Calculate total atom contribution
  const totalContribution = sites.reduce((sum, site) => {
    return sum + getPositionContribution(site.fracCoords).value;
  }, 0);

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="flex justify-between text-xs">
        <span style={{ color: COLORS.textMuted }}>原子位点数</span>
        <span style={{ color: COLORS.text }}>{sites.length}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span style={{ color: COLORS.textMuted }}>归属晶胞原子数</span>
        <span className="font-medium" style={{ color: COLORS.primary }}>
          {totalContribution % 1 === 0
            ? totalContribution
            : totalContribution.toFixed(2)}
        </span>
      </div>

      {/* Per-element breakdown (I-017) */}
      <div className="flex flex-wrap gap-x-3 text-xs">
        {Object.entries(
          sites.reduce<Record<string, number>>((acc, site) => {
            const pos = getPositionContribution(site.fracCoords);
            acc[site.element] = (acc[site.element] ?? 0) + pos.value;
            return acc;
          }, {}),
        ).map(([el, count]) => (
          <span key={el}>
            <span style={{ color: COLORS.text }}>{el}</span>
            <span style={{ color: COLORS.textMuted }}>
              {' '}归属: {count % 1 === 0 ? count : count.toFixed(2)}
            </span>
          </span>
        ))}
      </div>

      {/* Coordinates table */}
      <div
        className="overflow-x-auto"
        style={{
          borderRadius: RADIUS.xs,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: COLORS.bgMuted }}>
              <th
                className="px-2 py-1.5 text-left font-semibold"
                style={{ color: COLORS.textSecondary }}
              >
                原子
              </th>
              <th
                className="px-2 py-1.5 text-right font-semibold"
                style={{ color: COLORS.textSecondary }}
              >
                x
              </th>
              <th
                className="px-2 py-1.5 text-right font-semibold"
                style={{ color: COLORS.textSecondary }}
              >
                y
              </th>
              <th
                className="px-2 py-1.5 text-right font-semibold"
                style={{ color: COLORS.textSecondary }}
              >
                z
              </th>
              <th
                className="px-2 py-1.5 text-right font-semibold"
                style={{ color: COLORS.textSecondary }}
              >
                位置
              </th>
              <th
                className="px-2 py-1.5 text-right font-semibold"
                style={{ color: COLORS.textSecondary }}
              >
                贡献
              </th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site, i) => {
              const pos = getPositionContribution(site.fracCoords);
              return (
                <tr
                  key={i}
                  style={{
                    backgroundColor: i % 2 === 0 ? 'transparent' : COLORS.bgMuted,
                  }}
                >
                  <td className="px-2 py-1" style={{ color: COLORS.text }}>
                    {site.label || site.element}
                    {site.charge && (
                      <sup style={{ color: COLORS.textMuted, fontSize: '9px' }}>
                        {site.charge}
                      </sup>
                    )}
                  </td>
                  <td
                    className="px-2 py-1 text-right tabular-nums"
                    style={{ color: COLORS.text }}
                  >
                    {formatFrac(site.fracCoords[0])}
                  </td>
                  <td
                    className="px-2 py-1 text-right tabular-nums"
                    style={{ color: COLORS.text }}
                  >
                    {formatFrac(site.fracCoords[1])}
                  </td>
                  <td
                    className="px-2 py-1 text-right tabular-nums"
                    style={{ color: COLORS.text }}
                  >
                    {formatFrac(site.fracCoords[2])}
                  </td>
                  <td
                    className="px-2 py-1 text-right"
                    style={{ color: COLORS.textMuted }}
                  >
                    {pos.label}
                  </td>
                  <td
                    className="px-2 py-1 text-right font-medium"
                    style={{ color: COLORS.textSecondary }}
                  >
                    {pos.fraction}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
