/**
 * ThinFilmCanvas.tsx
 * Hybrid SVG + Canvas renderer for the thin-film interference module.
 *
 * Layout: vertical stack of cards --
 *   1. SVG cause diagram (optical setup cross-section showing two reflections)
 *   2. Canvas interference pattern
 *   3. Canvas intensity/relation plot (optional)
 *
 * Newton's rings has a draggable sample point on the SVG diagram.
 * Soap bubble renders RGB composite with wobble.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import {
  clamp,
  drawThinFilmPattern,
  drawThinFilmPlot,
  newtonDiagramLensY,
  NEWTON_SAMPLE_X_MIN,
  NEWTON_SAMPLE_X_RANGE,
} from '@/engine/thinFilmSolver';
import type { ThinFilmSettings } from '@/data/thinFilmData';

// ---------------------------------------------------------------------------
// SVG cause diagrams
// ---------------------------------------------------------------------------

function SoapDiagram({ settings }: { settings: ThinFilmSettings }) {
  const { filmN, thickness } = settings;
  return (
    <svg viewBox="0 0 900 260" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="soap-film-h" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.78)" />
          <stop offset="100%" stopColor="rgba(110, 255, 215, 0.38)" />
        </linearGradient>
      </defs>
      <line x1="200" y1="110" x2="580" y2="110" stroke="var(--theme-text-muted, #888)" strokeWidth="5" />
      <line x1="200" y1="180" x2="580" y2="180" stroke="var(--theme-text-muted, #888)" strokeWidth="5" />
      <rect x="200" y="110" width="380" height="70" fill="url(#soap-film-h)" opacity="0.72" />
      <text x="590" y="118" style={{ fontSize: 15, fill: 'var(--theme-text-muted, #888)' }}>上表面</text>
      <text x="590" y="188" style={{ fontSize: 15, fill: 'var(--theme-text-muted, #888)' }}>下表面</text>

      {/* Incident ray */}
      <line x1="390" y1="22" x2="390" y2="110" stroke="rgba(255,199,62,0.96)" strokeWidth="4" />
      <polygon points="390,106 385,92 395,92" fill="rgba(255,199,62,0.96)" />

      {/* Through film */}
      <line x1="390" y1="110" x2="390" y2="180" stroke="rgba(255,199,62,0.44)" strokeWidth="2.5" />

      {/* Upper surface reflection */}
      <line x1="390" y1="110" x2="370" y2="22" stroke="rgba(255,120,120,0.88)" strokeWidth="3.6" />
      <polygon points="370,26 365,40 375,40" fill="rgba(255,120,120,0.88)" />

      {/* Lower surface reflection */}
      <line x1="390" y1="180" x2="410" y2="22" stroke="rgba(100,220,255,0.88)" strokeWidth="3.6" />
      <polygon points="410,26 405,40 415,40" fill="rgba(100,220,255,0.88)" />

      {/* Labels */}
      <text x="286" y="42" style={{ fontSize: 15, fill: 'rgba(255,120,120,0.92)' }}>上表面反射 ①</text>
      <text x="422" y="42" style={{ fontSize: 15, fill: 'var(--theme-text, #222)' }}>入射光</text>
      <text x="422" y="62" style={{ fontSize: 15, fill: 'rgba(100,220,255,0.92)' }}>下表面反射 ②</text>

      {/* Thickness annotation */}
      <line x1="178" y1="110" x2="178" y2="180" stroke="var(--theme-text-muted, #888)" strokeWidth="2" strokeDasharray="4 3" />
      <polygon points="178,112 173,124 183,124" fill="rgba(80,80,80,0.6)" />
      <polygon points="178,178 173,166 183,166" fill="rgba(80,80,80,0.6)" />
      <text x="152" y="150" style={{ fontSize: 16, fill: 'var(--theme-text, #222)' }} textAnchor="end">t</text>

      {/* Thickness variation hint */}
      <line x1="240" y1="210" x2="540" y2="210" stroke="var(--theme-text-muted, #888)" strokeWidth="2" strokeDasharray="4 3" />
      <polygon points="240,210 254,205 254,215" fill="rgba(80,80,80,0.6)" />
      <polygon points="540,210 526,205 526,215" fill="rgba(80,80,80,0.6)" />
      <text x="390" y="236" style={{ fontSize: 15, fill: 'var(--theme-text-muted, #888)' }} textAnchor="middle">膜厚沿水平方向变化</text>
      <text x="240" y="236" style={{ fontSize: 13, fill: 'var(--theme-text-muted, #888)' }} textAnchor="middle">薄</text>
      <text x="540" y="236" style={{ fontSize: 13, fill: 'var(--theme-text-muted, #888)' }} textAnchor="middle">厚</text>

      {/* Right-side parameters */}
      <text x="680" y="120" style={{ fontSize: 16, fill: 'var(--theme-text, #222)' }}>n = {filmN.toFixed(2)}</text>
      <text x="680" y="146" style={{ fontSize: 16, fill: 'var(--theme-text, #222)' }}>t ≈ {Math.round(thickness)} nm</text>
      <text x="680" y="174" style={{ fontSize: 14, fill: 'var(--theme-text-muted, #888)' }}>垂直入射 (θ = 0)</text>
    </svg>
  );
}

