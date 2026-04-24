// Module 2: Lens imaging — rebuilt around a single source/object + single lens + single screen canvas.
const React = (window as any).React;

type LensKind = 'convex' | 'concave';
type LensSourceType = 'object' | 'point' | 'parallel';
type DragTarget = 'source' | 'lens' | 'screen' | 'pan' | null;

interface LensSettings {
  experimentId: 'opt-011' | 'opt-012';
  lensType: LensKind;
  sourceType: LensSourceType;
  focalLength: number;
  objectDistance: number;
  objectHeight: number;
  lensCenterX: number;
  objectX: number;
  screenX: number;
  canvasPanX?: number;
  canvasPanY?: number;
  canvasZoom?: number;
  showScreen: boolean;
  showRays: boolean;
  showFormula: boolean;
  rayThick: number;
}

interface Point { x: number; y: number; }
interface LensRaySegment { from: Point; to: Point; color: string; dashed?: boolean; light?: boolean; }
interface LensRayBundle { key: string; segments: LensRaySegment[]; }

interface LensSolveResult {
  u: number;
  f: number;
  v: number;
  m: number | null;
  imageX: number | null;
  imageHeight: number | null;
  realImage: boolean;
  virtualImage: boolean;
  screenHit: boolean;
  pathMode: string;
  imageNature: string;
  notes: string[];
  rayBundles: LensRayBundle[];
}

const LENS_TYPES: { value: LensKind; label: string; desc: string }[] = [
  { value: 'convex', label: '凸透镜', desc: '会聚，覆盖标准课堂五种典型物距条件' },
  { value: 'concave', label: '凹透镜', desc: '发散，始终成正立缩小虚像' },
];

const SOURCE_TYPES: { value: LensSourceType; label: string }[] = [
  { value: 'object', label: '物体光源' },
  { value: 'parallel', label: '平行光' },
  { value: 'point', label: '点光源' },
];

const LENS_STAGE = {
  width: 1240,
  height: 620,
  axisY: 320,
  axisLeft: 56,
  axisRight: 1180,
  sourceMinX: 96,
  lensMinX: 320,
  lensMaxX: 920,
  screenGapMin: 55,
  screenMaxX: 1140,
  rayEndX: 1160,
  parallelSourceX: 88,
  parallelSourceWidth: 56,
  focalMin: 0.1,
};

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const fmt = (v: number | null | undefined, digits = 2): string => typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—';

const clampLensX = (x: number): number => clamp(x, LENS_STAGE.lensMinX, LENS_STAGE.lensMaxX);
const clampSourceX = (x: number, lensX: number): number => clamp(x, LENS_STAGE.sourceMinX, lensX - 16);
const clampScreenX = (x: number, lensX: number): number => clamp(x, lensX + LENS_STAGE.screenGapMin, LENS_STAGE.screenMaxX);

function resolveObjectDistance(settings: LensSettings, distance: number): { objectX: number; objectDistance: number } {
  const lensX = clampLensX(settings.lensCenterX);
  const nextObjectX = clampSourceX(lensX - distance, lensX);
  return {
    objectX: nextObjectX,
    objectDistance: Math.round((lensX - nextObjectX) * 10) / 10,
  };
}

function extendToX(from: Point, through: Point, toX: number): Point {
  if (Math.abs(through.x - from.x) < 1e-6) return { x: toX, y: through.y };
  const t = (toX - from.x) / (through.x - from.x);
  return { x: toX, y: from.y + (through.y - from.y) * t };
}

