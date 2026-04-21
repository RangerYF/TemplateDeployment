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
  showColor: boolean;
  showIntensity: boolean;
  showFormula: boolean;
  compareMode?: boolean;
}

const COMPARE_WLS = [450, 532, 650];

function besselJ1(x: number): number {
  if (x === 0) return 0;
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x*x;
    const num = x * (72362614232.0 + y*(-7895059235.0 + y*(242396853.1 +
               y*(-2972611.439 + y*(15704.48260 + y*(-30.16036606))))));
    const den = 144725228442.0 + y*(2300535178.0 + y*(18583304.74 +
               y*(99447.43394 + y*(376.9991397 + y*1.0))));
    return num / den;
  } else {
    const z = 8 / ax;
    const y = z*z;
    const ans1 = 1.0 + y*(0.183105e-2 + y*(-0.3516396496e-4 + y*(0.2457520174e-5 + y*(-0.240337019e-6))));
    const ans2 = 0.04687499995 + y*(-0.2002690873e-3 + y*(0.8449199096e-5 + y*(-0.88228987e-6 + y*0.105787412e-6)));
    const xx = ax - 2.356194491;
    const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx)*ans1 - z*Math.sin(xx)*ans2);
    return x < 0 ? -ans : ans;
  }
}

function DiffractionModule({ settings }: { settings: DiffractionSettings }) {
  const { aperture, slitWidth, diameter, wavelength, screenDistance } = settings;
  const lam = wavelength * 1e-9;
  const a = slitWidth * 1e-6;
  const D = diameter * 1e-6;
  const L = screenDistance;
  const color = (window as any).wavelengthToColor(wavelength) as string;

  const patternRef = React.useRef<HTMLCanvasElement | null>(null);
  const plotRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => { drawPattern(); drawPlot(); }, [aperture, slitWidth, diameter, wavelength, screenDistance, settings.compareMode, settings.showColor, settings.showIntensity]);

  const firstMin = aperture === 'slit'
    ? lam * L / a
    : 1.22 * lam * L / D;

  function intensityAt(y: number, wlNm: number = wavelength): number {
    const lamLocal = wlNm * 1e-9;
    const sinTheta = y / L;
    if (aperture === 'slit') {
      const x = Math.PI * a * sinTheta / lamLocal;
      if (Math.abs(x) < 1e-6) return 1;
      const s = Math.sin(x) / x;
      return s*s;
    } else {
      const x = Math.PI * D * sinTheta / lamLocal;
      if (Math.abs(x) < 1e-6) return 1;
      const v = 2 * besselJ1(x) / x;
      return v*v;
    }
  }

  function drawPattern(): void {
    const cv = patternRef.current as HTMLCanvasElement | null;
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

    const compare = settings.compareMode === true;
    // Use longest wl (red, 650nm) to scale width so all 3 fit
    const screenW = compare ? (650e-9 * L / (aperture === 'slit' ? a : D)) * 8 : firstMin * 8;

    if (!compare) {
      const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
      const cr = +m[1], cg = +m[2], cb = +m[3];
      const img = ctx.createImageData(W, H);
      for (let px = 0; px < W; px++) {
        const y = (px - W/2) / W * screenW;
        const iHoriz = intensityAt(y);
        for (let py = 0; py < H; py++) {
          let I: number;
          if (aperture === 'slit') I = iHoriz;
          else {
            const yv = (py - H/2) / W * screenW;
            I = intensityAt(Math.hypot(y, yv));
          }
          const v = Math.pow(Math.max(0, Math.min(1, I)), 0.55);
          const gray = 255 * v;
          const idx = (py * W + px) * 4;
          img.data[idx] = settings.showColor ? cr * v : gray;
          img.data[idx+1] = settings.showColor ? cg * v : gray;
          img.data[idx+2] = settings.showColor ? cb * v : gray;
          img.data[idx+3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return;
    }

    // compareMode: three stacked horizontal bands, each one wavelength
    const wlc = (window as any).wavelengthToColor as (n: number) => string;
    const bandH = Math.floor(H / 3);
    const img = ctx.createImageData(W, H);
    for (let bi = 0; bi < 3; bi++) {
      const wl = COMPARE_WLS[bi];
      const mm = wlc(wl).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
      const cr = +mm[1], cg = +mm[2], cb = +mm[3];
      for (let px = 0; px < W; px++) {
        const y = (px - W/2) / W * screenW;
        const I = intensityAt(y, wl);
          const v = Math.pow(Math.max(0, Math.min(1, I)), 0.55);
          const gray = 255 * v;
          const y0 = bi * bandH;
          const y1 = (bi === 2) ? H : (bi+1) * bandH;
          for (let py = y0; py < y1; py++) {
            const idx = (py * W + px) * 4;
            img.data[idx] = settings.showColor ? cr * v : gray;
            img.data[idx+1] = settings.showColor ? cg * v : gray;
            img.data[idx+2] = settings.showColor ? cb * v : gray;
            img.data[idx+3] = 255;
          }
        }
    }
    ctx.putImageData(img, 0, 0);

    // divider lines + labels
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * bandH); ctx.lineTo(W, i * bandH); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px JetBrains Mono, monospace';
    for (let bi = 0; bi < 3; bi++) {
      ctx.fillText(`${COMPARE_WLS[bi]} nm`, 8, bi * bandH + 14);
    }
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
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    const m = H * 0.15;
    const plotW = W - m*2, plotH = H - m*2;
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border-strong').trim();
    const ink3 = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim();

    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(m, m); ctx.lineTo(m, H - m); ctx.lineTo(W - m, H - m);
    ctx.stroke();
    ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(W/2, m); ctx.lineTo(W/2, H-m); ctx.stroke();
    ctx.setLineDash([]);

    const compare = settings.compareMode === true;
    // Scale plot to longest wavelength's first minimum when comparing
    const refFirstMin = compare
      ? (650e-9 * L / (aperture === 'slit' ? a : D) * (aperture === 'slit' ? 1 : 1.22))
      : firstMin;
    const screenW = refFirstMin * 8;
    const wlc = (window as any).wavelengthToColor as (n: number) => string;
    const wls = compare ? COMPARE_WLS : [wavelength];

    for (const wl of wls) {
      ctx.strokeStyle = wlc(wl);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const x = m + px;
        const y_m = (px / plotW - 0.5) * screenW;
        const I = intensityAt(y_m, wl);
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    if (!compare) {
      const xMin1 = W/2 + (firstMin / screenW) * plotW;
      const xMin2 = W/2 - (firstMin / screenW) * plotW;
      ctx.setLineDash([3,3]);
      ctx.strokeStyle = ink3;
      ctx.beginPath(); ctx.moveTo(xMin1, m); ctx.lineTo(xMin1, H-m); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xMin2, m); ctx.lineTo(xMin2, H-m); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(`±${(firstMin*1000).toFixed(2)} mm`, W/2 + 6, m + 12);
    } else {
      // legend
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = wlc(COMPARE_WLS[i]);
        ctx.fillRect(W - m - 90, m + 4 + i*14, 10, 3);
        ctx.fillStyle = ink3;
        ctx.fillText(`${COMPARE_WLS[i]} nm`, W - m - 75, m + 10 + i*14);
      }
    }
    ctx.fillStyle = ink3;
    ctx.fillText('I(y)', m + 4, m + 12);
  }

  return (
    <div className="pattern-wrap" style={{ gridTemplateRows: settings.showIntensity ? '1fr 1fr' : '1fr' }}>
      <div className="pattern-card">
        <div className="card-head">
          <span>{aperture === 'slit' ? '单缝衍射图样' : '圆孔衍射图样 (艾里斑)'}</span>
          {settings.compareMode
            ? <span className="chip"><span className="dot" style={{ background: 'linear-gradient(90deg, #4080ff, #40ff80, #ff4040)' }} />RGB 对比</span>
            : <span className="chip"><span className="dot" style={{ background: color }} />λ = {wavelength} nm</span>}
        </div>
        <div className="card-body"><canvas ref={patternRef} /></div>
      </div>
      {settings.showIntensity && (
        <div className="pattern-card light">
          <div className="card-head">
            <span>强度分布 I(θ)</span>
            <span className="chip"><span className="dot" />
              {aperture === 'slit' ? 'sinc²' : '(2J₁/x)²'}
            </span>
          </div>
          <div className="card-body"><canvas ref={plotRef} /></div>
        </div>
      )}
    </div>
  );
}

