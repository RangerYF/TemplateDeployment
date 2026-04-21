import { COLORS } from '@/styles/tokens';
import type { NormalDistResult } from '@/engine/simulations/normalDist';
import { px, py, ChartAxes, ChartTitle, DashedVLine, VW, VH, ML, MT, PW, PH } from '@/utils/svgChartUtils';

export function NormalDistRenderer({ result, showSigmaRegions }: { result: NormalDistResult; showSigmaRegions: boolean }) {
  const xMin = result.mu - 4 * result.sigma;
  const xMax = result.mu + 4 * result.sigma;
  const yMax = result.maxY * 1.2;

  const spx = (v: number) => px(v, xMin, xMax);
  const spy = (v: number) => py(v, 0, yMax);

  // Bell curve polyline points
  const curvePoints = result.pdfPoints.map(pt => `${spx(pt.x).toFixed(1)},${spy(pt.y).toFixed(1)}`).join(' ');

  // Sigma region fill path builder
  const buildSigmaPath = (xL: number, xR: number) => {
    const pts = result.pdfPoints.filter(pt => pt.x >= xL && pt.x <= xR);
    if (pts.length === 0) return '';
    const start = `M ${spx(xL).toFixed(1)},${spy(0).toFixed(1)}`;
    const curve = pts.map(pt => `L ${spx(pt.x).toFixed(1)},${spy(pt.y).toFixed(1)}`).join(' ');
    const end = `L ${spx(xR).toFixed(1)},${spy(0).toFixed(1)} Z`;
    return `${start} ${curve} ${end}`;
  };

  const muX = spx(result.mu);
  const yTicks = Array.from({ length: 5 }, (_, i) => yMax * i / 4);
  const xTicks = Array.from({ length: 9 }, (_, i) => xMin + (xMax - xMin) * i / 8);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`正态分布 N(${result.mu}, ${result.sigma}²)`} />
      <ChartAxes xLabel="x" yLabel="f(x)" />

      {/* Y grid */}
      {yTicks.map((v, i) => {
        const y = py(v, 0, yMax);
        return (
          <g key={i}>
            <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>{v.toFixed(3)}</text>
          </g>
        );
      })}

      {/* X ticks */}
      {xTicks.map((v, i) => (
        <text key={i} x={spx(v)} y={MT + PH + 16} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>{v.toFixed(1)}</text>
      ))}

      {/* Sigma region fills */}
      {showSigmaRegions && (
        <>
          <path d={buildSigmaPath(result.sigma3Range[0], result.sigma3Range[1])} fill="rgba(24,144,255,0.10)" />
          <path d={buildSigmaPath(result.sigma2Range[0], result.sigma2Range[1])} fill="rgba(24,144,255,0.18)" />
          <path d={buildSigmaPath(result.sigma1Range[0], result.sigma1Range[1])} fill="rgba(0,192,107,0.22)" />

          {/* Sigma boundary lines */}
          {[...result.sigma1Range, ...result.sigma2Range, ...result.sigma3Range].map((v, i) => (
            <line key={i} x1={spx(v)} y1={MT} x2={spx(v)} y2={MT + PH} stroke={COLORS.textTertiary} strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Region labels — staggered vertically to avoid overlap */}
          <text x={spx((result.sigma1Range[0] + result.sigma1Range[1]) / 2)} y={MT + PH - 30} textAnchor="middle" fontSize={11} fontWeight="bold" fill={COLORS.primary}>68.27%</text>
          <text x={spx((result.sigma1Range[0] + result.sigma1Range[1]) / 2)} y={MT + PH - 16} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}>±1σ</text>
          <text x={spx((result.sigma2Range[0] + result.sigma1Range[0]) / 2)} y={MT + PH * 0.55} textAnchor="middle" fontSize={10} fill={COLORS.info}>95.45%</text>
          <text x={spx((result.sigma3Range[0] + result.sigma2Range[0]) / 2)} y={MT + PH * 0.35} textAnchor="middle" fontSize={10} fill={COLORS.info}>99.73%</text>
        </>
      )}

      {/* Bell curve */}
      <polyline points={curvePoints} fill="none" stroke={COLORS.primary} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />

      {/* Mean line */}
      <DashedVLine x={muX} y1={MT} y2={MT + PH} color={COLORS.error} />
    </svg>
  );
}