function getLensResult(settings: LensSettings): LensSolveResult {
  const axisY = LENS_STAGE.axisY;
  const lensX = clampLensX(settings.lensCenterX);
  const sourceX = clampSourceX(settings.objectX, lensX);
  const f = settings.lensType === 'concave' ? -Math.abs(settings.focalLength) : Math.abs(settings.focalLength);
  const u = lensX - sourceX;
  const pointY = axisY - Math.max(18, settings.objectHeight * 0.78);
  const objectTop: Point = { x: sourceX, y: axisY - settings.objectHeight };
  const pointSource: Point = { x: sourceX, y: pointY };

  const parallelCase = settings.sourceType !== 'parallel' && settings.lensType === 'convex' && Math.abs(u - Math.abs(f)) < 0.02;
  const v = settings.sourceType === 'parallel'
    ? (settings.lensType === 'convex' ? Math.abs(f) : -Math.abs(f))
    : (parallelCase ? Infinity : 1 / (1 / f - 1 / u));
  const imageX = Number.isFinite(v) ? lensX + v : null;
  const realImage = Number.isFinite(v) && v > 0;
  const virtualImage = Number.isFinite(v) && v < 0;
  const m = settings.sourceType === 'parallel' ? null : (parallelCase ? Infinity : -v / u);
  const imageHeight = settings.sourceType === 'parallel' ? null : (m !== null && Number.isFinite(m) ? m * settings.objectHeight : null);
  const screenX = clampScreenX(settings.screenX, lensX);
  const screenHit = settings.showScreen && imageX !== null && realImage && Math.abs(screenX - imageX) < 12;

  let imageNature = '';
  let pathMode = '';
  let notes: string[] = [];
  const absF = Math.abs(f);
  if (settings.sourceType === 'parallel') {
    if (settings.lensType === 'convex') {
      imageNature = '平行光会聚于焦点';
      pathMode = '平行光汇聚';
      notes = ['当前路径：平行光经过凸透镜后汇聚于焦点。', '焦距决定焦点到透镜的距离。', '焦点是平行于主光轴的光线经透镜会聚后的交点，是透镜最基本的光学特征。'];
    } else {
      imageNature = '平行光发散，反向延长交于焦点';
      pathMode = '平行光发散';
      notes = ['当前路径：平行光经过凹透镜后发散。', '需要看反向延长线，交于虚焦点。', '凹透镜的焦点是虚焦点——实际光线并不经过该点，只有反向延长线才交于此处。'];
    }
  } else if (parallelCase) {
    imageNature = 'u = f，不成像';
    pathMode = '边界条件';
    notes = ['当前路径：物体恰好位于焦点处（u = f）。', '透镜后出射光近似平行，因此不形成有限远像。', '这是成像从实像到虚像的临界过渡点：物距从略大于 f 向 f 靠近时，像距趋于无穷远。'];
  } else if (settings.lensType === 'concave') {
    imageNature = '虚像 · 正立 · 缩小';
    pathMode = '凹透镜标准成像';
    notes = ['当前路径：凹透镜使出射光发散，像由反向延长线交汇形成。', '凹透镜对实物始终成正立、缩小的虚像，不随物距变化而改变像的性质。', '虚像位于物体与透镜之间，不能被屏幕接收。'];
  } else if (virtualImage) {
    imageNature = '虚像 · 正立 · 放大';
    pathMode = '凸透镜虚像';
    notes = ['当前路径：物体位于焦距以内（u < f），透镜后光线发散。', '反向延长线在物体同侧交汇，形成正立放大的虚像。', '这就是放大镜的成像原理——眼睛透过透镜看到的是被放大的虚像。'];
  } else {
    const sizeNature = m !== null && Number.isFinite(m)
      ? (Math.abs(Math.abs(m) - 1) < 0.06 ? '等大' : Math.abs(m) > 1 ? '放大' : '缩小')
      : '—';
    imageNature = `实像 · 倒立 · ${sizeNature}`;
    pathMode = screenHit ? '实像落屏' : '实像未落屏';
    if (Math.abs(u - 2 * absF) < 0.5) {
      notes = ['当前路径：物体恰好在 2 倍焦距处（u = 2f）。', '像也在另一侧 2 倍焦距处，成等大倒立实像。', '这是实像从缩小到放大的分界点，物像等距且等大。'];
    } else if (u > 2 * absF) {
      notes = ['当前路径：物体在 2 倍焦距以外（u > 2f）。', '像在另一侧 f 与 2f 之间，成倒立缩小的实像。', '这是照相机的成像原理——远处物体通过镜头在底片上形成缩小的实像。'];
    } else {
      notes = ['当前路径：物体在焦点与 2 倍焦距之间（f < u < 2f）。', '像在另一侧 2f 以外，成倒立放大的实像。', '这是投影仪的成像原理——将小物体放大投射到远处屏幕上。'];
    }
  }

  const bundles: LensRayBundle[] = [];
  if (settings.showRays) {
    if (settings.sourceType === 'parallel') {
      const ys = [axisY - 54, axisY, axisY + 54];
      ys.forEach((y, index) => {
        const hit = { x: lensX, y };
        if (settings.lensType === 'convex') {
          const focus = { x: lensX + Math.abs(f), y: axisY };
          bundles.push({
            key: `parallel-${index}`,
            segments: [
              { from: { x: LENS_STAGE.axisLeft, y }, to: hit, color: 'oklch(0.62 0.17 210)' },
              { from: hit, to: extendToX(hit, focus, LENS_STAGE.rayEndX), color: 'oklch(0.62 0.17 210)' },
            ],
          });
        } else {
          const virtualFocus = { x: lensX - Math.abs(f), y: axisY };
          const forward = extendToX(virtualFocus, hit, LENS_STAGE.rayEndX);
          bundles.push({
            key: `parallel-${index}`,
            segments: [
              { from: { x: LENS_STAGE.axisLeft, y }, to: hit, color: 'oklch(0.62 0.17 210)' },
              { from: hit, to: forward, color: 'oklch(0.62 0.17 210)' },
              { from: hit, to: virtualFocus, color: 'oklch(0.62 0.17 210)', dashed: true, light: true },
            ],
          });
        }
      });
    } else {
      const sourcePoint = settings.sourceType === 'point' ? pointSource : objectTop;
      const centerHit = { x: lensX, y: axisY };
      const topHit = { x: lensX, y: sourcePoint.y };
      const focalLeft = { x: lensX - Math.abs(f), y: axisY };
      const focalRight = { x: lensX + Math.abs(f), y: axisY };
      if (settings.lensType === 'concave') {
        const virtualImagePoint = imageX !== null && imageHeight !== null
          ? { x: imageX, y: axisY - imageHeight }
          : { x: focalLeft.x, y: sourcePoint.y };
        const parallelAfter = extendToX(virtualImagePoint, topHit, LENS_STAGE.rayEndX);
        const focusIn = extendToX(sourcePoint, focalRight, lensX);
        const focusAfter = { x: LENS_STAGE.rayEndX, y: focusIn.y };

        bundles.push({
          key: 'ray-parallel',
          segments: [
            { from: sourcePoint, to: topHit, color: 'oklch(0.68 0.16 24)' },
            { from: topHit, to: parallelAfter, color: 'oklch(0.68 0.16 24)' },
            { from: topHit, to: virtualImagePoint, color: 'oklch(0.68 0.16 24)', dashed: true, light: true },
          ],
        });
        bundles.push({
          key: 'ray-center',
          segments: [
            { from: sourcePoint, to: centerHit, color: 'oklch(0.60 0.15 150)' },
            { from: centerHit, to: extendToX(sourcePoint, centerHit, LENS_STAGE.rayEndX), color: 'oklch(0.60 0.15 150)' },
          ],
        });
        const lensHit3: Point = { x: lensX, y: focusIn.y };
        bundles.push({
          key: 'ray-focus',
          segments: [
            { from: sourcePoint, to: lensHit3, color: 'oklch(0.59 0.15 255)' },
            { from: lensHit3, to: focusAfter, color: 'oklch(0.59 0.15 255)' },
            { from: lensHit3, to: focalRight, color: 'oklch(0.59 0.15 255)', dashed: true, light: true },
          ],
        });
      } else {
        const parallelEnd = extendToX(topHit, focalRight, LENS_STAGE.rayEndX);
        const throughCenterEnd = extendToX(sourcePoint, centerHit, LENS_STAGE.rayEndX);
        const focusIn = extendToX(sourcePoint, focalLeft, lensX);
        const parallelAfter = { x: LENS_STAGE.rayEndX, y: focusIn.y };
        const isVirtual = virtualImage && imageX !== null && imageHeight !== null;
        const virtualImagePt = isVirtual ? { x: imageX!, y: axisY - imageHeight! } : null;

        const ray1Segs: LensRaySegment[] = [
          { from: sourcePoint, to: topHit, color: 'oklch(0.68 0.16 24)' },
          { from: topHit, to: parallelEnd, color: 'oklch(0.68 0.16 24)' },
        ];
        if (isVirtual && virtualImagePt) {
          ray1Segs.push({ from: topHit, to: extendToX(topHit, virtualImagePt, LENS_STAGE.axisLeft), color: 'oklch(0.68 0.16 24)', dashed: true, light: true });
        }
        bundles.push({ key: 'ray-parallel', segments: ray1Segs });

        const ray2Segs: LensRaySegment[] = [
          { from: sourcePoint, to: centerHit, color: 'oklch(0.60 0.15 150)' },
          { from: centerHit, to: throughCenterEnd, color: 'oklch(0.60 0.15 150)' },
        ];
        if (isVirtual && virtualImagePt) {
          ray2Segs.push({ from: centerHit, to: extendToX(centerHit, virtualImagePt, LENS_STAGE.axisLeft), color: 'oklch(0.60 0.15 150)', dashed: true, light: true });
        }
        bundles.push({ key: 'ray-center', segments: ray2Segs });

        const ray3Segs: LensRaySegment[] = [
          { from: sourcePoint, to: focusIn, color: 'oklch(0.59 0.15 255)' },
          { from: focusIn, to: parallelAfter, color: 'oklch(0.59 0.15 255)' },
        ];
        if (isVirtual && virtualImagePt) {
          ray3Segs.push({ from: focusIn, to: extendToX(focusIn, virtualImagePt, LENS_STAGE.axisLeft), color: 'oklch(0.59 0.15 255)', dashed: true, light: true });
        }
        bundles.push({ key: 'ray-focus', segments: ray3Segs });
      }
    }
  }

  return {
    u,
    f,
    v,
    m,
    imageX,
    imageHeight,
    realImage,
    virtualImage,
    screenHit,
    pathMode,
    imageNature,
    notes,
    rayBundles: bundles,
  };
}

