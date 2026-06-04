/**
 * MediumShape.tsx
 * Renders the correct glass/water/fiber shape based on settings.shape.
 * Handles 5 different shapes: interface, slab, half, fiber, apparent.
 * (snellwindow is a 3D scene handled elsewhere.)
 *
 * Ported from old module-refraction.tsx MediumShape component.
 */

import type { CSSProperties } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { MATERIALS } from '@/data/refractionData';
import type { Point } from '@/data/refractionData';
import {
  makeFiberGeometry,
  buildFiberBoundaryPath,
  buildFiberBandPath,
  buildFiberCenterPath,
} from '@/engine/refractionGeometry';

// ---------------------------------------------------------------------------
// Shared label text style
// ---------------------------------------------------------------------------

const labelStyle: CSSProperties = {
  pointerEvents: 'none',
  fontSize: 13,
  fontFamily: 'inherit',
};

const dimFill = 'rgba(255,255,255,0.35)';

// ---------------------------------------------------------------------------
// Sub-renderers for each shape
// ---------------------------------------------------------------------------

function InterfaceShape() {
  const settings = useSimulationStore((s) => s.settings);
  const y = settings.elementCenterY ?? 260;

  const isWater = Math.abs(settings.medium2N - MATERIALS.water.n) < 0.05;
  const fill = isWater ? 'rgba(100, 160, 230, 0.18)' : 'rgba(140, 200, 190, 0.18)';
  const n1 = settings.medium1N;
  const n2 = settings.medium2N;

  return (
    <g>
      {/* Lower medium fill — full width */}
      <rect x={-500} y={y} width={2000} height={1200} fill={fill} />
      {/* Interface line — full width */}
      <line x1={-500} y1={y} x2={1500} y2={y} stroke="rgba(52, 122, 110, 0.78)" strokeWidth={1.5} />
      {/* Medium labels */}
      <text x={960} y={y - 14} textAnchor="end" fill="var(--theme-text-muted)" style={labelStyle}>
        n₁ = {n1.toFixed(3)}
      </text>
      <text x={960} y={y + 24} textAnchor="end" fill="var(--theme-text-muted)" style={labelStyle}>
        n₂ = {n2.toFixed(3)}
      </text>
    </g>
  );
}

function SlabShape() {
  const settings = useSimulationStore((s) => s.settings);
  const x = settings.elementCenterX ?? 500;
  const y = settings.elementCenterY ?? 250;
  const h = settings.slabThicknessCm * 20;

  return (
    <g>
      {/* Glass body */}
      <rect
        x={x - 260}
        y={y}
        width={520}
        height={h}
        rx={0}
        fill="rgba(187, 221, 214, 0.14)"
        stroke="rgba(52, 122, 110, 0.45)"
        strokeWidth={1}
      />
      {/* Top interface */}
      <line
        x1={x - 260}
        y1={y}
        x2={x + 260}
        y2={y}
        stroke="rgba(52, 122, 110, 0.78)"
        strokeWidth={1.2}
      />
      {/* Bottom interface */}
      <line
        x1={x - 260}
        y1={y + h}
        x2={x + 260}
        y2={y + h}
        stroke="rgba(52, 122, 110, 0.78)"
        strokeWidth={1.2}
      />
    </g>
  );
}

function HalfShape() {
  const settings = useSimulationStore((s) => s.settings);
  const center: Point = {
    x: settings.elementCenterX ?? 520,
    y: settings.elementCenterY ?? 270,
  };
  const R = settings.hemisphereRadiusCm * 24;

  // Semicircle path: flat top, arc below
  const d = `M ${center.x - R} ${center.y} L ${center.x + R} ${center.y} A ${R} ${R} 0 0 1 ${center.x - R} ${center.y} Z`;

  return (
    <g>
      {/* Glass half-disk */}
      <path
        d={d}
        fill="rgba(187, 221, 214, 0.14)"
        stroke="rgba(52, 122, 110, 0.45)"
        strokeWidth={1}
      />
      {/* Flat interface line (extends slightly beyond the disk) */}
      <line
        x1={center.x - R - 40}
        y1={center.y}
        x2={center.x + R + 40}
        y2={center.y}
        stroke="rgba(52, 122, 110, 0.78)"
        strokeWidth={1.2}
      />
    </g>
  );
}

function FiberShape() {
  const settings = useSimulationStore((s) => s.settings);
  const geom = makeFiberGeometry(settings);

  const closedCladding = buildFiberBandPath(geom, geom.claddingHalf);
  const closedCore = buildFiberBandPath(geom, geom.coreHalf);
  const centerLine = buildFiberCenterPath(geom);
  const coreTop = buildFiberBoundaryPath(geom, 'top', geom.coreHalf);
  const coreBottom = buildFiberBoundaryPath(geom, 'bottom', geom.coreHalf);

  return (
    <g>
      {/* Cladding band */}
      <path
        d={closedCladding}
        fill="rgba(150, 177, 172, 0.10)"
        stroke="rgba(120, 140, 136, 0.32)"
        strokeWidth={1.2}
      />
      {/* Core band */}
      <path
        d={closedCore}
        fill="rgba(187, 221, 214, 0.14)"
        stroke="rgba(52, 122, 110, 0.45)"
        strokeWidth={1}
      />
      {/* Center guide line */}
      <path
        d={centerLine}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {/* Core top boundary */}
      <path
        d={coreTop}
        fill="none"
        stroke="rgba(52, 122, 110, 0.78)"
        strokeWidth={1.2}
      />
      {/* Core bottom boundary */}
      <path
        d={coreBottom}
        fill="none"
        stroke="rgba(52, 122, 110, 0.78)"
        strokeWidth={1.2}
      />
    </g>
  );
}

