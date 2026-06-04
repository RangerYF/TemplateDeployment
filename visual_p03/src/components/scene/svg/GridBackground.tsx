/**
 * GridBackground.tsx
 * Simple SVG grid rendered as background lines.
 * ViewBox matches the 1000x620 stage coordinate system.
 */

import type { JSX } from 'react';

export function GridBackground() {
  const lines: JSX.Element[] = [];
  for (let x = 0; x <= 1000; x += 50) {
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={620}
        stroke="var(--theme-border)"
        strokeWidth={0.5}
      />,
    );
  }
  for (let y = 0; y <= 620; y += 50) {
    lines.push(
      <line
        key={`h${y}`}
        x1={0}
        y1={y}
        x2={1000}
        y2={y}
        stroke="var(--theme-border)"
        strokeWidth={0.5}
      />,
    );
  }
  return <g>{lines}</g>;
}
