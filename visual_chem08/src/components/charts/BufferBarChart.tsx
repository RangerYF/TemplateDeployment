import { COLORS } from '@/styles/tokens';
import { useBufferStore } from '@/store';
import { getBuffer } from '@/data/bufferSystems';

const VW = 600;
const VH = 400;
const ML = 80;
const MT = 50;
const MR = 40;
const MB = 70;
const PW = VW - ML - MR;
const PH = VH - MT - MB;

export function BufferBarChart() {
  const result = useBufferStore((s) => s.result);
  const addType = useBufferStore((s) => s.addType);
  const bufferId = useBufferStore((s) => s.selectedBufferId);
  const displayMode = useBufferStore((s) => s.displayMode);

  if (!result) return null;

  const buf = getBuffer(bufferId);
  const actionLabel = addType === 'acid' ? '加入酸' : '加入碱';
  const plotBottom = MT + PH;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      style={{ fontFamily: "'Inter', 'PingFang SC', sans-serif" }}
    >
      {/* Title */}
      <text
        x={VW / 2} y={MT - 20}
        textAnchor="middle" fontSize={16} fontWeight="bold" fill={COLORS.text}
      >
        {buf.name}缓冲液 vs 纯水 — {actionLabel}后
        {displayMode === 'delta' ? ' pH 变化对比' : ' pH 绝对值'}
      </text>

      {/* Axes */}
      <line x1={ML} y1={MT} x2={ML} y2={plotBottom} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={ML} y1={plotBottom} x2={ML + PW} y2={plotBottom} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

      {displayMode === 'delta' ? (
        <DeltaMode result={result} plotBottom={plotBottom} />
      ) : (
        <AbsoluteMode result={result} plotBottom={plotBottom} />
      )}
    </svg>
  );
}

// ============================================
// Delta mode — ΔpH bar chart (original)
// ============================================

interface ModeProps {
  result: NonNullable<ReturnType<typeof useBufferStore.getState>['result']>;
  plotBottom: number;
}

function DeltaMode({ result, plotBottom }: ModeProps) {
  const maxChange = Math.max(result.bufferPHChange, result.waterPHChange, 0.1);
  const barWidth = PW * 0.25;
  const gap = PW * 0.15;
  const bufferBarX = ML + PW / 2 - barWidth - gap / 2;
  const waterBarX = ML + PW / 2 + gap / 2;

  const bufferBarH = (result.bufferPHChange / maxChange) * PH;
  const waterBarH = (result.waterPHChange / maxChange) * PH;

  return (
    <g>
      {/* Y grid + labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const val = maxChange * frac;
        const y = plotBottom - frac * PH;
        return (
          <g key={frac}>
            <line x1={ML} y1={y} x2={ML + PW} y2={y}
              stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={12} fill={COLORS.textMuted}>
              {val.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Y label */}
      <text
        x={0} y={0}
        textAnchor="middle" fontSize={12} fill={COLORS.textSecondary}
        transform={`translate(18, ${MT + PH / 2}) rotate(-90)`}
      >
        ΔpH
      </text>

      {/* Buffer bar */}
      <rect
        x={bufferBarX} y={plotBottom - bufferBarH}
        width={barWidth} height={Math.max(1, bufferBarH)}
        fill={COLORS.primary} rx={4} opacity={0.85}
      />
      <text
        x={bufferBarX + barWidth / 2} y={plotBottom - bufferBarH - 8}
        textAnchor="middle" fontSize={12} fontWeight="600" fill={COLORS.primary}
      >
        Δ{result.bufferPHChange.toFixed(3)}
      </text>
      <text x={bufferBarX + barWidth / 2} y={plotBottom + 18}
        textAnchor="middle" fontSize={12} fill={COLORS.text}>
        缓冲液
      </text>
      <text x={bufferBarX + barWidth / 2} y={plotBottom + 34}
        textAnchor="middle" fontSize={12} fill={COLORS.textMuted}>
        pH: {result.bufferInitialPH.toFixed(2)} → {result.bufferFinalPH.toFixed(2)}
      </text>

      {/* Water bar */}
      <rect
        x={waterBarX} y={plotBottom - waterBarH}
        width={barWidth} height={Math.max(1, waterBarH)}
        fill={COLORS.info} rx={4} opacity={0.85}
      />
      <text
        x={waterBarX + barWidth / 2} y={plotBottom - waterBarH - 8}
        textAnchor="middle" fontSize={12} fontWeight="600" fill={COLORS.info}
      >
        Δ{result.waterPHChange.toFixed(3)}
      </text>
      <text x={waterBarX + barWidth / 2} y={plotBottom + 18}
        textAnchor="middle" fontSize={12} fill={COLORS.text}>
        纯水
      </text>
      <text x={waterBarX + barWidth / 2} y={plotBottom + 34}
        textAnchor="middle" fontSize={12} fill={COLORS.textMuted}>
        pH: {result.waterInitialPH.toFixed(2)} → {result.waterFinalPH.toFixed(2)}
      </text>
    </g>
  );
}

