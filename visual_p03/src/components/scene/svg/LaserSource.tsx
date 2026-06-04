/**
 * LaserSource.tsx
 * SVG group for the laser gun icon at the source position.
 * A body rectangle with a barrel, lens circle, and glowing tip,
 * rotated to match the emission angle.
 * Ported from old module-refraction.tsx LaserSource component.
 */

interface Props {
  x: number;
  y: number;
  angleDeg: number;
  color: string;
}

export function LaserSource({ x, y, angleDeg, color: _color }: Props) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${angleDeg})`}>
      {/* Label */}
      <text
        x="-88"
        y="-16"
        style={{
          fontSize: 11,
          fill: 'var(--theme-text-muted)',
          pointerEvents: 'none',
          fontFamily: 'inherit',
        }}
      >
        主光源
      </text>

      {/* Body */}
      <rect
        x="-62"
        y="-5.5"
        width="46"
        height="11"
        rx="5.5"
        fill="rgba(41, 47, 49, 0.96)"
      />

      {/* Window / highlight strip */}
      <rect
        x="-55"
        y="-3.6"
        width="22"
        height="7.2"
        rx="3.6"
        fill="rgba(255,255,255,0.10)"
      />

      {/* Barrel */}
      <rect
        x="-16"
        y="-3.8"
        width="10"
        height="7.6"
        rx="3.8"
        fill="rgba(23, 29, 30, 0.96)"
      />

      {/* Lens outer */}
      <circle cx="-5" cy="0" r="5.1" fill="rgba(24, 31, 32, 0.98)" />

      {/* Glow ring */}
      <circle
        cx="-1.2"
        cy="0"
        r="3.6"
        fill="rgba(255, 160, 70, 0.35)"
        filter="url(#ref-soft-glow)"
      />

      {/* Bright core */}
      <circle cx="-1.2" cy="0" r="1.2" fill="rgba(255,245,225,0.98)" />
    </g>
  );
}