function LensModule({ settings }: { settings: LensSettings }) {
  const result = getLensResult(settings);
  const W = LENS_STAGE.width;
  const H = LENS_STAGE.height;
  const axisY = LENS_STAGE.axisY;
  const lensX = clampLensX(settings.lensCenterX);
  const sourceX = clampSourceX(settings.objectX, lensX);
  const screenX = clampScreenX(settings.screenX, lensX);
  const sourcePoint = settings.sourceType === 'point'
    ? { x: sourceX, y: axisY - Math.max(18, settings.objectHeight * 0.78) }
    : { x: sourceX, y: axisY - settings.objectHeight };
  const dragRef = React.useRef<{ kind: DragTarget; startX: number; prev: LensSettings } | null>(null);
  const [dragTarget, setDragTarget] = React.useState<DragTarget>(null);

  React.useEffect(() => {
    if (!dragTarget || !dragRef.current) return;
    const apply = (window as any).__lensSetSettings as ((updater: (prev: LensSettings) => LensSettings) => void) | undefined;
    if (!apply) return;

    const onMove = (event: PointerEvent): void => {
      const info = dragRef.current;
      if (!info) return;
      const dx = event.clientX - info.startX;
      const localDx = dx / (info.prev.canvasZoom ?? 1);

      if (info.kind === 'pan') {
        apply((prev: LensSettings) => ({ ...prev, canvasPanX: (info.prev.canvasPanX ?? 0) + dx }));
        return;
      }
      if (info.kind === 'source') {
        const nextLensX = clampLensX(info.prev.lensCenterX ?? 400);
        const nextObjectX = clampSourceX((info.prev.objectX ?? 360) + localDx, nextLensX);
        apply((prev: LensSettings) => ({
          ...prev,
          objectX: nextObjectX,
          objectDistance: Math.round((clampLensX(prev.lensCenterX ?? 400) - nextObjectX) * 10) / 10,
        }));
        return;
      }
      if (info.kind === 'lens') {
        const prevObjectX = clampSourceX(info.prev.objectX ?? 260, clampLensX(info.prev.lensCenterX ?? 400));
        const nextLensX = clamp((info.prev.lensCenterX ?? 400) + localDx, prevObjectX + 18, LENS_STAGE.lensMaxX);
        apply((prev: LensSettings) => ({
          ...prev,
          lensCenterX: nextLensX,
          objectDistance: Math.round((nextLensX - clampSourceX(prev.objectX ?? 260, nextLensX)) * 10) / 10,
        }));
        return;
      }
      const nextScreenX = clampScreenX((info.prev.screenX ?? 520) + localDx, clampLensX(info.prev.lensCenterX ?? 400));
      apply((prev: LensSettings) => ({ ...prev, screenX: nextScreenX }));
    };

    const onUp = (): void => {
      dragRef.current = null;
      setDragTarget(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragTarget]);

  const beginDrag = (kind: DragTarget) => (event: React.PointerEvent): void => {
    event.stopPropagation();
    dragRef.current = { kind, startX: event.clientX, prev: settings };
    setDragTarget(kind);
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>): void => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    (window as any).__lensSetSettings((prev: LensSettings) => ({ ...prev, canvasZoom: clamp((prev.canvasZoom ?? 1) + delta, 0.7, 1.9) }));
  };

  const handleStageDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    const target = event.target as SVGElement;
    if (target.closest('[data-lens-no-pan="true"]')) return;
    dragRef.current = { kind: 'pan', startX: event.clientX, prev: settings };
    setDragTarget('pan');
  };

  const panX = settings.canvasPanX ?? 0;
  const zoom = clamp(settings.canvasZoom ?? 1, 0.7, 1.9);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" onWheel={handleWheel} onPointerDown={handleStageDown}>
        <defs>
          <filter id="lens-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <LensGrid w={W} h={H} />
        <g transform={`translate(${panX} 0) scale(${zoom})`}>
          <line className="axis" x1={LENS_STAGE.axisLeft} y1={axisY} x2={LENS_STAGE.axisRight} y2={axisY} strokeDasharray="2 4" />
          <text className="label-txt dim" x={LENS_STAGE.axisRight} y={axisY - 8} textAnchor="end">主光轴</text>

          <FocalMark x={lensX - Math.abs(result.f)} y={axisY} label="F" />
          <FocalMark x={lensX + Math.abs(result.f)} y={axisY} label="F′" />
          <FocalMark x={lensX - 2 * Math.abs(result.f)} y={axisY} label="2F" dim />
          <FocalMark x={lensX + 2 * Math.abs(result.f)} y={axisY} label="2F′" dim />

          <g data-lens-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={beginDrag('lens')}>
            <LensShape type={settings.lensType} x={lensX} y={axisY} height={184} />
          </g>

          {settings.sourceType === 'object' && (
            <g data-lens-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={beginDrag('source')}>
              <CandleObject x={sourceX} y={axisY} h={settings.objectHeight} label="蜡烛" />
            </g>
          )}
          {settings.sourceType === 'point' && (
            <g data-lens-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={beginDrag('source')}>
              <ScenePointSource x={sourcePoint.x} y={sourcePoint.y} label="点光源" />
            </g>
          )}
          {settings.sourceType === 'parallel' && (
            <SceneParallelSource x={LENS_STAGE.parallelSourceX} y={axisY} width={LENS_STAGE.parallelSourceWidth} label="平行光源" color="oklch(0.55 0.17 210)" />
          )}

          {result.imageX !== null && settings.sourceType !== 'parallel' && settings.sourceType === 'object' && result.imageHeight !== null && (
            <CandleImage
              x={result.imageX}
              y={axisY}
              h={result.imageHeight}
              label={result.virtualImage ? '虚像' : '像'}
              virtual={result.virtualImage}
            />
          )}

          {result.imageX !== null && settings.sourceType === 'point' && (
            <FocusMarker x={result.imageX} y={axisY - (result.imageHeight ?? 0)} label={result.virtualImage ? '虚像点' : '像点'} virtual={result.virtualImage} />
          )}
          {settings.sourceType === 'parallel' && result.imageX !== null && (
            <FocusMarker x={settings.lensType === 'convex' ? result.imageX : lensX - Math.abs(result.f)} y={axisY} label={settings.lensType === 'convex' ? '焦点会聚' : '虚焦点'} virtual={settings.lensType === 'concave'} />
          )}

          {settings.showRays && result.rayBundles.map((bundle) => (
            <g key={bundle.key}>
              {bundle.segments.map((segment, index) => (
                <LensRenderedRay key={`${bundle.key}-${index}`} segment={segment} thick={settings.rayThick} />
              ))}
            </g>
          ))}

          <DistanceBracket x1={sourceX} x2={lensX} y={axisY + 84} label={settings.sourceType === 'parallel' ? '平行光入射' : `u = ${result.u.toFixed(1)} cm`} />

          {settings.sourceType !== 'parallel' && result.imageX !== null && Number.isFinite(result.v) && result.realImage && (
            <DistanceBracket x1={lensX} x2={result.imageX} y={axisY + 108} label={`v = ${result.v.toFixed(1)} cm`} />
          )}
          {settings.sourceType !== 'parallel' && result.imageX !== null && Number.isFinite(result.v) && result.virtualImage && (
            <DistanceBracket x1={result.imageX} x2={lensX} y={axisY + 108} label={`v = ${result.v.toFixed(1)} cm（虚）`} dashed />
          )}

          {settings.showScreen && (
            <g data-lens-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={beginDrag('screen')}>
              <SceneScreen x={screenX} top={axisY - 150} bottom={axisY + 150} label="屏幕" />
            </g>
          )}

          {settings.showScreen && result.imageX !== null && result.realImage && (
            <DistanceBracket x1={lensX} x2={screenX} y={axisY + 116} label={`屏距 = ${(screenX - lensX).toFixed(1)} cm`} />
          )}
        </g>
      </svg>

      <div className="legend">
        <div className="legend-title">图例</div>
        <div className="legend-row"><span className="swatch" style={{ background: 'oklch(0.68 0.16 24)' }} /><span className="label">特殊光线</span></div>
        <div className="legend-row"><span className="swatch dashed" /><span className="label">反向延长线</span></div>
        <div className="legend-row"><span className="swatch" style={{ background: 'var(--glass-stroke)' }} /><span className="label">透镜 / 屏幕</span></div>
      </div>

      <div className="hud">
        <span className="chip"><span className="dot" />路径 = {result.pathMode}</span>
        <span className="chip"><span className="dot" />像的性质 = {result.imageNature}</span>
        {settings.showScreen && <span className={`chip ${result.screenHit ? 'ok' : (result.virtualImage ? 'warn' : '')}`}><span className="dot" />{result.screenHit ? '成像落在屏上' : result.virtualImage ? '虚像不能落屏' : '像未落在屏上'}</span>}
      </div>

      {settings.showScreen && settings.sourceType === 'object' && (
        <LensScreenPreview screenHit={result.screenHit} imageNature={result.imageNature} imageHeight={result.imageHeight} />
      )}
    </>
  );
}