function WedgeDiagram({ settings }: { settings: ThinFilmSettings }) {
  const { wedgeAngle, wedgeProfile } = settings;
  const profile = wedgeProfile ?? 'linear';
  const hitX = 440;
  const bottomY = 168;

  const topPath = profile === 'linear'
    ? 'M 286 128 L 688 72'
    : profile === 'convex'
      ? 'M 286 128 Q 500 18 688 72'
      : 'M 286 128 Q 500 184 688 72';

  const topYAt = (x: number): number => {
    const t = clamp((x - 286) / (688 - 286), 0, 1);
    if (profile === 'linear') return 128 + (72 - 128) * t;
    const controlY = profile === 'convex' ? 18 : 184;
    return (1 - t) * (1 - t) * 128 + 2 * (1 - t) * t * controlY + t * t * 72;
  };
  const topY = topYAt(hitX);

  return (
    <svg viewBox="0 0 900 260" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Wedge structure */}
      <path d={topPath} stroke="var(--theme-text, #222)" strokeWidth="5" fill="none" />
      <line x1="286" y1="168" x2="688" y2="168" stroke="var(--theme-text, #222)" strokeWidth="5" />
      <path d={`${topPath} L 688 168 L 286 168 Z`} fill="rgba(170,220,205,0.18)" />

      {/* Incident ray */}
      <line x1={hitX} y1="18" x2={hitX} y2={topY} stroke="rgba(255,199,62,0.96)" strokeWidth="4" />
      <circle cx={hitX} cy={topY} r="4" fill="rgba(255,199,62,0.96)" />

      {/* Through film */}
      <line x1={hitX} y1={topY} x2={hitX} y2={bottomY} stroke="rgba(255,199,62,0.44)" strokeWidth="2.5" />

      {/* Upper surface reflection */}
      <line x1={hitX} y1={topY} x2={hitX - 24} y2="18" stroke="rgba(255,120,120,0.88)" strokeWidth="3.6" />
      <polygon points={`${hitX - 24},22 ${hitX - 29},36 ${hitX - 19},36`} fill="rgba(255,120,120,0.88)" />

      {/* Lower surface reflection */}
      <line x1={hitX} y1={bottomY} x2={hitX + 24} y2="18" stroke="rgba(100,220,255,0.88)" strokeWidth="3.6" />
      <polygon points={`${hitX + 24},22 ${hitX + 19},36 ${hitX + 29},36`} fill="rgba(100,220,255,0.88)" />

      {/* Labels */}
      <text x={hitX - 30} y="14" style={{ fontSize: 14, fill: 'rgba(255,120,120,0.92)' }} textAnchor="end">①</text>
      <text x={hitX + 30} y="14" style={{ fontSize: 14, fill: 'rgba(100,220,255,0.92)' }}>②</text>

      {/* Right-side legend */}
      <text x="700" y="80" style={{ fontSize: 15, fill: 'var(--theme-text, #222)' }}>入射光</text>
      <line x1="755" y1="76" x2="776" y2="76" stroke="rgba(255,199,62,0.96)" strokeWidth="3" />
      <text x="700" y="104" style={{ fontSize: 14, fill: 'rgba(255,120,120,0.92)' }}>① 上表面反射</text>
      <text x="700" y="126" style={{ fontSize: 14, fill: 'rgba(100,220,255,0.92)' }}>② 下表面反射</text>
      <text x="700" y="158" style={{ fontSize: 14, fill: 'var(--theme-text-muted, #888)' }}>近似垂直入射</text>

      {/* Thickness annotation */}
      <line x1="560" y1={topYAt(560)} x2="560" y2="168" stroke="var(--theme-text-muted, #888)" strokeWidth="2" strokeDasharray="4 3" />
      <text x="572" y="142" style={{ fontSize: 16, fill: 'var(--theme-text, #222)' }}>t(x)</text>

      <text x="330" y="208" style={{ fontSize: 16, fill: 'var(--theme-text, #222)' }}>α = {wedgeAngle.toFixed(1)}′</text>
      <text x="530" y="208" style={{ fontSize: 14, fill: 'var(--theme-text-muted, #888)' }}>
        {profile === 'linear' ? '从左到右膜厚线性增大' : profile === 'convex' ? '上凸：膜厚变化加快' : '下凹：膜厚变化减慢'}
      </text>
    </svg>
  );
}

