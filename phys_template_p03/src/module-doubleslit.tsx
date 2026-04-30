// Module 3: Double-slit interference
const React = (window as any).React;

interface DoubleSlitSettings {
  experimentId: 'opt-021';
  slitSpacing: number;
  slitWidth: number;
  screenDistance: number;
  wavelength: number;
  sourceX: number;
  slitX: number;
  screenX: number;
  whiteLight: boolean;
  showColor: boolean;
  showIntensity: boolean;
  showFormula: boolean;
}

type DragTarget = 'slit' | 'screen' | 'source' | null;

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

function DoubleSlitModule({ settings }: { settings: DoubleSlitSettings }) {
  const SceneLinearSetup = (window as any).SceneLinearSetup;
  const { slitSpacing, screenDistance, wavelength, slitWidth, whiteLight, showColor, showIntensity } = settings;
  const d = slitSpacing * 1e-6;
  const L = screenDistance;
  const lam = wavelength * 1e-9;
  const a = slitWidth * 1e-6;
  const fringeSpacing = lam * L / d;
  const color = (window as any).wavelengthToColor(wavelength) as string;
  const whiteLightSamples = [420, 470, 530, 580, 650];

  const setupRef = React.useRef<SVGSVGElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const plotRef = React.useRef<HTMLCanvasElement | null>(null);
  const [dragTarget, setDragTarget] = React.useState<DragTarget>(null);
  const dragRef = React.useRef<{ kind: DragTarget; prev: DoubleSlitSettings } | null>(null);

  const sourceX = clamp(settings.sourceX, 50, 180);
  const slitX = clamp(settings.slitX, 220, 420);
  const screenX = clamp(settings.screenX, slitX + 60, 760);
  const sourceDistanceM = Math.max(0.2, (slitX - sourceX) / 110);
  const sourceIntensityScale = clamp(Math.pow(1.55 / sourceDistanceM, 2), 0.28, 1.65);

  const screenFringeRects = React.useMemo(() => {
    const N = 55;
    const svgTop = 20, svgBot = 130;
    const svgH = svgBot - svgTop;
    const screenSpan = 0.04;
    const rects: Array<{ y: number; h: number; fillR: number; fillG: number; fillB: number }> = [];
    const wlc = (window as any).wavelengthToColor as (n: number) => string;

    for (let i = 0; i < N; i++) {
      const svgY = svgTop + (i / N) * svgH;
      const h = svgH / N + 0.5;
      const physY = ((i / N) - 0.5) * screenSpan;
      const sinTheta = physY / L;

      if (whiteLight) {
        const wls = [420, 470, 530, 580, 650];
        let rr = 0, gg = 0, bb = 0;
        for (const wl of wls) {
          const ll = wl * 1e-9;
          const bH = Math.PI * a * sinTheta / ll;
          const dH = Math.PI * d * sinTheta / ll;
          const env = Math.abs(bH) < 1e-6 ? 1 : Math.pow(Math.sin(bH) / bH, 2);
          const Iv = Math.pow(Math.max(0, Math.min(1, sourceIntensityScale * env * Math.pow(Math.cos(dH), 2))), 0.72);
          const cm = wlc(wl).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (cm) { rr += +cm[1] * Iv; gg += +cm[2] * Iv; bb += +cm[3] * Iv; }
        }
        rects.push({ y: svgY, h, fillR: Math.min(255, rr / wls.length * 1.8), fillG: Math.min(255, gg / wls.length * 1.8), fillB: Math.min(255, bb / wls.length * 1.8) });
      } else {
        const bH = Math.PI * a * sinTheta / lam;
        const dH = Math.PI * d * sinTheta / lam;
        const env = Math.abs(bH) < 1e-6 ? 1 : Math.pow(Math.sin(bH) / bH, 2);
        const Iv = Math.pow(Math.max(0, Math.min(1, sourceIntensityScale * env * Math.pow(Math.cos(dH), 2))), 0.7);
        const cm = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (cm) {
          rects.push({ y: svgY, h, fillR: +cm[1] * Iv, fillG: +cm[2] * Iv, fillB: +cm[3] * Iv });
        }
      }
    }
    return rects;
  }, [slitSpacing, screenDistance, wavelength, slitWidth, whiteLight, sourceIntensityScale, color, d, L, lam, a]);

  React.useEffect(() => {
    const redraw = (): void => {
      drawPattern();
      drawPlot();
    };
    redraw();
    const frame = window.requestAnimationFrame(redraw);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(redraw);
    const patternParent = canvasRef.current?.parentElement;
    const plotParent = plotRef.current?.parentElement;
    if (patternParent) observer?.observe(patternParent);
    if (plotParent) observer?.observe(plotParent);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [slitSpacing, screenDistance, wavelength, slitWidth, whiteLight, showColor, showIntensity, sourceX, slitX, screenX]);

  React.useEffect(() => {
    if (!dragTarget || !dragRef.current) return;
    const apply = (window as any).__doubleSlitSetSettings as ((updater: (prev: DoubleSlitSettings) => DoubleSlitSettings) => void) | undefined;
    if (!apply) return;

    const onMove = (event: PointerEvent): void => {
      if (!setupRef.current) return;
      const rect = setupRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 800;
      const info = dragRef.current;
      if (!info) return;

      if (info.kind === 'source') {
        apply((prev: DoubleSlitSettings) => ({ ...prev, sourceX: clamp(x, 50, prev.slitX - 80) }));
        return;
      }
      if (info.kind === 'slit') {
        apply((prev: DoubleSlitSettings) => {
          const nextSlitX = clamp(x, prev.sourceX + 80, prev.screenX - 80);
          const nextDistance = clamp((prev.screenX - nextSlitX) / 110, 0.1, 5.0);
          return { ...prev, slitX: nextSlitX, screenDistance: Number(nextDistance.toFixed(2)) };
        });
        return;
      }
      apply((prev: DoubleSlitSettings) => {
        const nextScreenX = clamp(x, prev.slitX + 60, 760);
        const nextDistance = clamp((nextScreenX - prev.slitX) / 110, 0.1, 5.0);
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

  function drawPattern(): boolean {
    const cv = canvasRef.current as HTMLCanvasElement | null;
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

    const screenW = 0.04;
    const img = ctx.createImageData(W, H);
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
    const cr = +m[1], cg = +m[2], cb = +m[3];

    for (let px = 0; px < W; px++) {
      const y = (px - W / 2) / W * screenW;
      const getIntensity = (wlNm: number): number => {
        const localLam = wlNm * 1e-9;
        const sinTheta = y / L;
        const betaHalf = Math.PI * a * sinTheta / localLam;
        const deltaHalf = Math.PI * d * sinTheta / localLam;
        const envelope = Math.abs(betaHalf) < 1e-6 ? 1 : Math.pow(Math.sin(betaHalf) / betaHalf, 2);
        return sourceIntensityScale * envelope * Math.pow(Math.cos(deltaHalf), 2);
      };

      let rr = 0, gg = 0, bb = 0;
      const monoI = getIntensity(wavelength);
      if (whiteLight) {
        for (const wl of whiteLightSamples) {
          const localColor = (window as any).wavelengthToColor(wl).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
          const I = Math.pow(Math.max(0, Math.min(1, getIntensity(wl))), 0.72);
          rr += (+localColor[1]) * I;
          gg += (+localColor[2]) * I;
          bb += (+localColor[3]) * I;
        }
        rr = Math.min(255, rr / whiteLightSamples.length * 1.8);
        gg = Math.min(255, gg / whiteLightSamples.length * 1.8);
        bb = Math.min(255, bb / whiteLightSamples.length * 1.8);
      }

      const v = Math.pow(Math.max(0, Math.min(1, monoI)), 0.7);
      for (let py = 0; py < H; py++) {
        const idx = (py * W + px) * 4;
        if (whiteLight) {
          const gray = (rr + gg + bb) / 3;
          img.data[idx] = showColor ? rr : gray;
          img.data[idx + 1] = showColor ? gg : gray;
          img.data[idx + 2] = showColor ? bb : gray;
        } else {
          const gray = 255 * v;
          img.data[idx] = showColor ? cr * v : gray;
          img.data[idx + 1] = showColor ? cg * v : gray;
          img.data[idx + 2] = showColor ? cb * v : gray;
        }
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
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
    const ink3 = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim();
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border-strong').trim();

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
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

    const screenW = 0.04;
    const wls = whiteLight ? [450, 550, 650] : [wavelength];
    for (const wl of wls) {
      ctx.strokeStyle = whiteLight ? (window as any).wavelengthToColor(wl) : color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const x = m + px;
        const y_m = (px / plotW - 0.5) * screenW;
        const localLam = wl * 1e-9;
        const sinTheta = y_m / L;
        const betaHalf = Math.PI * a * sinTheta / localLam;
        const deltaHalf = Math.PI * d * sinTheta / localLam;
        const envelope = Math.abs(betaHalf) < 1e-6 ? 1 : Math.pow(Math.sin(betaHalf) / betaHalf, 2);
        const I = sourceIntensityScale * envelope * Math.pow(Math.cos(deltaHalf), 2);
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('I(y)', m + 4, m + 12);
    ctx.fillText('y →', W - m - 26, H - m - 6);
    ctx.fillText(`Δy = ${(fringeSpacing * 1000).toFixed(2)} mm`, W / 2 + 8, m + 14);
    if (whiteLight) ctx.fillText('450 / 550 / 650 nm', W - m - 92, m + 12);
    return true;
  }

  return (
    <div className="pattern-wrap" style={{ gridTemplateRows: showIntensity ? '320px 1fr 1fr' : '320px 1fr' }}>
      <div className="pattern-card light">
        <div className="card-head">
          <span>实验布局 · Draggable Setup</span>
          <span className="chip"><span className="dot" />拖动双缝或屏幕位置</span>
        </div>
        <div className="card-body">
          <SceneLinearSetup
            svgRef={setupRef}
            sourceX={sourceX}
            elementX={slitX}
            screenX={screenX}
            elementLabel="双缝"
            distanceLabel={`L = ${screenDistance.toFixed(2)} m`}
            onSourceDown={beginDrag('source')}
            onElementDown={beginDrag('slit')}
            onScreenDown={beginDrag('screen')}
            renderElement={() => (
              <>
                <rect x={slitX - 4} y={44} width={8} height={62} rx={2} fill="var(--ink)" />
                <line x1={slitX} y1={58} x2={slitX} y2={68} stroke="var(--panel)" strokeWidth="2.8" />
                <line x1={slitX} y1={82} x2={slitX} y2={92} stroke="var(--panel)" strokeWidth="2.8" />
              </>
            )}
            renderScreenOverlay={() => (
              <g>
                {screenFringeRects.map((r, i) => (
                  <rect key={i} x={screenX - 2} y={r.y} width={22} height={r.h}
                    fill={`rgb(${Math.round(r.fillR)},${Math.round(r.fillG)},${Math.round(r.fillB)})`} opacity={0.92} rx={1} />
                ))}
              </g>
            )}
          />
        </div>
      </div>

      <div className="pattern-card">
        <div className="card-head">
          <span>屏上条纹 · Screen Pattern</span>
          <span className="chip">
            <span className="dot" style={{ background: whiteLight ? 'linear-gradient(90deg, #4050ff, #4dff77, #ff6a3d)' : color }} />
            {whiteLight ? '白光干涉' : `λ = ${wavelength} nm`}
          </span>
        </div>
        <div className="card-body"><canvas ref={canvasRef} /></div>
      </div>

      {showIntensity && (
        <div className="pattern-card light">
          <div className="card-head">
            <span>强度分布 · Intensity I(y)</span>
            <span className="chip"><span className="dot" />Δy = {(fringeSpacing * 1000).toFixed(3)} mm</span>
          </div>
          <div className="card-body"><canvas ref={plotRef} /></div>
        </div>
      )}
    </div>
  );
}

function DoubleSlitControls({ settings, setSettings }: { settings: DoubleSlitSettings; setSettings: (s: DoubleSlitSettings | ((prev: DoubleSlitSettings) => DoubleSlitSettings)) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const getParamSpec = (key: string): ExperimentParamSpec | undefined => (window as any).getP03ParamSpec('doubleslit', settings.experimentId, key);

  (window as any).__doubleSlitSetSettings = (updater: (prev: DoubleSlitSettings) => DoubleSlitSettings): void => {
    setSettings(updater);
  };

  return (
    <>
      <SectionTitle aside="PARAMS">参数调节</SectionTitle>
      <Slider label="缝间距 d" value={settings.slitSpacing} onChange={(v: number) => setSettings({ ...settings, slitSpacing: v })} min={getParamSpec('slitSpacing')?.min ?? 50} max={getParamSpec('slitSpacing')?.max ?? 1000} step={getParamSpec('slitSpacing')?.step ?? 10} unit="μm" />
      <Slider label="缝宽 a" value={settings.slitWidth} onChange={(v: number) => setSettings({ ...settings, slitWidth: v })} min={5} max={80} step={1} unit="μm" hint="包络（单缝衍射）" />
      <Slider label="屏距 L" value={settings.screenDistance} onChange={(v: number) => setSettings({ ...settings, screenDistance: v, screenX: settings.slitX + v * 110 })} min={getParamSpec('screenDistance')?.min ?? 0.1} max={getParamSpec('screenDistance')?.max ?? 5.0} step={getParamSpec('screenDistance')?.step ?? 0.1} unit="m" />
      <Slider label="波长 λ" value={settings.wavelength} onChange={(v: number) => setSettings({ ...settings, wavelength: v })} min={getParamSpec('wavelength')?.min ?? 380} max={getParamSpec('wavelength')?.max ?? 780} step={getParamSpec('wavelength')?.step ?? 10} unit="nm" />

      <SectionTitle aside="LAYOUT">布局</SectionTitle>
      <Slider label="光源位置 x" value={settings.sourceX} onChange={(v: number) => setSettings({ ...settings, sourceX: v })} min={50} max={180} step={1} unit="" />
      <Slider label="双缝位置 x" value={settings.slitX} onChange={(v: number) => setSettings({ ...settings, slitX: v, screenDistance: Number(((settings.screenX - v) / 110).toFixed(2)) })} min={220} max={420} step={1} unit="" />
      <Slider label="屏幕位置 x" value={settings.screenX} onChange={(v: number) => setSettings({ ...settings, screenX: v, screenDistance: Number(((v - settings.slitX) / 110).toFixed(2)) })} min={settings.slitX + 60} max={760} step={1} unit="" />

      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>
      <Toggle label="白光干涉" checked={settings.whiteLight} onChange={(v: boolean) => setSettings({ ...settings, whiteLight: v })} />
      <Toggle label="颜色显示" checked={settings.showColor} onChange={(v: boolean) => setSettings({ ...settings, showColor: v })} />
      <Toggle label="强度曲线" checked={settings.showIntensity} onChange={(v: boolean) => setSettings({ ...settings, showIntensity: v })} />
      <Toggle label="公式验证" checked={settings.showFormula} onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />
    </>
  );
}

function DoubleSlitReadouts({ settings }: { settings: DoubleSlitSettings }) {
  const d = settings.slitSpacing * 1e-6;
  const L = settings.screenDistance;
  const lam = settings.wavelength * 1e-9;
  const dy = lam * L / d;
  const SectionTitle = (window as any).SectionTitle;
  const Readout = (window as any).Readout;
  const FormulaBlock = (window as any).FormulaBlock;

  return (
    <>
      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="readouts">
        <Readout label="缝间距 d" value={settings.slitSpacing} unit="μm" />
        <Readout label="屏距 L" value={settings.screenDistance.toFixed(2)} unit="m" />
        <Readout label="布局间距" value={(settings.screenX - settings.slitX).toFixed(0)} unit="px" />
        <Readout label="波长 λ" value={settings.whiteLight ? '白光' : settings.wavelength} unit={settings.whiteLight ? '' : 'nm'} />
        <Readout label="条纹间距 Δy" value={(dy * 1000).toFixed(3)} unit="mm" hi />
        <Readout label="变化趋势" value="d↑ => 条纹变密；L、λ↑ => 条纹变宽" unit="" />
      </div>
      {settings.showFormula && (
        <>
          <SectionTitle aside="YOUNG">公式推导</SectionTitle>
          <FormulaBlock>
            <span className="step"><span className="lhs">Δy</span><span className="eq">=</span><span className="rhs">λL / d</span></span>
            <span className="step mono">= ({settings.wavelength} × 10⁻⁹ m × {settings.screenDistance.toFixed(2)} m) ÷ ({settings.slitSpacing} × 10⁻⁶ m)</span>
            <span className="step"><span className="lhs">Δy</span><span className="eq">=</span><span className="rhs"><span className="hi">{(dy * 1000).toFixed(3)} mm</span></span></span>
          </FormulaBlock>
        </>
      )}
    </>
  );
}

Object.assign(window, { DoubleSlitModule, DoubleSlitControls, DoubleSlitReadouts });

export {};
