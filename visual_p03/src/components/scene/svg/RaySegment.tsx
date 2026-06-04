/**
 * RaySegment.tsx
 * Renders a single ray segment as a triple-line SVG glow effect.
 * Virtual rays are rendered dashed, leak rays are orange.
 * Ported from the old module-refraction.tsx RenderedRay component.
 */

import type { RaySegment as RaySegmentType } from '@/data/refractionData';

interface Props {
  segment: RaySegmentType;
  color: string;
  thick: number;
}

export function RaySegment({ segment, color, thick }: Props) {
  const { from, to, kind } = segment;

  // Virtual rays: dashed, purple-ish, no glow
  if (kind === 'virtual') {
    return (
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="oklch(0.55 0.16 280)"
        strokeWidth={Math.max(1, thick - 0.3)}
        strokeDasharray="6 4"
        opacity={0.6}
      />
    );
  }

  // Leak rays use orange instead of the provided color
  const stroke = kind === 'leak' ? 'oklch(0.66 0.17 35)' : color;

  // Triple-line glow: outer glow -> mid glow -> core line
  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={stroke}
        strokeWidth={thick + 2.6}
        opacity={0.18}
        filter="url(#ref-soft-glow)"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={stroke}
        strokeWidth={thick + 0.9}
        opacity={0.42}
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={stroke}
        strokeWidth={Math.max(1, thick - 0.15)}
        opacity={0.98}
      />
    </g>
  );
}