function ApparentShape() {
  const settings = useSimulationStore((s) => s.settings);
  const surfaceY = settings.elementCenterY ?? 260;
  const cx = settings.elementCenterX ?? 500;
  const mode = settings.apparentMode ?? 'depth';
  const depthCm = settings.apparentObjectDepthCm ?? 5;
  const depthPx = depthCm * 20;
  const nWater = settings.apparentWaterN ?? 1.333;
  const apparentCm = mode === 'depth' ? depthCm / nWater : depthCm * nWater;
  const apparentPx = apparentCm * 20;
  const objectY = mode === 'depth' ? surfaceY + depthPx : surfaceY - depthPx;
  const virtualY = mode === 'depth' ? surfaceY + apparentPx : surfaceY - apparentPx;
  const dimLeftX = cx - 180;
  const dimRightX = cx + 180;

  return (
    <g>
      {/* Water fill below surface */}
      <rect x={-2000} y={surfaceY} width={4000} height={1600} fill="rgba(129, 171, 228, 0.10)" />

      {/* Water surface line */}
      <line
        x1={-2000}
        y1={surfaceY}
        x2={2000}
        y2={surfaceY}
        stroke="rgba(52, 122, 110, 0.78)"
        strokeWidth={1.2}
      />

      {/* Labels: surface, air, water */}
      <text x={cx + 240} y={surfaceY - 6} fill={dimFill} style={labelStyle}>
        水面
      </text>
      <text x={cx + 240} y={surfaceY - 26} fill={dimFill} style={labelStyle}>
        空气 n = 1.0
      </text>
      <text x={cx + 240} y={surfaceY + 20} fill={dimFill} style={labelStyle}>
        水 n = {nWater.toFixed(3)}
      </text>

      {/* Real object marker */}
      <circle cx={cx} cy={objectY} r={5} fill="oklch(0.60 0.22 150)" />
      <circle
        cx={cx}
        cy={objectY}
        r={10}
        fill="none"
        stroke="oklch(0.60 0.22 150 / 0.25)"
      />
      <text
        x={cx + 16}
        y={objectY + 4}
        fill="oklch(0.60 0.22 150)"
        style={labelStyle}
      >
        实物
      </text>

      {/* Virtual image marker */}
      <circle
        cx={cx}
        cy={virtualY}
        r={5}
        fill="none"
        stroke="oklch(0.55 0.18 280)"
        strokeWidth={1.6}
        strokeDasharray="3 2"
      />
      <text
        x={cx - 16}
        y={virtualY + 4}
        textAnchor="end"
        fill="oklch(0.55 0.18 280)"
        style={labelStyle}
      >
        虚像
      </text>

      {/* Left dimension: real depth h */}
      <line
        x1={dimLeftX}
        y1={surfaceY}
        x2={dimLeftX}
        y2={objectY}
        stroke="var(--ink-3, rgba(255,255,255,0.25))"
        strokeWidth={0.8}
        strokeDasharray="4 3"
      />
      <line
        x1={dimLeftX - 4}
        y1={surfaceY}
        x2={dimLeftX + 4}
        y2={surfaceY}
        stroke="var(--ink-3, rgba(255,255,255,0.25))"
        strokeWidth={0.8}
      />
      <line
        x1={dimLeftX - 4}
        y1={objectY}
        x2={dimLeftX + 4}
        y2={objectY}
        stroke="var(--ink-3, rgba(255,255,255,0.25))"
        strokeWidth={0.8}
      />
      <text
        x={dimLeftX - 8}
        y={(surfaceY + objectY) / 2}
        textAnchor="end"
        dominantBaseline="middle"
        fill={dimFill}
        style={labelStyle}
      >
        h = {depthCm.toFixed(1)} cm
      </text>

      {/* Right dimension: apparent depth/height h' */}
      <line
        x1={dimRightX}
        y1={surfaceY}
        x2={dimRightX}
        y2={virtualY}
        stroke="oklch(0.55 0.18 280)"
        strokeWidth={0.8}
        strokeDasharray="3 2"
      />
      <line
        x1={dimRightX - 4}
        y1={surfaceY}
        x2={dimRightX + 4}
        y2={surfaceY}
        stroke="oklch(0.55 0.18 280)"
        strokeWidth={0.8}
      />
      <line
        x1={dimRightX - 4}
        y1={virtualY}
        x2={dimRightX + 4}
        y2={virtualY}
        stroke="oklch(0.55 0.18 280)"
        strokeWidth={0.8}
      />
      <text
        x={dimRightX + 8}
        y={(surfaceY + virtualY) / 2}
        fill="oklch(0.55 0.18 280)"
        dominantBaseline="middle"
        style={labelStyle}
      >
        h' = {apparentCm.toFixed(2)} cm
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function MediumShape() {
  const shape = useSimulationStore((s) => s.settings.shape);

  switch (shape) {
    case 'interface':
      return <InterfaceShape />;
    case 'slab':
      return <SlabShape />;
    case 'half':
      return <HalfShape />;
    case 'fiber':
      return <FiberShape />;
    case 'apparent':
      return <ApparentShape />;
    default:
      return null;
  }
}
