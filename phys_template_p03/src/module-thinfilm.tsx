// Module 5: Thin-film interference
const React = (window as any).React;

type FilmKind = 'newton' | 'wedge' | 'soap';
interface ThinFilmSettings {
  experimentId: 'opt-041' | 'opt-042' | 'opt-043';
  filmType: FilmKind;
  wavelength: number;
  thickness: number;
  filmN: number;
  lensR: number;
  wedgeAngle: number;
  showIntensity: boolean;
  showFormula: boolean;
}

function ThinFilmModule({ settings }: { settings: ThinFilmSettings }) {
  const { filmType, wavelength, thickness, filmN, lensR, wedgeAngle } = settings;
  const lam = wavelength * 1e-9;
  const color = (window as any).wavelengthToColor(wavelength) as string;

  const patternRef = React.useRef<HTMLCanvasElement | null>(null);
  const plotRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => { drawPattern(); drawPlot(); }, [filmType, wavelength, thickness, filmN, lensR, wedgeAngle, settings.showIntensity]);

  function rings_intensity_at_r(r_m: number): number {
    const t = (r_m * r_m) / (2 * lensR);
    const phi = 2 * Math.PI * (2 * filmN * t) / lam + Math.PI;
    return Math.pow(Math.cos(phi / 2), 2);
  }
  function wedge_intensity_at_x(x_m: number): number {
    const t = Math.max(0, x_m) * Math.tan(wedgeAngle * Math.PI / 180 / 60);
    const phi = 2 * Math.PI * (2 * filmN * t) / lam + Math.PI;
    return Math.pow(Math.cos(phi / 2), 2);
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
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
    const cr = +m[1], cg = +m[2], cb = +m[3];
    const img = ctx.createImageData(W, H);

    if (filmType === 'newton') {
      const r_max = Math.sqrt(8 * lam * lensR / filmN);
      const scale = Math.min(W, H) / 2 / r_max;
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const dx = (px - W/2) / scale;
          const dy = (py - H/2) / scale;
          const r = Math.hypot(dx, dy);
          const I = rings_intensity_at_r(r);
          const v = Math.pow(Math.max(0, Math.min(1, I)), 0.7);
          const idx = (py*W + px)*4;
          img.data[idx] = cr*v; img.data[idx+1] = cg*v; img.data[idx+2] = cb*v; img.data[idx+3] = 255;
        }
      }
    } else if (filmType === 'wedge') {
      const x_max = 50 * lam / (2 * filmN) / Math.tan(wedgeAngle * Math.PI/180/60);
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const x_m = (px / W) * x_max;
          const I = wedge_intensity_at_x(x_m);
          const v = Math.pow(Math.max(0, Math.min(1, I)), 0.7);
          const idx = (py*W + px)*4;
          img.data[idx] = cr*v; img.data[idx+1] = cg*v; img.data[idx+2] = cb*v; img.data[idx+3] = 255;
        }
      }
    } else if (filmType === 'soap') {
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const t_nm = thickness * (1 - py / H) + 50;
          const wobble = Math.sin(px * 0.02 + py * 0.015) * 40;
          const tEff = Math.max(0, (t_nm + wobble) * 1e-9);
          let R = 0, G = 0, B = 0;
          const SAMPLES: [number, number, number, number][] = [
            [650, 1, 0, 0],
            [532, 0, 1, 0],
            [470, 0, 0, 1],
          ];
          for (const [wl, kr, kg, kb] of SAMPLES) {
            const LL = wl * 1e-9;
            const phi = 2 * Math.PI * (2 * filmN * tEff) / LL + Math.PI;
            const I = Math.pow(Math.cos(phi/2), 2);
            R += kr * I; G += kg * I; B += kb * I;
          }
          const gamma = 0.7;
          const idx = (py*W + px)*4;
          img.data[idx] = Math.pow(Math.min(1, R), gamma) * 255;
          img.data[idx+1] = Math.pow(Math.min(1, G), gamma) * 255;
          img.data[idx+2] = Math.pow(Math.min(1, B), gamma) * 255;
          img.data[idx+3] = 255;
        }
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
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const m = H * 0.15;
    const plotW = W - m*2, plotH = H - m*2;
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border-strong').trim();
    const ink3 = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim();

    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(m, m); ctx.lineTo(m, H-m); ctx.lineTo(W-m, H-m); ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let title = '';
    let detail = '';
    if (filmType === 'newton') {
      const r_max = Math.sqrt(8 * lam * lensR / filmN);
      for (let px = 0; px <= plotW; px++) {
        const r = (px / plotW) * r_max;
        const I = rings_intensity_at_r(r);
        const x = m + px;
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      title = 'I(r) 径向分布';
      const r_k = (k: number): number => Math.sqrt(k * lam * lensR / filmN);
      detail = `r₁ = ${(r_k(1)*1000).toFixed(3)} mm · r₅ = ${(r_k(5)*1000).toFixed(3)} mm`;
    } else if (filmType === 'wedge') {
      const x_max = 50 * lam / (2 * filmN) / Math.tan(wedgeAngle*Math.PI/180/60);
      for (let px = 0; px <= plotW; px++) {
        const x_m = (px / plotW) * x_max;
        const I = wedge_intensity_at_x(x_m);
        const x = m + px;
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      title = 'I(x) 沿楔方向';
      const dx = lam / (2 * filmN * Math.tan(wedgeAngle*Math.PI/180/60));
      detail = `条纹间距 Δx = ${(dx*1000).toFixed(3)} mm`;
    } else {
      const t_max = thickness * 2 * 1e-9;
      for (let px = 0; px <= plotW; px++) {
        const t = (px / plotW) * t_max;
        const phi = 2 * Math.PI * (2 * filmN * t) / lam + Math.PI;
        const I = Math.pow(Math.cos(phi/2), 2);
        const x = m + px;
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      title = 'I(t) 随厚度';
      detail = '厚度: 上薄下厚';
    }

    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(title, m + 4, m + 12);
    ctx.fillText(detail, m + 4, H - m + 14);
  }

  const labels: Record<FilmKind, { head: string; desc: string }> = {
    newton: { head: "牛顿环 · Newton's Rings", desc: '平凸透镜置于平板上，空气薄层干涉形成同心圆环；中心为暗斑（半波损失）。' },
    wedge:  { head: '楔形薄膜 · Wedge Film', desc: '两块玻璃夹一薄空气楔，等厚干涉形成平行直条纹。' },
    soap:   { head: '肥皂泡 · Soap Film', desc: '薄膜重力下流薄化，白光下产生彩色等厚条纹。' },
  };

  return (
    <div className="pattern-wrap" style={{ gridTemplateRows: settings.showIntensity ? '1fr 1fr' : '1fr' }}>
      <div className="pattern-card">
        <div className="card-head">
          <span>{labels[filmType].head}</span>
          <span className="chip"><span className="dot" style={{ background: filmType === 'soap' ? 'linear-gradient(90deg, red, green, blue)' : color }} />{filmType === 'soap' ? '白光' : `λ = ${wavelength} nm`}</span>
        </div>
        <div className="card-body"><canvas ref={patternRef} /></div>
      </div>
      {settings.showIntensity && (
        <div className="pattern-card light">
          <div className="card-head">
            <span>{labels[filmType].desc}</span>
          </div>
          <div className="card-body"><canvas ref={plotRef} /></div>
        </div>
      )}
    </div>
  );
}

function ThinFilmControls({ settings, setSettings }: { settings: ThinFilmSettings; setSettings: (s: ThinFilmSettings) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const getParamSpec = (key: string): ExperimentParamSpec | undefined => (window as any).getP03ParamSpec('thinfilm', settings.experimentId, key);
  return (
    <>
      <SectionTitle aside="MODEL">模型</SectionTitle>
      <div className="seg vertical">
        {([
          { value: 'newton' as FilmKind, label: '牛顿环（同心圆）' },
          { value: 'wedge'  as FilmKind, label: '楔形薄膜（平行条纹）' },
          { value: 'soap'   as FilmKind, label: '肥皂泡（彩色条纹）' },
        ]).map(o => (
          <button key={o.value}
            className={settings.filmType === o.value ? 'seg-item active' : 'seg-item'}
            onClick={() => setSettings({
              ...settings,
              filmType: o.value,
              experimentId: o.value === 'soap' ? 'opt-041' : o.value === 'wedge' ? 'opt-042' : 'opt-043',
            })}
          >{o.label}</button>
        ))}
      </div>

      <SectionTitle aside="PARAMS">参数调节</SectionTitle>
      {settings.filmType === 'newton' && (
        <Slider label="透镜曲率半径 R" value={settings.lensR}
          onChange={(v: number) => setSettings({ ...settings, lensR: v })}
          min={getParamSpec('lensR')?.min ?? 0.1} max={getParamSpec('lensR')?.max ?? 10.0} step={getParamSpec('lensR')?.step ?? 0.1} unit="m" />
      )}
      {settings.filmType === 'wedge' && (
        <Slider label="楔角 α" value={settings.wedgeAngle}
          onChange={(v: number) => setSettings({ ...settings, wedgeAngle: v })}
          min={getParamSpec('wedgeAngle')?.min ?? 0.1} max={getParamSpec('wedgeAngle')?.max ?? 10} step={getParamSpec('wedgeAngle')?.step ?? 0.1} unit="′"
          hint="角度越小条纹越稀疏" />
      )}
      {settings.filmType === 'soap' && (
        <Slider label="薄膜厚度 t" value={settings.thickness}
          onChange={(v: number) => setSettings({ ...settings, thickness: v })}
          min={getParamSpec('thickness')?.min ?? 200} max={getParamSpec('thickness')?.max ?? 1800} step={getParamSpec('thickness')?.step ?? 20} unit="nm" />
      )}
      {settings.filmType !== 'soap' && (
        <Slider label="波长 λ" value={settings.wavelength}
          onChange={(v: number) => setSettings({ ...settings, wavelength: v })}
          min={getParamSpec('wavelength')?.min ?? 380} max={getParamSpec('wavelength')?.max ?? 780} step={getParamSpec('wavelength')?.step ?? 10} unit="nm" />
      )}
      <Slider label="薄膜折射率 n" value={settings.filmN}
        onChange={(v: number) => setSettings({ ...settings, filmN: v })}
        min={getParamSpec('filmN')?.min ?? 1.0} max={getParamSpec('filmN')?.max ?? 1.6} step={getParamSpec('filmN')?.step ?? 0.01} unit="" />

      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>
      <Toggle label="强度曲线" checked={settings.showIntensity}
        onChange={(v: boolean) => setSettings({ ...settings, showIntensity: v })} />
      <Toggle label="公式验证" checked={settings.showFormula}
        onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />
    </>
  );
}

function ThinFilmReadouts({ settings }: { settings: ThinFilmSettings }) {
  const lam = settings.wavelength * 1e-9;
  const SectionTitle = (window as any).SectionTitle;
  const Readout = (window as any).Readout;
  const FormulaBlock = (window as any).FormulaBlock;
  let primary: any = null, formula: any = null;
  if (settings.filmType === 'newton') {
    const r1 = Math.sqrt(1 * lam * settings.lensR / settings.filmN);
    const r5 = Math.sqrt(5 * lam * settings.lensR / settings.filmN);
    primary = (
      <>
        <Readout label="曲率半径 R" value={settings.lensR.toFixed(2)} unit="m" />
        <Readout label="波长 λ" value={settings.wavelength} unit="nm" />
        <Readout label="第一暗环半径 r₁" value={(r1*1000).toFixed(3)} unit="mm" hi />
        <Readout label="第五暗环半径 r₅" value={(r5*1000).toFixed(3)} unit="mm" />
      </>
    );
    formula = (
      <FormulaBlock>
        <span className="step"><span className="lhs">r_k</span><span className="eq">=</span><span className="rhs">√(kλR/n)</span></span>
        <span className="step mono"> r₁ = √(1 × {settings.wavelength}e⁻⁹ × {settings.lensR})</span>
        <span className="step"><span className="lhs">r₁</span><span className="eq">=</span><span className="rhs"><span className="hi">{(r1*1000).toFixed(3)} mm</span></span></span>
      </FormulaBlock>
    );
  } else if (settings.filmType === 'wedge') {
    const dx = lam / (2 * settings.filmN * Math.tan(settings.wedgeAngle*Math.PI/180/60));
    primary = (
      <>
        <Readout label="楔角 α" value={settings.wedgeAngle.toFixed(1)} unit="′" />
        <Readout label="波长 λ" value={settings.wavelength} unit="nm" />
        <Readout label="条纹间距 Δx" value={(dx*1000).toFixed(3)} unit="mm" hi />
      </>
    );
    formula = (
      <FormulaBlock>
        <span className="step"><span className="lhs">Δx</span><span className="eq">=</span><span className="rhs">λ / (2n tan α)</span></span>
        <span className="step"><span className="lhs">Δx</span><span className="eq">=</span><span className="rhs"><span className="hi">{(dx*1000).toFixed(3)} mm</span></span></span>
      </FormulaBlock>
    );
  } else {
    primary = (
      <>
        <Readout label="厚度 t" value={settings.thickness} unit="nm" />
        <Readout label="折射率 n" value={settings.filmN.toFixed(2)} unit="" />
        <Readout label="2nt" value={(2*settings.filmN*settings.thickness).toFixed(0)} unit="nm" hi />
      </>
    );
    formula = (
      <FormulaBlock>
        <span className="step"><span className="lhs">2nt + λ/2</span><span className="eq">=</span><span className="rhs">kλ  (亮)</span></span>
        <span className="step"><span className="lhs">2nt + λ/2</span><span className="eq">=</span><span className="rhs">(k+½)λ  (暗)</span></span>
        <span className="step" style={{ color: 'var(--ink-3)', fontSize: 11 }}>白光下不同 λ 满足条件位置不同 → 彩色条纹</span>
      </FormulaBlock>
    );
  }
  return (
    <>
      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="readouts">{primary}</div>
      {settings.showFormula && <><SectionTitle aside="FILM">公式</SectionTitle>{formula}</>}
    </>
  );
}

Object.assign(window, { ThinFilmModule, ThinFilmControls, ThinFilmReadouts });

export {};
