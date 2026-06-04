/**
 * ThinFilmMetricsPanel.tsx
 * Live readouts panel for the thin-film interference module.
 *
 * Displays:
 *   - Teaching conclusion (hero card + trend)
 *   - Live numerical readouts (per film type)
 *   - Formula block (conditional)
 */

import { useMemo } from 'react';
import { fmt, computeThinFilmMetrics } from '@/engine/thinFilmSolver';
import type { ThinFilmSettings } from '@/data/thinFilmData';
import { Readout, SectionTitle } from './shared';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThinFilmMetricsPanel({ settings }: { settings: ThinFilmSettings }) {
  const metrics = useMemo(() => computeThinFilmMetrics(settings), [settings]);
  const { filmType } = settings;

  // ---- Newton's rings ----

  if (filmType === 'newton') {
    const sampleJudgement = metrics.sampleI > 0.66
      ? '亮环附近'
      : metrics.sampleI < 0.34
        ? '暗环附近'
        : '过渡区';

    return (
      <div className="space-y-1">
        <SectionTitle aside="LIVE">实时数值</SectionTitle>
        <Readout label="曲率半径 R" value={settings.lensR.toFixed(2)} unit="m" />
        <Readout label="波长 λ" value={String(settings.wavelength)} unit="nm" />
        <Readout label="第一暗环半径 r₁" value={fmt(metrics.r1 * 1000)} unit="mm" highlight />
        <Readout label="第五暗环半径 r₅" value={fmt(metrics.r5 * 1000)} unit="mm" />
        <Readout label="采样半径 r" value={fmt(metrics.sampleR * 1000)} unit="mm" />
        <Readout label="采样膜厚 t(r)" value={fmt(metrics.sampleT * 1e9)} unit="nm" />
        <Readout label="采样亮度 I" value={fmt(metrics.sampleI, 3)} unit="" />
        <Readout label="采样判定" value={sampleJudgement} unit="" />

      </div>
    );
  }

  // ---- Wedge film ----

  if (filmType === 'wedge') {
    return (
      <div className="space-y-1">
        <SectionTitle aside="LIVE">实时数值</SectionTitle>
        <Readout label="楔角 α" value={settings.wedgeAngle.toFixed(1)} unit="′" />
        <Readout label="波长 λ" value={String(settings.wavelength)} unit="nm" />
        <Readout label="条纹间距 Δx" value={fmt(metrics.fringeSpacing * 1000)} unit="mm" highlight />
        <Readout label="折射率 n" value={settings.filmN.toFixed(2)} unit="" />

      </div>
    );
  }

  // ---- Soap bubble ----

  return (
    <div className="space-y-1">
      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <Readout label="薄膜厚度 t" value={String(settings.thickness)} unit="nm" highlight />
      <Readout label="折射率 n" value={settings.filmN.toFixed(2)} unit="" />
      <Readout label="有效光程 2nt" value={fmt(metrics.opticalPathDiff, 0)} unit="nm" />

    </div>
  );
}
