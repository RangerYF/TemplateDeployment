/**
 * DoubleSlitMetricsPanel.tsx
 * Live readouts and formula derivation panel for double-slit interference.
 *
 * Readouts:
 *   - Fringe spacing Δy
 *   - Central maximum width
 *   - Slit-to-screen ratio
 *   - Current wavelength
 *
 * When showFormula is enabled, includes the Young's formula derivation
 * with numeric substitution.
 */

import { computeMetrics } from '@/engine/doubleSlitSolver';
import type { DoubleSlitSettings } from '@/data/doubleSlitData';
import { Readout } from './shared';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DoubleSlitMetricsPanel({
  settings,
}: {
  settings: DoubleSlitSettings;
}) {
  const metrics = computeMetrics(settings);

  return (
    <div className="space-y-0.5">
      {/* ── Section header ──────────────────────────────────────────── */}
      <div className="mb-2 flex items-center gap-2">
        <h4
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          实时数值
        </h4>
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }}
        >
          LIVE
        </span>
      </div>

      {/* ── Readouts ────────────────────────────────────────────────── */}
      <Readout label="缝间距 d" value={String(settings.slitSpacing)} unit="μm" />
      <Readout label="屏距 L" value={settings.screenDistance.toFixed(2)} unit="m" />
      <Readout
        label="波长 λ"
        value={metrics.wavelengthLabel}
        unit={settings.whiteLight ? '' : 'nm'}
      />
      <Readout
        label="条纹间距 Δy"
        value={metrics.fringeSpacingMM.toFixed(3)}
        unit="mm"
        highlight
      />
      <Readout
        label="中央极大宽度"
        value={metrics.centralMaxWidthMM.toFixed(3)}
        unit="mm"
      />
      <Readout
        label="缝宽 a"
        value={String(settings.slitWidth)}
        unit="μm"
      />
    </div>
  );
}
