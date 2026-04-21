import { COLORS, RADIUS } from '@/styles/tokens';
import { useCrystalStore } from '@/store';
import { getCrystalById } from '@/data/crystalRepository';
import { ELEMENTS } from '@/data/elements';
import { getVoidType, calculateRadiusRatio } from '@/engine/coordinationEngine';

export function CoordinationPanel() {
  const highlightedAtomIdx = useCrystalStore((s) => s.highlightedAtomIdx);
  const highlightedNeighbors = useCrystalStore((s) => s.highlightedNeighbors);
  const selectedCrystalId = useCrystalStore((s) => s.selectedCrystalId);
  const crystal = getCrystalById(selectedCrystalId);

  if (highlightedAtomIdx === null || !crystal) {
    return (
      <p className="text-xs" style={{ color: COLORS.textPlaceholder }}>
        点击3D视图中的原子查看配位信息
      </p>
    );
  }

  // Resolve the atom site from the index (site index within atomSites)
  const siteIdx = highlightedAtomIdx % crystal.atomSites.length;
  const site = crystal.atomSites[siteIdx];
  if (!site) return null;

  const elementData = ELEMENTS[site.element];
  const elementColor = site.colorOverride ?? elementData?.color ?? '#888888';

  // Classify neighbors into homo/hetero
  const neighborElements = highlightedNeighbors.map((idx) => {
    const nsi = idx % crystal.atomSites.length;
    return crystal.atomSites[nsi];
  }).filter(Boolean);
  const heteroNeighbors = neighborElements.filter((n) => n.element !== site.element);
  const homoNeighbors = neighborElements.filter((n) => n.element === site.element);

  // Void type based on coordination number
  const voidType = getVoidType(highlightedNeighbors.length);

  // Radius ratio calculation
  const centerIonicRadius = elementData?.ionicRadii?.[site.charge ?? ''] ?? 0;
  let radiusRatio: number | null = null;
  if (heteroNeighbors.length > 0) {
    const neighborElement = ELEMENTS[heteroNeighbors[0].element];
    const neighborCharge = heteroNeighbors[0].charge ?? '';
    const neighborIonicRadius = neighborElement?.ionicRadii?.[neighborCharge] ?? 0;
    const r = Math.min(centerIonicRadius, neighborIonicRadius);
    const R = Math.max(centerIonicRadius, neighborIonicRadius);
    if (R > 0) {
      radiusRatio = calculateRadiusRatio(r, R);
    }
  }

  return (
    <div className="space-y-3">
      {/* Element info */}
      <div className="flex items-center gap-2">
        {/* Color sphere indicator */}
        <span
          className="w-6 h-6 rounded-full shrink-0 border"
          style={{
            backgroundColor: elementColor,
            borderColor: COLORS.border,
          }}
        />
        <div>
          <p className="text-sm font-bold" style={{ color: COLORS.text }}>
            {site.label || site.element}
            {site.charge && (
              <sup
                className="text-xs ml-0.5"
                style={{ color: COLORS.textSecondary }}
              >
                {site.charge}
              </sup>
            )}
          </p>
          {elementData && (
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              {elementData.nameCn} ({elementData.name})
            </p>
          )}
        </div>
      </div>

      {/* Coordination number */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          borderRadius: RADIUS.xs,
          backgroundColor: COLORS.bgMuted,
        }}
      >
        <span className="text-xs" style={{ color: COLORS.textSecondary }}>
          配位数
        </span>
        <span
          className="text-sm font-bold"
          style={{ color: COLORS.primary }}
        >
          {highlightedNeighbors.length}
        </span>
      </div>

      {/* Coordination geometry (global) */}
      {crystal.coordinationGeometry && (
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: COLORS.textMuted }}>配位构型</span>
          <span style={{ color: COLORS.text }}>{crystal.coordinationGeometry}</span>
        </div>
      )}

      {/* Homo/hetero neighbor classification (C-003) */}
      {highlightedNeighbors.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: COLORS.textMuted }}>近邻分类</span>
          <span style={{ color: COLORS.text }}>
            {heteroNeighbors.length > 0 && (
              <span>异种 {heteroNeighbors.length}</span>
            )}
            {heteroNeighbors.length > 0 && homoNeighbors.length > 0 && ' / '}
            {homoNeighbors.length > 0 && (
              <span>同种 {homoNeighbors.length}</span>
            )}
          </span>
        </div>
      )}

      {/* Void type display (C-004) */}
      {voidType && (
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: COLORS.textMuted }}>空隙类型</span>
          <span style={{ color: COLORS.text }}>{voidType}</span>
        </div>
      )}

      {/* Radius ratio display (C-005) */}
      {radiusRatio !== null && (
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: COLORS.textMuted }}>r/R 半径比</span>
          <span style={{ color: COLORS.text }}>{radiusRatio.toFixed(3)}</span>
        </div>
      )}

      {/* Neighbor list */}
      {highlightedNeighbors.length > 0 && (
        <div>
          <p
            className="text-xs font-semibold mb-1.5"
            style={{ color: COLORS.textSecondary }}
          >
            近邻原子
          </p>
          <div
            className="max-h-[160px] overflow-y-auto space-y-0.5"
            style={{
              borderRadius: RADIUS.xs,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {highlightedNeighbors.map((neighborIdx, i) => {
              const neighborSiteIdx = neighborIdx % crystal.atomSites.length;
              const neighborSite = crystal.atomSites[neighborSiteIdx];
              if (!neighborSite) return null;

              const nColor =
                neighborSite.colorOverride ??
                ELEMENTS[neighborSite.element]?.color ??
                '#888888';

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs"
                  style={{
                    backgroundColor: i % 2 === 0 ? 'transparent' : COLORS.bgMuted,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: nColor }}
                  />
                  <span style={{ color: COLORS.text }}>
                    {neighborSite.label || neighborSite.element}
                  </span>
                  {neighborSite.charge && (
                    <sup style={{ color: COLORS.textMuted }}>
                      {neighborSite.charge}
                    </sup>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
