/**
 * AngleMark.tsx
 * Renders an SVG arc showing the angle between a ray and the normal,
 * with a text label at the midpoint of the arc.
 * Ported from old module-refraction.tsx AngleMarkView component.
 */

import type { AngleMark as AngleMarkType } from '@/data/refractionData';

interface Props {
  mark: AngleMarkType;
  color?: string;
}

const TAU = Math.PI * 2;
const toRad = (d: number) => (d * Math.PI) / 180;

function normalizeAngle(a: number): number {
  let out = a % TAU;
  if (out < 0) out += TAU;
  return out;
}

export function AngleMark({ mark, color = 'var(--accent)' }: Props) {
  const normalAngle = normalizeAngle(toRad(mark.normalAngleDeg));
  const rayAngle = normalizeAngle(toRad(mark.rayAngleDeg));

  let delta = rayAngle - normalAngle;
  while (delta <= -Math.PI) delta += TAU;
  while (delta > Math.PI) delta -= TAU;

  const startAngle = normalAngle;
  const endAngle = normalAngle + delta;

  const start = {
    x: mark.at.x + Math.cos(startAngle) * mark.radius,
    y: mark.at.y + Math.sin(startAngle) * mark.radius,
  };
  const end = {
    x: mark.at.x + Math.cos(endAngle) * mark.radius,
    y: mark.at.y + Math.sin(endAngle) * mark.radius,
  };

  const sweep = delta >= 0 ? 1 : 0;
  const mid = startAngle + delta / 2;
  const lx = mark.at.x + Math.cos(mid) * (mark.radius + 12);
  const ly = mark.at.y + Math.sin(mid) * (mark.radius + 12);

  return (
    <g>
      <path
        d={`M ${start.x} ${start.y} A ${mark.radius} ${mark.radius} 0 0 ${sweep} ${end.x} ${end.y}`}
        fill="none"
        stroke={color}
        strokeWidth="1.1"
      />
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        style={{
          paintOrder: 'stroke fill',
          stroke: 'rgba(255,255,255,0.95)',
          strokeWidth: 3.4,
          fontSize: 11,
          fontFamily: 'inherit',
        }}
      >
        {mark.label}
      </text>
    </g>
  );
}