function LensRenderedRay({ segment, thick }: { segment: LensRaySegment; thick: number }) {
  const col = segment.color;
  if (segment.dashed) {
    return (
      <g>
        <line className="ray" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
          stroke={col} strokeWidth={Math.max(1, thick - 0.15)} opacity={segment.light ? 0.48 : 0.88} strokeDasharray="5 4" />
      </g>
    );
  }
  return (
    <g>
      <line className="ray" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
        stroke={col} strokeWidth={thick + 2.6} opacity={0.18} filter="url(#lens-soft-glow)" />
      <line className="ray" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
        stroke={col} strokeWidth={thick + 0.9} opacity={0.42} />
      <line className="ray" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
        stroke={col} strokeWidth={Math.max(1, thick - 0.15)} opacity={0.98} />
    </g>
  );
}

function LensGrid({ w, h, step = 24 }: { w: number; h: number; step?: number }) {
  const lines: any[] = [];
  for (let x = 0; x <= w; x += step) lines.push(<line key={`vx${x}`} className={`grid-line${x % 120 === 0 ? ' strong' : ''}`} x1={x} y1={0} x2={x} y2={h} />);
  for (let y = 0; y <= h; y += step) lines.push(<line key={`hy${y}`} className={`grid-line${y % 120 === 0 ? ' strong' : ''}`} x1={0} y1={y} x2={w} y2={y} />);
  return <g>{lines}</g>;
}