function NewtonDiagram({
  settings,
  svgRef,
  newtonSampleRatio,
  onNewtonSampleDown,
}: {
  settings: ThinFilmSettings;
  svgRef: React.RefObject<SVGSVGElement | null>;
  newtonSampleRatio: number;
  onNewtonSampleDown: (clientX?: number) => void;
}) {
  const { lensR } = settings;
  const normalizedR = clamp(lensR / 10, 0, 1);
  const sag = 38 + normalizedR * 44;
  const sampleX = NEWTON_SAMPLE_X_MIN + newtonSampleRatio * NEWTON_SAMPLE_X_RANGE;
  const sampleYTop = newtonDiagramLensY(sampleX, sag * 1.1);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 900 260"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {/* Structure */}
      <path d={`M 140 180 Q 280 ${180 - sag * 1.1} 420 180`} stroke="var(--theme-text, #222)" strokeWidth="5" fill="none" />
      <line x1="118" y1="180" x2="442" y2="180" stroke="var(--theme-text, #222)" strokeWidth="5" />
      <path d={`M 140 180 Q 280 ${180 - sag * 1.1} 420 180 L 420 180 L 140 180 Z`} fill="rgba(131,198,255,0.16)" />
      <text x="200" y="202" style={{ fontSize: 14, fill: 'var(--theme-text-muted, #888)' }}>平板玻璃</text>
      <text x="230" y={130 - sag * 0.5} style={{ fontSize: 14, fill: 'var(--theme-text-muted, #888)' }}>平凸透镜</text>
      <text x="240" y="164" style={{ fontSize: 14, fill: 'var(--theme-text-muted, #888)' }}>空气膜</text>

      <circle cx="140" cy="180" r="4" fill="rgba(255,255,255,0.92)" />
      <text x="100" y="216" style={{ fontSize: 13, fill: 'var(--theme-text-muted, #888)' }}>接触点</text>

      {/* Incident ray */}
      <line x1={sampleX} y1="42" x2={sampleX} y2={sampleYTop} stroke="rgba(255,199,62,0.96)" strokeWidth="4" />
      <polygon points={`${sampleX},${sampleYTop - 2} ${sampleX - 5},${sampleYTop - 16} ${sampleX + 5},${sampleYTop - 16}`} fill="rgba(255,199,62,0.96)" />

      {/* Through air gap */}
      <line x1={sampleX} y1={sampleYTop} x2={sampleX} y2="180" stroke="rgba(255,199,62,0.44)" strokeWidth="2.5" />

      {/* Upper surface reflection */}
      <line x1={sampleX} y1={sampleYTop} x2={sampleX - 20} y2="42" stroke="rgba(255,120,120,0.88)" strokeWidth="3.6" />
      <polygon points={`${sampleX - 20},46 ${sampleX - 25},60 ${sampleX - 15},60`} fill="rgba(255,120,120,0.88)" />

      {/* Lower surface reflection */}
      <line x1={sampleX} y1="180" x2={sampleX + 20} y2="42" stroke="rgba(100,220,255,0.88)" strokeWidth="3.6" />
      <polygon points={`${sampleX + 20},46 ${sampleX + 15},60 ${sampleX + 25},60`} fill="rgba(100,220,255,0.88)" />

      {/* Thickness annotation */}
      <line x1={sampleX + 36} y1="180" x2={sampleX + 36} y2={sampleYTop} stroke="var(--theme-text-muted, #888)" strokeWidth="2" strokeDasharray="4 3" />
      <text x={sampleX + 44} y={sampleYTop + 16} style={{ fontSize: 15, fill: 'var(--theme-text, #222)' }}>t(r)</text>

      {/* Sample radius line + green draggable point */}
      <line x1="140" y1="180" x2={sampleX} y2="180" stroke="var(--theme-text-muted, #888)" strokeWidth="2.2" strokeDasharray="4 3" />
      <circle
        cx={sampleX}
        cy={184}
        r={9}
        fill="rgba(132,255,41,0.96)"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.5"
        style={{ cursor: 'grab' }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onNewtonSampleDown(event.clientX);
        }}
      />

      {/* Right-side description */}
      <text x="530" y="44" style={{ fontSize: 16, fill: 'var(--theme-text, #222)' }}>垂直入射 · 两束反射光干涉</text>
      <line x1="530" y1="60" x2="550" y2="60" stroke="rgba(255,120,120,0.88)" strokeWidth="3" />
      <text x="556" y="65" style={{ fontSize: 14, fill: 'rgba(255,120,120,0.92)' }}>① 上表面反射</text>
      <line x1="530" y1="82" x2="550" y2="82" stroke="rgba(100,220,255,0.88)" strokeWidth="3" />
      <text x="556" y="87" style={{ fontSize: 14, fill: 'rgba(100,220,255,0.92)' }}>② 下表面反射</text>

      <text x="530" y="130" style={{ fontSize: 15, fill: 'var(--theme-text, #222)' }}>拖动绿点观察：</text>
      <text x="530" y="152" style={{ fontSize: 14, fill: 'var(--theme-text-muted, #888)' }}>r 增大 → t(r) 增大 → 亮暗交替</text>
      <text x="530" y="174" style={{ fontSize: 14, fill: 'var(--theme-text-muted, #888)' }}>中心 t = 0，牛顿环中心为暗</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThinFilmCanvas({
  settings,
  onUpdateSettings,
}: {
  settings: ThinFilmSettings;
  onUpdateSettings: (updater: (prev: ThinFilmSettings) => ThinFilmSettings) => void;
}) {
  const { filmType, wavelength, thickness, filmN, lensR, wedgeAngle, wedgeProfile, showIntensity, newtonSampleRatio } = settings;

  const color = wavelengthToColor(wavelength);
  const isNewton = filmType === 'newton';

  // Refs
  const diagramRef = useRef<SVGSVGElement | null>(null);
  const patternRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef = useRef<HTMLCanvasElement | null>(null);

  // Newton's rings drag state
  const [dragNewtonSample, setDragNewtonSample] = useState(false);

  // ---- Newton sample point drag handling ----

  useEffect(() => {
    if (!dragNewtonSample || !diagramRef.current || !isNewton) return;
    let rafId = 0;
    let pendingCX = 0;
    let hasPending = false;

    const flush = () => {
      rafId = 0;
      if (!hasPending || !diagramRef.current) return;
      hasPending = false;
      const rect = diagramRef.current.getBoundingClientRect();
      const localX = ((pendingCX - rect.left) / rect.width) * 900;
      const ratio = clamp((localX - NEWTON_SAMPLE_X_MIN) / NEWTON_SAMPLE_X_RANGE, 0, 0.92);
      onUpdateSettings((prev) => ({ ...prev, newtonSampleRatio: ratio }));
    };

    const onMove = (event: PointerEvent): void => {
      pendingCX = event.clientX;
      hasPending = true;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };
    const onUp = (): void => {
      if (rafId) { cancelAnimationFrame(rafId); flush(); }
      setDragNewtonSample(false);
    };

    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
    };
  }, [dragNewtonSample, isNewton, onUpdateSettings]);

  const handleNewtonSampleDown = useCallback(
    (clientX?: number) => {
      if (typeof clientX === 'number' && diagramRef.current) {
        const rect = diagramRef.current.getBoundingClientRect();
        const localX = ((clientX - rect.left) / rect.width) * 900;
        const ratio = clamp((localX - 420) / 240, 0, 0.92);
        onUpdateSettings((prev) => ({ ...prev, newtonSampleRatio: ratio }));
      }
      setDragNewtonSample(true);
    },
    [onUpdateSettings],
  );

  // ---- Canvas draw effect ----

  useEffect(() => {
    const redraw = () => {
      if (patternRef.current) drawThinFilmPattern(patternRef.current, settings);
      if (plotRef.current) drawThinFilmPlot(plotRef.current, settings);
    };
    const frame = requestAnimationFrame(redraw);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
    const patternParent = patternRef.current?.parentElement;
    const plotParent = plotRef.current?.parentElement;
    if (patternParent) observer?.observe(patternParent);
    if (plotParent) observer?.observe(plotParent);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [filmType, wavelength, thickness, filmN, lensR, wedgeAngle, wedgeProfile, showIntensity, newtonSampleRatio]);

  // ---- Diagram card titles ----

  const diagramTitle = filmType === 'soap'
    ? '成因示意 · 膜厚沿高度变化'
    : filmType === 'wedge'
      ? '成因示意 · 等厚干涉'
      : '成因示意 · 空气膜厚随半径变化';

  const diagramChip = isNewton
    ? '拖动采样点观察 r -> t(r) -> 亮暗'
    : '为什么会形成这种图样';

  const patternTitle = filmType === 'soap'
    ? '肥皂泡彩色条纹'
    : filmType === 'wedge'
      ? '楔形薄膜条纹'
      : '牛顿环图样';

  const plotTitle = filmType === 'soap'
    ? '厚度与颜色响应'
    : filmType === 'wedge'
      ? '位置与条纹关系'
      : '半径与环纹关系';

  const plotChip = filmType === 'soap'
    ? '多波长响应'
    : filmType === 'wedge'
      ? 'Δx 已标识'
      : 'r₁ / r₅ 已标识';

  // ---- Render ----

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: showIntensity ? '320px 1.2fr 0.5fr' : '340px 1fr', gap: 0, overflow: 'hidden' }}>
        {/* Card 1 -- SVG cause diagram */}
        <div
          style={{
            background: 'var(--theme-bg-muted, #f5f5f7)',
            borderBottom: '1px solid var(--theme-border, #e0e0e0)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            className="card-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--theme-text-muted)',
            }}
          >
            <span>{diagramTitle}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--theme-primary, #00C06B)',
                }}
              />
              {diagramChip}
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {filmType === 'soap' && <SoapDiagram settings={settings} />}
            {filmType === 'wedge' && <WedgeDiagram settings={settings} />}
            {filmType === 'newton' && (
              <NewtonDiagram
                settings={settings}
                svgRef={diagramRef}
                newtonSampleRatio={newtonSampleRatio}
                onNewtonSampleDown={handleNewtonSampleDown}
              />
            )}
          </div>
        </div>

        {/* Card 2 -- Canvas interference pattern */}
        <div
          style={{
            background: '#000',
            borderBottom: showIntensity ? '1px solid var(--theme-border, #e0e0e0)' : undefined,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            className="card-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--theme-text-muted)',
              background: 'rgba(0,0,0,0.6)',
            }}
          >
            <span>{patternTitle}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: filmType === 'soap'
                    ? 'linear-gradient(90deg, #ff5a36, #45d483, #4a8dff)'
                    : color,
                }}
              />
              {filmType === 'soap' ? '白光' : `λ = ${wavelength} nm`}
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <canvas ref={patternRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* Card 3 -- Canvas intensity/relation plot (conditional) */}
        {showIntensity && (
          <div
            style={{
              background: 'var(--theme-bg-muted, #f5f5f7)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            <div
              className="card-head"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--theme-text-muted)',
              }}
            >
              <span>{plotTitle}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--theme-primary, #00C06B)',
                  }}
                />
                {plotChip}
              </span>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <canvas ref={plotRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            </div>
          </div>
        )}
    </div>
  );
}
