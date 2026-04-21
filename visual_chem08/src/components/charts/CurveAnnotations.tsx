import { COLORS } from '@/styles/tokens';
import { px, py, ML, MT, PH, DashedVLine } from '@/utils/svgChartUtils';
import type { TitrationCurveResult } from '@/engine/titrationMath';

interface CurveAnnotationsProps {
  curve: TitrationCurveResult;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export function CurveAnnotations({ curve, xMin, xMax, yMin, yMax }: CurveAnnotationsProps) {
  const eqX = px(curve.eqVolume, xMin, xMax);
  const eqY = py(curve.eqPH, yMin, yMax);
  const startY = py(curve.startPH, yMin, yMax);
  const plotBottom = MT + PH;

  return (
    <g>
      {/* Jump range band */}
      <rect
        x={ML}
        y={py(curve.jumpRange[1], yMin, yMax)}
        width={eqX - ML}
        height={py(curve.jumpRange[0], yMin, yMax) - py(curve.jumpRange[1], yMin, yMax)}
        fill={COLORS.textMuted}
        opacity={0.08}
        rx={2}
      />

      {/* Equivalence point vertical dashed */}
      <DashedVLine
        x={eqX} y1={MT} y2={plotBottom}
        color={COLORS.textMuted} strokeWidth={1}
      />

      {/* Equivalence point label (no dot) */}
      <text
        x={eqX + 8} y={eqY - 8}
        fontSize={13} fill={COLORS.text} fontWeight="600"
      >
        等当点
      </text>

      {/* Starting pH label (no dot, shifted up) */}
      <text
        x={px(0, xMin, xMax) + 8} y={startY - 12}
        fontSize={12} fill={COLORS.textSecondary} fontWeight="600"
      >
        起始 pH={curve.startPH.toFixed(2)}
      </text>

      {/* Half-equivalence point (weak acid/base only) */}
      {curve.halfEqVolume != null && curve.halfEqPH != null && (
        <text
          x={px(curve.halfEqVolume, xMin, xMax) + 8}
          y={py(curve.halfEqPH, yMin, yMax) - 6}
          fontSize={12} fill={COLORS.textSecondary} fontWeight="600"
        >
          半当量点 pH=pKa={curve.halfEqPH.toFixed(2)}
        </text>
      )}

      {/* Jump range label */}
      <text
        x={ML + 4}
        y={py(curve.jumpRange[1], yMin, yMax) - 6}
        fontSize={12} fill={COLORS.textMuted} fontWeight="600"
      >
        突跃范围 pH {curve.jumpRange[0].toFixed(1)}–{curve.jumpRange[1].toFixed(1)}
      </text>
    </g>
  );
}