function LensShape({ type, x, y, height }: { type: LensKind; x: number; y: number; height: number }) {
  if (type === 'convex') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <path className="glass" d={`M 0 ${-height / 2} Q 18 0 0 ${height / 2} Q -18 0 0 ${-height / 2} Z`} />
        <line className="axis" x1={0} y1={-height / 2 - 14} x2={0} y2={height / 2 + 14} strokeDasharray="2 2" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path className="glass" d={`M -8 ${-height / 2} L 8 ${-height / 2} Q -4 0 8 ${height / 2} L -8 ${height / 2} Q 4 0 -8 ${-height / 2} Z`} />
      <line className="axis" x1={0} y1={-height / 2 - 14} x2={0} y2={height / 2 + 14} strokeDasharray="2 2" />
    </g>
  );
}

function FocalMark({ x, y, label, dim }: { x: number; y: number; label: string; dim?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={3.5} fill={dim ? 'var(--ink-3)' : 'var(--accent)'} />
      <text className={`label-txt ${dim ? 'dim' : ''}`} y={18} textAnchor="middle">{label}</text>
    </g>
  );
}

function FocusMarker({ x, y, label, virtual }: { x: number; y: number; label: string; virtual?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={6.5} fill={virtual ? 'none' : 'oklch(0.70 0.18 45)'} stroke="oklch(0.70 0.18 45)" strokeDasharray={virtual ? '4 3' : undefined} />
      <text className="label-txt" x={10} y={-10}>{label}</text>
    </g>
  );
}

function CandleObject({ x, y, h, label }: { x: number; y: number; h: number; label: string }) {
  const bodyH = Math.max(24, h * 0.72);
  const bodyW = Math.max(12, h * 0.18);
  const candleTop = y - bodyH;
  const flameY = candleTop - 10;
  return (
    <g>
      <rect x={x - bodyW / 2} y={candleTop} width={bodyW} height={bodyH} rx={bodyW / 2} fill="oklch(0.91 0.06 85)" stroke="oklch(0.70 0.05 80)" strokeWidth="1.2" />
      <rect x={x - bodyW / 2 + 2} y={candleTop + 5} width={Math.max(3, bodyW - 4)} height={Math.max(8, bodyH - 10)} rx={Math.max(2, (bodyW - 4) / 2)} fill="oklch(0.97 0.03 90)" opacity="0.55" />
      <line x1={x} y1={candleTop + 1} x2={x} y2={candleTop - 4} stroke="oklch(0.25 0.02 40)" strokeWidth="1.2" />
      <path d={`M ${x} ${flameY} C ${x + 5} ${flameY + 6}, ${x + 4} ${flameY + 14}, ${x} ${flameY + 18} C ${x - 5} ${flameY + 14}, ${x - 4} ${flameY + 6}, ${x} ${flameY} Z`} fill="oklch(0.82 0.16 70)" />
      <path d={`M ${x} ${flameY + 5} C ${x + 2} ${flameY + 9}, ${x + 2} ${flameY + 13}, ${x} ${flameY + 15} C ${x - 2} ${flameY + 13}, ${x - 2} ${flameY + 9}, ${x} ${flameY + 5} Z`} fill="oklch(0.98 0.08 100)" />
      <text className="label-txt" x={x + 10} y={candleTop + 4}>{label}</text>
    </g>
  );
}

