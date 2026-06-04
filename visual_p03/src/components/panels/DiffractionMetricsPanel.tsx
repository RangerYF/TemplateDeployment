/**
 * DiffractionMetricsPanel.tsx
 * Live readouts and formula derivation panel for diffraction.
 *
 * Readouts:
 *   - Central max width (slit) / Airy disk radius (circle) / Poisson spot (disk)
 *   - First minimum angle
 *   - Wavelength, screen distance, aperture size
 *   - Resolution & trend description
 *
 * When showFormula is enabled, includes the Fraunhofer / Airy / Poisson
 * formula derivation with numeric substitution.
 */

import { computeMetrics, fmt } from '@/engine/diffractionSolver';
import type { DiffractionSettings } from '@/data/diffractionData';
import { Readout } from './shared';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiffractionMetricsPanel({
  settings,
}: {
  settings: DiffractionSettings;
}) {
  const metrics = computeMetrics(settings);
  const isSlit = settings.aperture === 'slit';
  const isDisk = settings.aperture === 'disk';

  return (
    <div className="space-y-0.5">
      {/* ── Live readouts ──────────────────────────────────────────── */}
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

      {isSlit ? (
        <Readout label="缝宽 a" value={String(settings.slitWidth)} unit="μm" />
      ) : (
        <Readout
          label={isDisk ? '圆板直径 D' : '孔径 D'}
          value={String(settings.diameter)}
          unit="μm"
        />
      )}
      <Readout label="波长 λ" value={String(settings.wavelength)} unit="nm" />
      <Readout
        label="屏距 L"
        value={settings.screenDistance.toFixed(2)}
        unit="m"
      />
      {isSlit ? (
        <Readout
          label="第一极小 y₁"
          value={fmt(metrics.firstMinMm, 3)}
          unit="mm"
        />
      ) : (
        <Readout
          label={isDisk ? '弱环参考半径' : '第一暗环 r₁'}
          value={fmt(metrics.firstMinMm, 3)}
          unit="mm"
        />
      )}
      <Readout
        label={metrics.apertureLabel}
        value={fmt(metrics.primaryMm, 3)}
        unit="mm"
        highlight
      />

    </div>
  );
}
