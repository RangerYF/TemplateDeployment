// Module 3: Double-slit interference
const React = (window as any).React;

interface DoubleSlitSettings {
  experimentId: 'opt-021';
  slitSpacing: number;     // μm
  slitWidth: number;       // μm
  screenDistance: number;  // m
  wavelength: number;      // nm
  whiteLight: boolean;
  showColor: boolean;
  showIntensity: boolean;
  showFormula: boolean;
}

function DoubleSlitModule({ settings }: { settings: DoubleSlitSettings }) {
  const { slitSpacing, screenDistance, wavelength, slitWidth, whiteLight, showColor, showIntensity } = settings;
  const d = slitSpacing * 1e-6;
  const L = screenDistance;
  const lam = wavelength * 1e-9;
  const a = slitWidth * 1e-6;
  const fringeSpacing = lam * L / d;
  const color = (window as any).wavelengthToColor(wavelength) as string;
  const whiteLightSamples = [420, 470, 530, 580, 650];

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const plotRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    drawPattern();
    drawPlot();
  }, [slitSpacing, screenDistance, wavelength, slitWidth, whiteLight, showColor, showIntensity]);

  function drawPattern(): void {
    const cv = canvasRef.current as HTMLCanvasElement | null;
    if (!cv) return;
    const parent = cv.parentElement as HTMLElement;
    const W = parent.clientWidth, H = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const screenW = 0.04;
      const img = ctx.createImageData(W, H);
      const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
      const cr = +m[1], cg = +m[2], cb = +m[3];

      for (let px = 0; px < W; px++) {
        const y = (px - W/2) / W * screenW;
        const getIntensity = (wlNm: number): number => {
          const localLam = wlNm * 1e-9;
          const sinTheta = y / L;
          const betaHalf = Math.PI * a * sinTheta / localLam;
          const deltaHalf = Math.PI * d * sinTheta / localLam;
          const envelope = Math.abs(betaHalf) < 1e-6 ? 1 : Math.pow(Math.sin(betaHalf) / betaHalf, 2);
          return envelope * Math.pow(Math.cos(deltaHalf), 2);
        };
        let rr = 0, gg = 0, bb = 0;
        let monoI = getIntensity(wavelength);
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
            img.data[idx+1] = showColor ? gg : gray;
            img.data[idx+2] = showColor ? bb : gray;
          } else {
            const gray = 255 * v;
            img.data[idx] = showColor ? cr * v : gray;
            img.data[idx+1] = showColor ? cg * v : gray;
            img.data[idx+2] = showColor ? cb * v : gray;
          }
          img.data[idx+3] = 255;
        }
      }
    ctx.putImageData(img, 0, 0);
  }

  function drawPlot(): void {
    const cv = plotRef.current as HTMLCanvasElement | null;
    if (!cv) return;
    const parent = cv.parentElement as HTMLElement;
    const W = parent.clientWidth, H = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const m = H * 0.15;
    const plotW = W - m*2, plotH = H - m*2;
    const ink3 = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim();
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border-strong').trim();

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m, m); ctx.lineTo(m, H - m); ctx.lineTo(W - m, H - m);
    ctx.stroke();

    ctx.setLineDash([2,3]);
    ctx.beginPath();
    ctx.moveTo(W/2, m); ctx.lineTo(W/2, H - m);
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
        const I = envelope * Math.pow(Math.cos(deltaHalf), 2);
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('I(y)', m + 4, m + 12);
    ctx.fillText('y →', W - m - 26, H - m - 6);
    ctx.fillText(`Δy = ${(fringeSpacing*1000).toFixed(2)} mm`, W/2 + 8, m + 14);
    if (whiteLight) ctx.fillText('450 / 550 / 650 nm', W - m - 92, m + 12);
  }

  return (
    <div className="pattern-wrap" style={{ gridTemplateRows: showIntensity ? '1fr 1fr' : '1fr' }}>
      <div className="pattern-card">
        <div className="card-head">
          <span>屏上条纹 · Screen pattern</span>
          <span className="chip">
            <span className="dot" style={{ background: whiteLight ? 'linear-gradient(90deg, #4050ff, #4dff77, #ff6a3d)' : color }} />
            {whiteLight ? '白光干涉' : `λ = ${wavelength} nm`}
          </span>
        </div>
        <div className="card-body">
          <canvas ref={canvasRef} />
        </div>
      </div>
      {showIntensity && (
        <div className="pattern-card light">
          <div className="card-head">
            <span>强度分布 · Intensity I(y)</span>
            <span className="chip"><span className="dot" />Δy = {(fringeSpacing*1000).toFixed(3)} mm</span>
          </div>
          <div className="card-body">
            <canvas ref={plotRef} />
          </div>
        </div>
      )}
    </div>
  );
}