function CandleImage({ x, y, h, label, virtual }: { x: number; y: number; h: number; label: string; virtual?: boolean }) {
  const absH = Math.abs(h);
  const inverted = h < 0;
  const bodyH = Math.max(16, absH * 0.72);
  const bodyW = Math.max(8, absH * 0.18);
  const scale = inverted ? -1 : 1;
  const candleTop = -bodyH;
  const flameY = candleTop - 8;
  const op = virtual ? 0.48 : 0.72;
  const dash = virtual ? '3 3' : undefined;
  const fillBody = virtual ? 'oklch(0.78 0.02 220)' : 'oklch(0.75 0.10 154)';
  const strokeBody = virtual ? 'oklch(0.64 0.02 220)' : 'oklch(0.58 0.08 154)';
  const fillFlame = virtual ? 'oklch(0.72 0.04 220)' : 'oklch(0.78 0.14 70)';
  const fillCore = virtual ? 'oklch(0.84 0.02 220)' : 'oklch(0.92 0.08 90)';
  return (
    <g transform={`translate(${x}, ${y}) scale(1, ${scale})`} opacity={op}>
      <rect x={-bodyW / 2} y={candleTop} width={bodyW} height={bodyH} rx={bodyW / 2} fill={fillBody} stroke={strokeBody} strokeWidth="1" strokeDasharray={dash} />
      <line x1={0} y1={candleTop + 1} x2={0} y2={candleTop - 3} stroke="oklch(0.35 0.02 40)" strokeWidth="1" strokeDasharray={dash} />
      <path d={`M 0 ${flameY} C 4 ${flameY + 5}, 3 ${flameY + 11}, 0 ${flameY + 14} C -3 ${flameY + 11}, -4 ${flameY + 5}, 0 ${flameY} Z`} fill={fillFlame} />
      <path d={`M 0 ${flameY + 4} C 1.5 ${flameY + 7}, 1.5 ${flameY + 10}, 0 ${flameY + 12} C -1.5 ${flameY + 10}, -1.5 ${flameY + 7}, 0 ${flameY + 4} Z`} fill={fillCore} />
      <text className="label-txt" x={bodyW / 2 + 6} y={candleTop + 2} transform={`scale(1, ${scale})`} fill={virtual ? 'var(--ink-3)' : 'var(--ink)'}>{label}</text>
    </g>
  );
}

function LensScreenPreview({ screenHit, imageNature, imageHeight }: { screenHit: boolean; imageNature: string; imageHeight: number | null }) {
  const previewHeight = imageHeight !== null ? Math.max(24, Math.min(80, Math.abs(imageHeight))) : 36;
  const inverted = imageHeight !== null ? imageHeight < 0 : false;
  return (
    <div className="lens-preview">
      <div className="lens-preview-head">屏幕预览</div>
      <div className="lens-preview-stage">
        <div className={screenHit ? 'lens-preview-screen hit' : 'lens-preview-screen'}>
          {screenHit ? (
            <div className={inverted ? 'lens-preview-candle inverted' : 'lens-preview-candle'} style={{ height: `${previewHeight}px` }}>
              <div className="wax" />
              <div className="flame" />
            </div>
          ) : (
            <div className="lens-preview-empty">未成像</div>
          )}
        </div>
      </div>
      <div className="lens-preview-note">{screenHit ? imageNature : '当前像未落在屏上'}</div>
    </div>
  );
}

function DistanceBracket({ x1, x2, y, label, dashed }: { x1: number; x2: number; y: number; label: string; dashed?: boolean }) {
  const mid = (x1 + x2) / 2;
  const stroke = dashed ? 'var(--ink-3)' : 'var(--ink-3)';
  const dash = dashed ? '3 3' : '2 3';
  return (
    <g opacity={dashed ? 0.65 : 1}>
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={stroke} strokeDasharray={dashed ? '2 2' : undefined} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={stroke} strokeDasharray={dashed ? '2 2' : undefined} />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeDasharray={dash} />
      <text className="label-txt dim" x={mid} y={y + 14} textAnchor="middle">{label}</text>
    </g>
  );
}

