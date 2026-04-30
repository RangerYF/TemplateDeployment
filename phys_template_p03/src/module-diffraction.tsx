// Module 4: Single-slit / circular aperture diffraction
const React = (window as any).React;

type ApertureKind = 'slit' | 'circle';
interface DiffractionSettings {
  experimentId: 'opt-031' | 'opt-032';
  aperture: ApertureKind;
  slitWidth: number;
  diameter: number;
  wavelength: number;
  screenDistance: number;
  sourceX: number;
  apertureX: number;
  screenX: number;
  showColor: boolean;
  showIntensity: boolean;
  showFormula: boolean;
  compareMode?: boolean;
}

type DragTarget = 'source' | 'aperture' | 'screen' | null;
const COMPARE_WLS = [450, 532, 650];
const DIFFRACTION_VIEW_SPAN = {
  slit: 0.066,
  circle: 0.040,
} as const;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function getCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } | null {
  const parent = canvas.parentElement;
  if (!parent) return null;
  const width = Math.floor(parent.clientWidth);
  const height = Math.floor(parent.clientHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function fmt(v: number, digits = 3): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

function perceptualToneMap(I: number, ap: 'slit' | 'circle'): number {
  const c = clamp01(I);
  const gamma = ap === 'circle' ? 0.22 : 0.25;
  return Math.pow(c, gamma) * 0.82 + Math.pow(c, 0.65) * 0.18;
}

function besselJ1(x: number): number {
  if (x === 0) return 0;
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const num = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
    const den = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y * 1.0))));
    return num / den;
  }
  const z = 8 / ax;
  const y = z * z;
  const ans1 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
  const ans2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const xx = ax - 2.356194491;
  const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * ans1 - z * Math.sin(xx) * ans2);
  return x < 0 ? -ans : ans;
}