// ============================================
// Absolute mode — pH 0-14 bar chart
// ============================================

const PH_MAX = 14;

function AbsoluteMode({ result, plotBottom }: ModeProps) {
  const phToH = (ph: number) => (ph / PH_MAX) * PH;

  // Two bars layout, same as DeltaMode
  const barWidth = PW * 0.25;
  const gap = PW * 0.15;
  const bufferBarX = ML + PW / 2 - barWidth - gap / 2;
  const waterBarX = ML + PW / 2 + gap / 2;

  const bufferBarH = phToH(result.bufferFinalPH);
  const waterBarH = phToH(result.waterFinalPH);

  return (
    <g>
      {/* Y grid — pH 0-14, every 2 */}
      {[0, 2, 4, 6, 7, 8, 10, 12, 14].map((ph) => {
        const y = plotBottom - phToH(ph);
        return (
          <g key={ph}>
            <line x1={ML} y1={y} x2={ML + PW} y2={y}
              stroke={ph === 7 ? COLORS.textMuted : COLORS.border}
              strokeWidth={ph === 7 ? 1 : 0.8}
              strokeDasharray={ph === 7 ? '6 3' : '3 3'}
              vectorEffect="non-scaling-stroke"
            />
            <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={12} fill={COLORS.textMuted}>
              {ph}
            </text>
          </g>
        );
      })}

      {/* Y label */}
      <text
        x={0} y={0}
        textAnchor="middle" fontSize={12} fill={COLORS.textSecondary}
        transform={`translate(18, ${MT + PH / 2}) rotate(-90)`}
      >
        pH
      </text>

      {/* Buffer bar */}
      <rect
        x={bufferBarX} y={plotBottom - bufferBarH}
        width={barWidth} height={Math.max(1, bufferBarH)}
        fill={COLORS.primary} rx={4} opacity={0.85}
      />
      <text
        x={bufferBarX + barWidth / 2} y={plotBottom - bufferBarH - 8}
        textAnchor="middle" fontSize={12} fontWeight="600" fill={COLORS.primary}
      >
        pH {result.bufferFinalPH.toFixed(2)}
      </text>
      <text x={bufferBarX + barWidth / 2} y={plotBottom + 18}
        textAnchor="middle" fontSize={12} fill={COLORS.text}>
        缓冲液
      </text>

      {/* Water bar */}
      <rect
        x={waterBarX} y={plotBottom - waterBarH}
        width={barWidth} height={Math.max(1, waterBarH)}
        fill={COLORS.info} rx={4} opacity={0.85}
      />
      <text
        x={waterBarX + barWidth / 2} y={plotBottom - waterBarH - 8}
        textAnchor="middle" fontSize={12} fontWeight="600" fill={COLORS.info}
      >
        pH {result.waterFinalPH.toFixed(2)}
      </text>
      <text x={waterBarX + barWidth / 2} y={plotBottom + 18}
        textAnchor="middle" fontSize={12} fill={COLORS.text}>
        纯水
      </text>
    </g>
  );
}