function LensControls({ settings, setSettings }: { settings: LensSettings; setSettings: (s: LensSettings | ((prev: LensSettings) => LensSettings)) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const SegSelect = (window as any).SegSelect;
  const maxObjectDistance = Math.max(1, Math.round((clampLensX(settings.lensCenterX) - LENS_STAGE.sourceMinX) * 10) / 10);
  const maxScreenDistance = Math.max(LENS_STAGE.screenGapMin, Math.round((LENS_STAGE.screenMaxX - clampLensX(settings.lensCenterX)) * 10) / 10);

  (window as any).__lensSetSettings = (updater: (prev: LensSettings) => LensSettings): void => {
    setSettings(updater);
  };

  return (
    <>
      <SectionTitle aside="LENS">透镜对象</SectionTitle>
      <div className="seg vertical">
        {LENS_TYPES.map((item) => (
          <button key={item.value} className={settings.lensType === item.value ? 'seg-item active' : 'seg-item'} onClick={() => setSettings({ ...settings, lensType: item.value, experimentId: item.value === 'convex' ? 'opt-011' : 'opt-012' })}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="ref-panel-note">
        <strong>{LENS_TYPES.find((item) => item.value === settings.lensType)?.label}</strong>
        <span>{LENS_TYPES.find((item) => item.value === settings.lensType)?.desc}</span>
      </div>

      <SectionTitle aside="SOURCE">主光源</SectionTitle>
      <SegSelect value={settings.sourceType} onChange={(v: LensSourceType) => setSettings({ ...settings, sourceType: v })} options={SOURCE_TYPES} />

      <SectionTitle aside="PARAMS">关键参数</SectionTitle>
      <div className="lens-compact-grid">
        <label className="lens-number-field">
          <div className="slider-head">
            <span className="slider-label">焦距 f</span>
            <span className="slider-value"><span className="num">{settings.focalLength}</span><span className="unit">cm</span></span>
          </div>
          <input
            type="number"
            min={LENS_STAGE.focalMin}
            step="any"
            value={settings.focalLength}
            onChange={(event: any) => {
              const next = parseFloat(event.target.value);
              if (Number.isFinite(next) && next > 0) setSettings({ ...settings, focalLength: next });
            }}
            onBlur={(event: any) => {
              const next = parseFloat(event.target.value);
              if (!Number.isFinite(next) || next <= 0) setSettings({ ...settings, focalLength: LENS_STAGE.focalMin });
            }}
          />
          <div className="slider-hint">输入任意正数即可，自由调节焦距。</div>
        </label>
        {settings.sourceType !== 'parallel' && (
          <>
            <Slider
              label="物距 u"
              value={settings.objectDistance}
              onChange={(v: number) => setSettings({ ...settings, ...resolveObjectDistance(settings, v) })}
              min={1}
              max={maxObjectDistance}
              step={1}
              unit="cm"
            />
            <Slider label={settings.sourceType === 'point' ? '光源高度 h' : '物高 h'} value={settings.objectHeight} onChange={(v: number) => setSettings({ ...settings, objectHeight: v })} min={20} max={80} step={1} unit="cm" />
          </>
        )}
      </div>

      {settings.sourceType !== 'parallel' && settings.lensType === 'convex' && (
        <>
          <SectionTitle aside="SCENE">典型物距</SectionTitle>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, ...resolveObjectDistance(settings, Math.round(settings.focalLength * 2.5)) })}>u {'>'} 2f</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, ...resolveObjectDistance(settings, Math.round(settings.focalLength * 2)) })}>u = 2f</button>
          </div>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, ...resolveObjectDistance(settings, Math.round(settings.focalLength * 1.5)) })}>f {'<'} u {'<'} 2f</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, ...resolveObjectDistance(settings, Math.round(settings.focalLength)) })}>u = f</button>
          </div>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, ...resolveObjectDistance(settings, Math.round(settings.focalLength * 0.5)) })}>u {'<'} f</button>
          </div>
        </>
      )}

      {settings.showScreen && (
        <>
          <SectionTitle aside="SCREEN">屏幕位置</SectionTitle>
          <Slider label="屏距" value={Math.round((clampScreenX(settings.screenX, clampLensX(settings.lensCenterX)) - clampLensX(settings.lensCenterX)) * 10) / 10} onChange={(v: number) => setSettings({ ...settings, screenX: clampLensX(settings.lensCenterX) + v })} min={LENS_STAGE.screenGapMin} max={maxScreenDistance} step={1} unit="cm" />
        </>
      )}

      <SectionTitle aside="OBJECT">对象交互</SectionTitle>
      <div className="ref-panel-note">
        <strong>直接拖动对象</strong>
        <span>画布中可直接拖动物体 / 光源、透镜和屏幕，空白处拖动画布，滚轮缩放。</span>
      </div>

      <SectionTitle aside="CANVAS">画布</SectionTitle>
      <Slider label="缩放" value={settings.canvasZoom ?? 1} onChange={(v: number) => setSettings({ ...settings, canvasZoom: v })} min={0.7} max={1.9} step={0.05} unit="x" />
      <div className="preset-row">
        <button className="preset-btn" onClick={() => setSettings({ ...settings, canvasPanX: 0 })}>居中画布</button>
        <button className="preset-btn" onClick={() => setSettings((prev: LensSettings) => ({ ...prev, lensCenterX: 560, objectX: 535, objectDistance: 25, screenX: 900, canvasPanX: 0, canvasZoom: 1 }))}>重置对象</button>
      </div>

      <SectionTitle aside="DISPLAY">显示</SectionTitle>
      <Toggle label="显示屏幕" checked={settings.showScreen} onChange={(v: boolean) => setSettings({ ...settings, showScreen: v })} />
      <Toggle label="三条特殊光线" checked={settings.showRays} onChange={(v: boolean) => setSettings({ ...settings, showRays: v })} />
      <Toggle label="公式验证" checked={settings.showFormula} onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />
    </>
  );
}