function DiffractionModule({ settings }: { settings: DiffractionSettings }) {
  const SceneLinearSetup = (window as any).SceneLinearSetup;
  const { aperture, slitWidth, diameter, wavelength, screenDistance } = settings;
  const lam = wavelength * 1e-9;
  const a = slitWidth * 1e-6;
  const D = diameter * 1e-6;
  const L = screenDistance;
  const color = (window as any).wavelengthToColor(wavelength) as string;

  const setupRef = React.useRef<SVGSVGElement | null>(null);
  const patternRef = React.useRef<HTMLCanvasElement | null>(null);
  const plotRef = React.useRef<HTMLCanvasElement | null>(null);
  const [dragTarget, setDragTarget] = React.useState<DragTarget>(null);
  const dragRef = React.useRef<{ kind: DragTarget; prev: DiffractionSettings } | null>(null);

  const sourceX = clamp(settings.sourceX, 50, 180);
  const apertureX = clamp(settings.apertureX, 220, 430);
  const screenX = clamp(settings.screenX, apertureX + 70, 760);
  const sourceDistanceM = Math.max(0.2, (apertureX - sourceX) / 110);
  const sourceIntensityScale = clamp(Math.pow(1.55 / sourceDistanceM, 2), 0.28, 1.65);
  const isSlit = aperture === 'slit';
  const screenSpan = DIFFRACTION_VIEW_SPAN[aperture];

  React.useEffect(() => {
    const redraw = (): void => {
      drawPattern();
      drawPlot();
    };
    redraw();
    const frame = window.requestAnimationFrame(redraw);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(redraw);
    const patternParent = patternRef.current?.parentElement;
    const plotParent = plotRef.current?.parentElement;
    if (patternParent) observer?.observe(patternParent);
    if (plotParent) observer?.observe(plotParent);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [aperture, slitWidth, diameter, wavelength, screenDistance, settings.compareMode, settings.showColor, settings.showIntensity, sourceX, apertureX, screenX]);

  React.useEffect(() => {
    if (!dragTarget || !dragRef.current) return;
    const apply = (window as any).__diffractionSetSettings as ((updater: (prev: DiffractionSettings) => DiffractionSettings) => void) | undefined;
    if (!apply) return;

    const onMove = (event: PointerEvent): void => {
      if (!setupRef.current) return;
      const rect = setupRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 800;
      const info = dragRef.current;
      if (!info) return;

      if (info.kind === 'source') {
        apply((prev: DiffractionSettings) => ({ ...prev, sourceX: clamp(x, 50, prev.apertureX - 90) }));
        return;
      }
      if (info.kind === 'aperture') {
        apply((prev: DiffractionSettings) => {
          const nextApertureX = clamp(x, prev.sourceX + 90, prev.screenX - 80);
          const nextDistance = clamp((prev.screenX - nextApertureX) / 110, 0.5, 3.0);
          return { ...prev, apertureX: nextApertureX, screenDistance: Number(nextDistance.toFixed(2)) };
        });
        return;
      }
      apply((prev: DiffractionSettings) => {
        const nextScreenX = clamp(x, prev.apertureX + 70, 760);
        const nextDistance = clamp((nextScreenX - prev.apertureX) / 110, 0.5, 3.0);
        return { ...prev, screenX: nextScreenX, screenDistance: Number(nextDistance.toFixed(2)) };
      });
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
    dragRef.current = { kind, prev: settings };
    setDragTarget(kind);
  };

  const firstMin = aperture === 'slit' ? lam * L / a : 1.22 * lam * L / D;
  const primaryValueMm = (isSlit ? 2 * firstMin : firstMin) * 1000;

  function intensityAt(y: number, wlNm: number = wavelength): number {
    const lamLocal = wlNm * 1e-9;
    const sinTheta = y / L;
    let baseI = 0;
    if (aperture === 'slit') {
      const x = Math.PI * a * sinTheta / lamLocal;
      if (Math.abs(x) < 1e-6) return sourceIntensityScale;
      const s = Math.sin(x) / x;
      baseI = sourceIntensityScale * s * s;
    } else {
      const x = Math.PI * D * sinTheta / lamLocal;
      if (Math.abs(x) < 1e-6) return sourceIntensityScale;
      const v = 2 * besselJ1(x) / x;
      baseI = sourceIntensityScale * v * v;
    }
    return baseI;
  }

  function drawPattern(): boolean {
    const cv = patternRef.current as HTMLCanvasElement | null;
    if (!cv) return false;
    const size = getCanvasSize(cv);
    if (!size) return false;
    const W = size.width, H = size.height;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return false;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const compare = settings.compareMode === true;
    const screenW = screenSpan;

    if (!compare) {
      const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
      const cr = +m[1], cg = +m[2], cb = +m[3];
      const img = ctx.createImageData(W, H);
      for (let px = 0; px < W; px++) {
        const y = (px - W / 2) / W * screenW;
        const iHoriz = intensityAt(y);
        for (let py = 0; py < H; py++) {
          const I = aperture === 'slit' ? iHoriz : intensityAt(Math.hypot(y, (py - H / 2) / W * screenW));
          const v = perceptualToneMap(I, aperture);
          const gray = 255 * v;
          const idx = (py * W + px) * 4;
          img.data[idx] = settings.showColor ? cr * v : gray;
          img.data[idx + 1] = settings.showColor ? cg * v : gray;
          img.data[idx + 2] = settings.showColor ? cb * v : gray;
          img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    if (!compare) {
      const ink = 'rgba(255,255,255,0.74)';
      const soft = 'rgba(210,255,180,0.10)';
      if (aperture === 'slit') {
        const xMin1 = W / 2 + (firstMin / screenW) * W;
        const xMin2 = W / 2 - (firstMin / screenW) * W;
        ctx.fillStyle = soft;
        ctx.fillRect(xMin2, 0, xMin1 - xMin2, H);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xMin1, 0);
        ctx.lineTo(xMin1, H);
        ctx.moveTo(xMin2, 0);
        ctx.lineTo(xMin2, H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.fillText('中央主极大', W / 2 - 38, 18);
      } else {
        const rPx = (firstMin / screenW) * W;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, Math.max(8, rPx), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.fillText('艾里斑', W / 2 - 20, 18);
      }
    }
    return true;
  }

    const wlc = (window as any).wavelengthToColor as (n: number) => string;
    const bandH = Math.floor(H / 3);
    const img = ctx.createImageData(W, H);
    for (let bi = 0; bi < 3; bi++) {
      const wl = COMPARE_WLS[bi];
      const mm = wlc(wl).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
      const cr = +mm[1], cg = +mm[2], cb = +mm[3];
      for (let px = 0; px < W; px++) {
        const y = (px - W / 2) / W * screenW;
        const I = intensityAt(y, wl);
        const v = perceptualToneMap(I, aperture);
        const gray = 255 * v;
        const y0 = bi * bandH;
        const y1 = bi === 2 ? H : (bi + 1) * bandH;
        for (let py = y0; py < y1; py++) {
          const idx = (py * W + px) * 4;
          img.data[idx] = settings.showColor ? cr * v : gray;
          img.data[idx + 1] = settings.showColor ? cg * v : gray;
          img.data[idx + 2] = settings.showColor ? cb * v : gray;
          img.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * bandH);
      ctx.lineTo(W, i * bandH);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px JetBrains Mono, monospace';
    for (let bi = 0; bi < 3; bi++) ctx.fillText(`${COMPARE_WLS[bi]} nm`, 8, bi * bandH + 14);
    return true;
  }

  function drawPlot(): boolean {
    const cv = plotRef.current as HTMLCanvasElement | null;
    if (!cv) return false;
    const size = getCanvasSize(cv);
    if (!size) return false;
    const W = size.width, H = size.height;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return false;
    ctx.scale(dpr, dpr);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const m = H * 0.15;
    const plotW = W - m * 2;
    const plotH = H - m * 2;
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border-strong').trim();
    const ink3 = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim();

    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(m, m);
    ctx.lineTo(m, H - m);
    ctx.lineTo(W - m, H - m);
    ctx.stroke();
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(W / 2, m);
    ctx.lineTo(W / 2, H - m);
    ctx.stroke();
    ctx.setLineDash([]);

    const compare = settings.compareMode === true;
    const screenW = screenSpan;
    const wlc = (window as any).wavelengthToColor as (n: number) => string;
    const wls = compare ? COMPARE_WLS : [wavelength];

    for (const wl of wls) {
      ctx.strokeStyle = wlc(wl);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const x = m + px;
        const y_m = (px / plotW - 0.5) * screenW;
        const I = clamp01(intensityAt(y_m, wl));
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    if (!compare) {
      const xMin1 = W / 2 + (firstMin / screenW) * plotW;
      const xMin2 = W / 2 - (firstMin / screenW) * plotW;
      ctx.fillStyle = 'rgba(140, 255, 84, 0.08)';
      ctx.fillRect(xMin2, m, xMin1 - xMin2, plotH);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = ink3;
      ctx.beginPath();
      ctx.moveTo(xMin1, m);
      ctx.lineTo(xMin1, H - m);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xMin2, m);
      ctx.lineTo(xMin2, H - m);
      ctx.stroke();
      ctx.setLineDash([]);
      if (isSlit) {
        ctx.fillStyle = ink3;
        ctx.fillText(`±${fmt(firstMin * 1000, 2)} mm`, W / 2 + 6, m + 12);
        ctx.fillText(`2y₁ = ${fmt(primaryValueMm, 2)} mm`, W / 2 + 6, m + 26);
      } else {
        ctx.fillStyle = ink3;
        ctx.fillText(`r₁ = ${fmt(firstMin * 1000, 2)} mm`, W / 2 + 6, m + 12);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = wlc(COMPARE_WLS[i]);
        ctx.fillRect(W - m - 90, m + 4 + i * 14, 10, 3);
        ctx.fillStyle = ink3;
        ctx.fillText(`${COMPARE_WLS[i]} nm`, W - m - 75, m + 10 + i * 14);
      }
    }
    ctx.fillStyle = ink3;
    ctx.fillText(isSlit ? 'I(y)' : 'I(r)', m + 4, m + 12);
    return true;
  }

  return (
    <div className="pattern-wrap" style={{ gridTemplateRows: settings.showIntensity ? '320px 1fr 1fr' : '320px 1fr' }}>
      <div className="pattern-card light">
        <div className="card-head">
          <span>实验布局 · Draggable Setup</span>
          <span className="chip"><span className="dot" />拖动光源、孔径和屏幕</span>
        </div>
        <div className="card-body">
          <SceneLinearSetup
            svgRef={setupRef}
            sourceX={sourceX}
            elementX={apertureX}
            screenX={screenX}
            elementLabel={aperture === 'slit' ? '单缝' : '圆孔'}
            distanceLabel={`L = ${screenDistance.toFixed(2)} m`}
            onSourceDown={beginDrag('source')}
            onElementDown={beginDrag('aperture')}
            onScreenDown={beginDrag('screen')}
            renderElement={() => (
              <>
                {aperture === 'slit'
                  ? <rect x={apertureX - 4} y={42} width={8} height={66} rx={2} fill="var(--ink)" />
                  : <><rect x={apertureX - 4} y={42} width={8} height={66} rx={2} fill="var(--ink)" /><circle cx={apertureX} cy={75} r="11" fill="var(--panel)" stroke="var(--ink)" strokeWidth="2.4" /></>}
                {aperture === 'slit' && (
                  <>
                    <line x1={apertureX} y1={58} x2={apertureX} y2={68} stroke="var(--panel)" strokeWidth="2.4" />
                    <line x1={apertureX} y1={82} x2={apertureX} y2={92} stroke="var(--panel)" strokeWidth="2.4" />
                  </>
                )}
              </>
            )}
          />
        </div>
      </div>

      <div className="pattern-card">
        <div className="card-head">
          <span>{aperture === 'slit' ? '单缝衍射图样 · 中央主极大' : '圆孔衍射图样 · 艾里斑'}</span>
          {settings.compareMode
            ? <span className="chip"><span className="dot" style={{ background: 'linear-gradient(90deg, #4080ff, #40ff80, #ff4040)' }} />RGB 对比</span>
            : <span className="chip"><span className="dot" style={{ background: color }} />λ = {wavelength} nm</span>}
        </div>
        <div className="card-body"><canvas ref={patternRef} /></div>
      </div>

      {settings.showIntensity && (
        <div className="pattern-card light">
          <div className="card-head">
            <span>{aperture === 'slit' ? '强度分布 I(y)' : '径向强度分布 I(r)'}</span>
            <span className="chip"><span className="dot" />{aperture === 'slit' ? '中央主极大已标识' : '第一暗环已标识'}</span>
          </div>
          <div className="card-body"><canvas ref={plotRef} /></div>
        </div>
      )}
    </div>
  );
}

function DiffractionControls({ settings, setSettings }: { settings: DiffractionSettings; setSettings: (s: DiffractionSettings | ((prev: DiffractionSettings) => DiffractionSettings)) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const SegSelect = (window as any).SegSelect;
  const getParamSpec = (key: string): ExperimentParamSpec | undefined => (window as any).getP03ParamSpec('diffraction', settings.experimentId, key);
  const isSlit = settings.aperture === 'slit';

  (window as any).__diffractionSetSettings = (updater: (prev: DiffractionSettings) => DiffractionSettings): void => {
    setSettings(updater);
  };

  return (
    <>
      <SectionTitle aside="APERTURE">孔径类型</SectionTitle>
      <SegSelect value={settings.aperture} onChange={(v: ApertureKind) => setSettings({ ...settings, aperture: v, experimentId: v === 'slit' ? 'opt-031' : 'opt-032' })} options={[{ value: 'slit', label: '单缝' }, { value: 'circle', label: '圆孔' }]} />

      <SectionTitle aside="PARAMS">参数调节</SectionTitle>
      {settings.aperture === 'slit'
        ? <Slider label="缝宽 a" value={settings.slitWidth} onChange={(v: number) => setSettings({ ...settings, slitWidth: v })} min={getParamSpec('slitWidth')?.min ?? 10} max={getParamSpec('slitWidth')?.max ?? 500} step={getParamSpec('slitWidth')?.step ?? 5} unit="μm" hint="缝越窄，中央亮纹越宽" />
        : <Slider label="孔径 D" value={settings.diameter} onChange={(v: number) => setSettings({ ...settings, diameter: v })} min={getParamSpec('diameter')?.min ?? 20} max={getParamSpec('diameter')?.max ?? 1000} step={getParamSpec('diameter')?.step ?? 10} unit="μm" />}
      <Slider label="波长 λ" value={settings.wavelength} onChange={(v: number) => setSettings({ ...settings, wavelength: v })} min={getParamSpec('wavelength')?.min ?? 380} max={getParamSpec('wavelength')?.max ?? 780} step={getParamSpec('wavelength')?.step ?? 10} unit="nm" />
      <Slider label="屏距 L" value={settings.screenDistance} onChange={(v: number) => setSettings({ ...settings, screenDistance: v, screenX: settings.apertureX + v * 110 })} min={0.5} max={3.0} step={0.05} unit="m" />

      <SectionTitle aside="SCENE">课堂预设</SectionTitle>
      {isSlit ? (
        <>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, slitWidth: 60 })}>更窄单缝</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, wavelength: 700 })}>更长波长</button>
          </div>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, screenDistance: 2.2, screenX: settings.apertureX + 2.2 * 110 })}>更远屏幕</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, slitWidth: 140, wavelength: 450 })}>更宽缝对比</button>
          </div>
        </>
      ) : (
        <>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, diameter: 90 })}>更小圆孔</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, wavelength: 700 })}>更长波长</button>
          </div>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, screenDistance: 2.2, screenX: settings.apertureX + 2.2 * 110 })}>更远屏幕</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, diameter: 300, wavelength: 450 })}>更大孔对比</button>
          </div>
        </>
      )}

      <SectionTitle aside="LAYOUT">布局</SectionTitle>
      <Slider label="光源位置 x" value={settings.sourceX} onChange={(v: number) => setSettings({ ...settings, sourceX: v })} min={50} max={180} step={1} unit="" />
      <Slider label={`${settings.aperture === 'slit' ? '单缝' : '圆孔'}位置 x`} value={settings.apertureX} onChange={(v: number) => setSettings({ ...settings, apertureX: v, screenDistance: Number(((settings.screenX - v) / 110).toFixed(2)) })} min={220} max={430} step={1} unit="" />
      <Slider label="屏幕位置 x" value={settings.screenX} onChange={(v: number) => setSettings({ ...settings, screenX: v, screenDistance: Number(((v - settings.apertureX) / 110).toFixed(2)) })} min={settings.apertureX + 70} max={760} step={1} unit="" />

      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>
      <Toggle label="颜色显示" checked={settings.showColor} onChange={(v: boolean) => setSettings({ ...settings, showColor: v })} />
      <Toggle label="强度曲线" checked={settings.showIntensity} onChange={(v: boolean) => setSettings({ ...settings, showIntensity: v })} />
      <Toggle label="多波长对比 (RGB)" checked={settings.compareMode === true} onChange={(v: boolean) => setSettings({ ...settings, compareMode: v })} />
      <Toggle label="公式验证" checked={settings.showFormula} onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />
    </>
  );
}

