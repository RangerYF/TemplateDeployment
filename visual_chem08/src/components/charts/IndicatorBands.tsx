import { INDICATORS } from '@/data/indicators';
import { ML, PW, py } from '@/utils/svgChartUtils';

interface IndicatorBandsProps {
  selectedIds: string[];
  yMin: number;
  yMax: number;
}

export function IndicatorBands({ selectedIds, yMin, yMax }: IndicatorBandsProps) {
  const selected = INDICATORS.filter((ind) => selectedIds.includes(ind.id));

  return (
    <g>
      {selected.map((ind) => {
        const y1 = py(ind.pHRange[1], yMin, yMax);
        const y2 = py(ind.pHRange[0], yMin, yMax);
        const height = y2 - y1;
        const gradId = `ind-grad-${ind.id}`;

        return (
          <g key={ind.id}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                {ind.colors.map((c, i) => (
                  <stop
                    key={i}
                    offset={`${(i / Math.max(1, ind.colors.length - 1)) * 100}%`}
                    stopColor={c}
                    stopOpacity={0.25}
                  />
                ))}
              </linearGradient>
            </defs>
            <rect
              x={ML}
              y={y1}
              width={PW}
              height={Math.max(0, height)}
              fill={`url(#${gradId})`}
              rx={2}
            />
            {/* Label at right edge */}
            <text
              x={ML + PW + 2}
              y={(y1 + y2) / 2 + 4}
              fontSize={12}
              fill={ind.colors[ind.colors.length - 1]}
              fontWeight="600"
            >
              {ind.name}
            </text>
            {/* pH range labels */}
            <text
              x={ML + PW - 4}
              y={y1 + 12}
              textAnchor="end"
              fontSize={11}
              fill={ind.colors[ind.colors.length - 1]}
              opacity={0.7}
            >
              pH {ind.pHRange[0]}–{ind.pHRange[1]}
            </text>
          </g>
        );
      })}
    </g>
  );
}