function LensReadouts({ settings }: { settings: LensSettings }) {
  const SectionTitle = (window as any).SectionTitle;
  const FormulaBlock = (window as any).FormulaBlock;
  const result = getLensResult(settings);
  const screenHitLabel = settings.showScreen
    ? (result.screenHit ? '成像落在屏上' : result.virtualImage ? '虚像不能落屏' : '像未落在屏上')
    : '屏幕关闭';

  return (
    <>
      <SectionTitle aside="MODEL">对象说明</SectionTitle>
      <div className="formula ref-readout-summary">
        <span className="step"><span className="lhs">{settings.lensType === 'convex' ? '凸透镜' : '凹透镜'}</span><span className="eq">=</span><span className="rhs">{settings.lensType === 'convex' ? '会聚透镜' : '发散透镜'}</span></span>
        {result.notes.map((note, i) => <span key={i} className="step">{note}</span>)}
      </div>

      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="lens-readout-hero-grid">
        <div className="lens-summary-card primary">
          <div className="lens-summary-label">像的性质</div>
          <div className="lens-summary-value">{result.imageNature}</div>
        </div>
        <div className={`lens-summary-card ${result.screenHit ? 'ok' : result.virtualImage ? 'warn' : ''}`}>
          <div className="lens-summary-label">屏幕判定</div>
          <div className="lens-summary-value">{screenHitLabel}</div>
        </div>
      </div>

      <div className="lens-path-card">
        <div className="lens-path-label">路径模式</div>
        <div className="lens-path-value">{result.pathMode}</div>
      </div>

      <div className="lens-readout-grid">
        <div className="lens-mini-readout">
          <div className="lens-mini-label">透镜类型</div>
          <div className="lens-mini-value">{settings.lensType === 'convex' ? '凸透镜' : '凹透镜'}</div>
        </div>
        <div className="lens-mini-readout">
          <div className="lens-mini-label">光源类型</div>
          <div className="lens-mini-value">{settings.sourceType === 'object' ? '物体光源' : settings.sourceType === 'point' ? '点光源' : '平行光'}</div>
        </div>
        <div className="lens-mini-readout">
          <div className="lens-mini-label">焦距 f</div>
          <div className="lens-mini-value mono">{fmt(result.f, 1)} <span>cm</span></div>
        </div>
        <div className="lens-mini-readout">
          <div className="lens-mini-label">物距 u</div>
          <div className="lens-mini-value mono">{settings.sourceType === 'parallel' ? '∞' : fmt(result.u, 1)} {settings.sourceType === 'parallel' ? '' : <span>cm</span>}</div>
        </div>
        <div className="lens-mini-readout hi">
          <div className="lens-mini-label">像距 v</div>
          <div className="lens-mini-value mono">{Number.isFinite(result.v) ? fmt(result.v, 1) : '∞'} <span>cm</span></div>
        </div>
        {result.m !== null && (
          <div className="lens-mini-readout">
            <div className="lens-mini-label">放大率 m</div>
            <div className="lens-mini-value mono">{Number.isFinite(result.m) ? fmt(result.m, 3) : '∞'}</div>
          </div>
        )}
        {result.imageHeight !== null && (
          <div className="lens-mini-readout">
            <div className="lens-mini-label">像高 h'</div>
            <div className="lens-mini-value mono">{fmt(result.imageHeight, 1)} <span>cm</span></div>
          </div>
        )}
        {settings.sourceType !== 'parallel' && (
          <div className={`lens-mini-readout ${result.realImage ? 'hi' : ''}`}>
            <div className="lens-mini-label">实像</div>
            <div className="lens-mini-value">{result.realImage ? '是' : '否'}</div>
          </div>
        )}
        {settings.sourceType !== 'parallel' && (
          <div className={`lens-mini-readout ${result.virtualImage ? 'hi' : ''}`}>
            <div className="lens-mini-label">虚像</div>
            <div className="lens-mini-value">{result.virtualImage ? '是' : '否'}</div>
          </div>
        )}
        {settings.sourceType !== 'parallel' && (
          <div className={`lens-mini-readout ${result.screenHit ? 'hi' : ''}`}>
            <div className="lens-mini-label">落屏</div>
            <div className="lens-mini-value">{settings.showScreen ? (result.screenHit ? '是' : '否') : '屏幕关闭'}</div>
          </div>
        )}
      </div>

      {settings.showFormula && (
        <>
          <SectionTitle aside="FORMULA">公式验证</SectionTitle>
          <FormulaBlock>
            {result.notes.map((line, index) => (
              <span key={index} className="step">{line}</span>
            ))}
            {settings.sourceType === 'parallel' ? (
              <>
                <span className="step">---</span>
                <span className="step"><span className="lhs">平行光</span><span className="eq">→</span><span className="rhs">{settings.lensType === 'convex' ? '汇聚于焦点' : '发散，反向延长交于焦点'}</span></span>
                <span className="step mono">{settings.lensType === 'convex' ? `像距 = f = ${Math.abs(result.f).toFixed(1)} cm` : `虚焦点位置 = ${Math.abs(result.f).toFixed(1)} cm`}</span>
              </>
            ) : (
              <>
                <span className="step">---</span>
                <span className="step"><span className="lhs">1/u + 1/v</span><span className="eq">=</span><span className="rhs">1/f</span></span>
                <span className="step mono">1/{result.u.toFixed(1)} + 1/v = 1/{result.f.toFixed(1)}</span>
                {Number.isFinite(result.v) ? (
                  <>
                    <span className="step mono">v = {result.v.toFixed(2)} cm</span>
                    {result.m !== null && <span className="step mono">m = −v/u = {Number.isFinite(result.m) ? result.m.toFixed(3) : '∞'}</span>}
                  </>
                ) : (
                  <span className="step mono">当前为边界条件：u = f，像距趋于无穷远。</span>
                )}
              </>
            )}
          </FormulaBlock>
        </>
      )}
    </>
  );
}

Object.assign(window, { LensModule, LensControls, LensReadouts, LENS_TYPES, SOURCE_TYPES });

export {};