function DiffractionReadouts({ settings }: { settings: DiffractionSettings }) {
  const lam = settings.wavelength * 1e-9;
  const L = settings.screenDistance;
  const a = settings.slitWidth * 1e-6;
  const D = settings.diameter * 1e-6;
  const isSlit = settings.aperture === 'slit';
  const firstMin = isSlit ? lam * L / a : 1.22 * lam * L / D;
  const primaryMm = (isSlit ? 2 * firstMin : firstMin) * 1000;
  const firstMinMm = firstMin * 1000;
  const SectionTitle = (window as any).SectionTitle;
  const Readout = (window as any).Readout;
  const FormulaBlock = (window as any).FormulaBlock;

  return (
    <>
      <SectionTitle aside="CORE">教学结论</SectionTitle>
      <div className="diff-readout-hero-grid">
        <div className="diff-summary-card primary">
          <div className="diff-summary-label">{isSlit ? '中央主极大宽度' : '艾里斑半径'}</div>
          <div className="diff-summary-value mono">{fmt(primaryMm, 3)} <span>mm</span></div>
          <div className="diff-summary-note">{isSlit ? '中央主峰左右第一极小之间的距离' : '中央亮斑到第一暗环的半径'}</div>
        </div>
        <div className="diff-summary-card">
          <div className="diff-summary-label">变化趋势</div>
          <div className="diff-summary-text">{isSlit ? 'a ↓ 或 λ ↑ => 中央主极大变宽' : 'D ↓ 或 λ ↑ => 艾里斑变大'}</div>
          <div className="diff-summary-note">{isSlit ? '中央亮纹最宽最亮，是单缝讲解的主结论。' : '艾里斑的尺寸由孔径和波长共同决定。'}</div>
        </div>
      </div>

      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="readouts">
        {isSlit ? <Readout label="缝宽 a" value={settings.slitWidth} unit="μm" /> : <Readout label="孔径 D" value={settings.diameter} unit="μm" />}
        <Readout label="波长 λ" value={settings.wavelength} unit="nm" />
        <Readout label="屏距 L" value={L.toFixed(2)} unit="m" />
        <Readout label="布局间距" value={(settings.screenX - settings.apertureX).toFixed(0)} unit="px" />
        {isSlit ? <Readout label="第一极小 y₁" value={fmt(firstMinMm, 3)} unit="mm" /> : <Readout label="第一暗环 r₁" value={fmt(firstMinMm, 3)} unit="mm" />}
        <Readout label={isSlit ? '中央主极大宽度' : '艾里斑半径'} value={fmt(primaryMm, 3)} unit="mm" hi />
      </div>
      {settings.showFormula && (
        <>
          <SectionTitle aside={isSlit ? 'FRAUNHOFER' : 'AIRY'}>公式</SectionTitle>
          <FormulaBlock>
            {isSlit ? (
              <>
                <span className="step"><span className="lhs">a sin θ</span><span className="eq">=</span><span className="rhs">λ（第一极小）</span></span>
                <span className="step"><span className="lhs">y₁ ≈ Lλ/a</span></span>
                <span className="step"><span className="lhs">中央主极大宽度</span><span className="eq">≈</span><span className="rhs">2Lλ/a = <span className="hi">{fmt(primaryMm, 3)} mm</span></span></span>
                <span className="step"><span className="lhs">y₁</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(firstMinMm, 3)} mm</span></span></span>
              </>
            ) : (
              <>
                <span className="step"><span className="lhs">sin θ</span><span className="eq">=</span><span className="rhs">1.22 λ/D</span></span>
                <span className="step"><span className="lhs">r₁ ≈ 1.22 Lλ/D</span></span>
                <span className="step"><span className="lhs">艾里斑半径</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(primaryMm, 3)} mm</span></span></span>
              </>
            )}
          </FormulaBlock>
        </>
      )}
    </>
  );
}

Object.assign(window, { DiffractionModule, DiffractionControls, DiffractionReadouts });

export {};