function DiffractionControls({ settings, setSettings }: { settings: DiffractionSettings; setSettings: (s: DiffractionSettings) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const SegSelect = (window as any).SegSelect;
  const getParamSpec = (key: string): ExperimentParamSpec | undefined => (window as any).getP03ParamSpec('diffraction', settings.experimentId, key);
  return (
    <>
      <SectionTitle aside="APERTURE">孔径类型</SectionTitle>
      <SegSelect value={settings.aperture}
        onChange={(v: ApertureKind) => setSettings({ ...settings, aperture: v, experimentId: v === 'slit' ? 'opt-031' : 'opt-032' })}
        options={[{ value: 'slit', label: '单缝' }, { value: 'circle', label: '圆孔' }]} />

      <SectionTitle aside="PARAMS">参数调节</SectionTitle>
      {settings.aperture === 'slit' ? (
        <Slider label="缝宽 a" value={settings.slitWidth}
          onChange={(v: number) => setSettings({ ...settings, slitWidth: v })}
          min={getParamSpec('slitWidth')?.min ?? 10} max={getParamSpec('slitWidth')?.max ?? 500} step={getParamSpec('slitWidth')?.step ?? 5} unit="μm"
          hint="缝越窄，中央亮纹越宽" />
      ) : (
        <Slider label="孔径 D" value={settings.diameter}
          onChange={(v: number) => setSettings({ ...settings, diameter: v })}
          min={getParamSpec('diameter')?.min ?? 20} max={getParamSpec('diameter')?.max ?? 1000} step={getParamSpec('diameter')?.step ?? 10} unit="μm" />
      )}
      <Slider label="波长 λ" value={settings.wavelength}
        onChange={(v: number) => setSettings({ ...settings, wavelength: v })}
        min={getParamSpec('wavelength')?.min ?? 380} max={getParamSpec('wavelength')?.max ?? 780} step={getParamSpec('wavelength')?.step ?? 10} unit="nm" />
      <Slider label="屏距 L" value={settings.screenDistance}
        onChange={(v: number) => setSettings({ ...settings, screenDistance: v })}
        min={0.5} max={3.0} step={0.05} unit="m" />

      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>
      <Toggle label="颜色显示" checked={settings.showColor}
        onChange={(v: boolean) => setSettings({ ...settings, showColor: v })} />
      <Toggle label="强度曲线" checked={settings.showIntensity}
        onChange={(v: boolean) => setSettings({ ...settings, showIntensity: v })} />
      <Toggle label="多波长对比 (RGB)" checked={settings.compareMode === true}
        onChange={(v: boolean) => setSettings({ ...settings, compareMode: v })} />
      <Toggle label="公式验证" checked={settings.showFormula}
        onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />
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
  const SectionTitle = (window as any).SectionTitle;
  const Readout = (window as any).Readout;
  const FormulaBlock = (window as any).FormulaBlock;
  return (
    <>
      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="readouts">
        {isSlit
          ? <Readout label="缝宽 a" value={settings.slitWidth} unit="μm" />
          : <Readout label="孔径 D" value={settings.diameter} unit="μm" />}
        <Readout label="波长 λ" value={settings.wavelength} unit="nm" />
        <Readout label="屏距 L" value={L.toFixed(2)} unit="m" />
        <Readout label={isSlit ? '第一极小 y₁' : '艾里盘半径'}
          value={(firstMin*1000).toFixed(3)} unit="mm" hi />
        <Readout label="趋势" value={isSlit ? 'a↓ 或 λ↑ => 条纹变宽' : 'D↓ 或 λ↑ => 艾里斑变大'} unit="" />
      </div>
      {settings.showFormula && (
        <>
          <SectionTitle aside={isSlit ? "FRAUNHOFER" : "AIRY"}>公式</SectionTitle>
          <FormulaBlock>
            {isSlit ? (
              <>
                <span className="step"><span className="lhs">a sin θ</span><span className="eq">=</span><span className="rhs">λ  (第一极小)</span></span>
                <span className="step"><span className="lhs">y₁ ≈ Lλ/a</span></span>
                <span className="step mono"> = {L} × {settings.wavelength}e⁻⁹ / {settings.slitWidth}e⁻⁶</span>
                <span className="step"><span className="lhs">y₁</span><span className="eq">=</span><span className="rhs"><span className="hi">{(firstMin*1000).toFixed(3)} mm</span></span></span>
              </>
            ) : (
              <>
                <span className="step"><span className="lhs">sin θ</span><span className="eq">=</span><span className="rhs">1.22 λ/D</span></span>
                <span className="step"><span className="lhs">r₁ ≈ 1.22 Lλ/D</span></span>
                <span className="step"><span className="lhs">r₁</span><span className="eq">=</span><span className="rhs"><span className="hi">{(firstMin*1000).toFixed(3)} mm</span></span></span>
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
