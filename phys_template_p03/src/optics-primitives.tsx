// Shared optics scene primitives for draggable setups.
const React = (window as any).React;

function useSceneDrag<T extends string>({
  svgRef,
  dragTarget,
  setDragTarget,
  setterName,
  onMoveX,
  width = 800,
}: {
  svgRef: { current: SVGSVGElement | null };
  dragTarget: T | null;
  setDragTarget: (target: T | null) => void;
  setterName: string;
  onMoveX: (target: T, x: number, prev: any) => any;
  width?: number;
}) {
  React.useEffect(() => {
    if (!dragTarget) return;
    const apply = (window as any)[setterName] as ((updater: (prev: any) => any) => void) | undefined;
    if (!apply) return;
    let latestClientX: number | null = null;
    let rafId: number | null = null;

    const flush = (): void => {
      rafId = null;
      if (latestClientX === null || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((latestClientX - rect.left) / rect.width) * width;
      latestClientX = null;
      apply((prev: any) => onMoveX(dragTarget, x, prev));
    };

    const onMove = (event: PointerEvent): void => {
      latestClientX = event.clientX;
      if (rafId === null) rafId = window.requestAnimationFrame(flush);
    };

    const onUp = (): void => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        flush();
      }
      setDragTarget(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragTarget, onMoveX, setDragTarget, setterName, svgRef, width]);
}

function SceneDragHandle({ x, y, label, onPointerDown }: { x: number; y: number; label: string; onPointerDown: () => void }) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'grab' }} onPointerDown={onPointerDown}>
      <circle r="8" fill="var(--accent-strong)" opacity="0.88" />
      <text className="label-txt dim" x="12" y="4">{label}</text>
    </g>
  );
}

function ScenePointSource({ x, y, label = '光源' }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="7" fill="oklch(0.70 0.18 45)" />
      <circle cx={x} cy={y} r="12" fill="none" stroke="oklch(0.70 0.18 45 / 0.28)" />
      <text className="label-txt" x={x - 6} y={y - 17} style={{ pointerEvents: 'none' }}>{label}</text>
    </g>
  );
}

function SceneParallelSource({
  x,
  y,
  width = 40,
  label = '平行光源',
  color = 'oklch(0.60 0.18 210)',
}: { x: number; y: number; width?: number; label?: string; color?: string }) {
  return (
    <g>
      <text className="label-txt" x={x} y={y - 60}>{label}</text>
      <line x1={x} y1={y - 40} x2={x + width} y2={y - 40} className="ray" stroke={color} strokeWidth="2.4" />
      <line x1={x} y1={y} x2={x + width} y2={y} className="ray" stroke={color} strokeWidth="2.4" />
      <line x1={x} y1={y + 40} x2={x + width} y2={y + 40} className="ray" stroke={color} strokeWidth="2.4" />
    </g>
  );
}

function SceneScreen({ x, top = 20, bottom = 130, label = '屏幕' }: { x: number; top?: number; bottom?: number; label?: string }) {
  return (
    <g>
      <line x1={x} y1={top} x2={x} y2={bottom} className="screen-line" />
      <text className="label-txt" x={x + 8} y={top - 2} style={{ pointerEvents: 'none' }}>{label}</text>
    </g>
  );
}

function SceneDistanceLabel({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="var(--ink-3)" strokeDasharray="4 4" />
      <text className="label-txt dim" x={(x1 + x2) / 2} y={y - 7} textAnchor="middle" style={{ pointerEvents: 'none' }}>{label}</text>
    </g>
  );
}

function SceneLinearSetup({
  svgRef,
  sourceX,
  elementX,
  screenX,
  elementLabel,
  distanceLabel,
  onSourceDown,
  onElementDown,
  onScreenDown,
  renderElement,
}: {
  svgRef: { current: SVGSVGElement | null };
  sourceX: number;
  elementX: number;
  screenX: number;
  elementLabel: string;
  distanceLabel: string;
  onSourceDown: (event: any) => void;
  onElementDown: (event: any) => void;
  onScreenDown: (event: any) => void;
  renderElement: () => any;
}) {
  return (
    <svg ref={svgRef} className="scene-linear-setup" viewBox="0 0 800 150" preserveAspectRatio="xMidYMid meet">
      <line x1={sourceX} y1={75} x2={elementX} y2={75} className="ray" stroke="oklch(0.60 0.18 210)" strokeWidth="2.4" />
      <g style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={onElementDown}>
        <rect x={elementX - 28} y={16} width={56} height={118} rx={16} fill="rgba(0,0,0,0.001)" pointerEvents="all" />
        {renderElement()}
      </g>
      <g style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={onScreenDown}>
        <line x1={screenX} y1={12} x2={screenX} y2={138} stroke="transparent" strokeWidth="36" />
        <SceneScreen x={screenX} top={20} bottom={130} label="屏幕" />
      </g>
      <g style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={onSourceDown}>
        <circle cx={sourceX} cy={75} r="24" fill="rgba(0,0,0,0.001)" pointerEvents="all" />
        <ScenePointSource x={sourceX} y={75} label="光源" />
      </g>
      <text className="label-txt" x={elementX + 8} y={50} style={{ pointerEvents: 'none' }}>{elementLabel}</text>
      <SceneDistanceLabel x1={elementX} x2={screenX} y={75} label={distanceLabel} />
    </svg>
  );
}

Object.assign(window, {
  useSceneDrag,
  SceneDragHandle,
  ScenePointSource,
  SceneParallelSource,
  SceneScreen,
  SceneDistanceLabel,
  SceneLinearSetup,
});

export {};