function DoubleSlitControls({ settings, setSettings }: { settings: DoubleSlitSettings; setSettings: (s: DoubleSlitSettings) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const getParamSpec = (key: string): ExperimentParamSpec | undefined => (window as any).getP03ParamSpec('doubleslit', settings.experimentId, key);
  return (
    <>
      <SectionTitle aside="PARAMS">参数调节</SectionTitle>
      <Slider label="缝间距 d" value={settings.slitSpacing}
        onChange={(v: number) => setSettings({ ...settings, slitSpacing: v })}
        min={getParamSpec('slitSpacing')?.min ?? 50} max={getParamSpec('slitSpacing')?.max ?? 1000} step={getParamSpec('slitSpacing')?.step ?? 10} unit="μm" />
      <Slider label="缝宽 a" value={settings.slitWidth}
        onChange={(v: number) => setSettings({ ...settings, slitWidth: v })}
        min={5} max={80} step={1} unit="μm"
        hint="包络（单缝衍射）" />
      <Slider label="屏距 L" value={settings.screenDistance}
        onChange={(v: number) => setSettings({ ...settings, screenDistance: v })}
        min={getParamSpec('screenDistance')?.min ?? 0.1} max={getParamSpec('screenDistance')?.max ?? 5.0} step={getParamSpec('screenDistance')?.step ?? 0.1} unit="m" />
      <Slider label="波长 λ" value={settings.wavelength}
        onChange={(v: number) => setSettings({ ...settings, wavelength: v })}
        min={getParamSpec('wavelength')?.min ?? 380} max={getParamSpec('wavelength')?.max ?? 780} step={getParamSpec('wavelength')?.step ?? 10} unit="nm" />

      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>
      <Toggle label="白光干涉" checked={settings.whiteLight}
        onChange={(v: boolean) => setSettings({ ...settings, whiteLight: v })} />
      <Toggle label="颜色显示" checked={settings.showColor}
        onChange={(v: boolean) => setSettings({ ...settings, showColor: v })} />
      <Toggle label="强度曲线" checked={settings.showIntensity}
        onChange={(v: boolean) => setSettings({ ...settings, showIntensity: v })} />
      <Toggle label="公式验证" checked={settings.showFormula}
        onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />
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
        <Readout label="波长 λ" value={settings.whiteLight ? '白光' : settings.wavelength} unit={settings.whiteLight ? '' : 'nm'} />
        <Readout label="条纹间距 Δy" value={(dy*1000).toFixed(3)} unit="mm" hi />
        <Readout label="变化趋势" value="d↑ => 条纹变密；L、λ↑ => 条纹变宽" unit="" />
      </div>
      {settings.showFormula && (
        <>
          <SectionTitle aside="YOUNG">公式推导</SectionTitle>
          <FormulaBlock>
            <span className="step"><span className="lhs">Δy</span><span className="eq">=</span><span className="rhs">λL / d</span></span>
            <span className="step mono"> = ({settings.wavelength} × 10⁻⁹ m × {settings.screenDistance.toFixed(2)} m)</span>
            <span className="step mono">   ÷ ({settings.slitSpacing} × 10⁻⁶ m)</span>
            <span className="step"><span className="lhs">Δy</span><span className="eq">=</span><span className="rhs"><span className="hi">{(dy*1000).toFixed(3)} mm</span></span></span>
          </FormulaBlock>
        </>
      )}
    </>
  );
}

Object.assign(window, { DoubleSlitModule, DoubleSlitControls, DoubleSlitReadouts });

export {};
