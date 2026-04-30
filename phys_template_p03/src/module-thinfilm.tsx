// Module 5: Thin-film interference — rebuilt around "cause diagram + pattern + relation curve".
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

const SOAP_SAMPLES: [number, string][] = [
  [650, '#ff5a36'],
  [532, '#45d483'],
  [470, '#4a8dff'],
];

const NEWTON_SAMPLE_X_MIN = 228;
const NEWTON_SAMPLE_X_RANGE = 148;

function fmt(v: number, digits = 3): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function soapIntensityAtThickness(t_m: number, wl_m: number, n: number): number {
  const phi = 2 * Math.PI * (2 * n * t_m) / wl_m + Math.PI;
  return Math.pow(Math.cos(phi / 2), 2);
}

function newtonThicknessAtR(r_m: number, lensR: number): number {
  return (r_m * r_m) / (2 * lensR);
}

function newtonDiagramLensY(x: number, apexSag: number): number {
  const t = clamp((x - 120) / 240, 0, 1);
  return 180 - 2 * apexSag * t * (1 - t);
}

function ThinFilmModule({ settings }: { settings: ThinFilmSettings }) {
  const { filmType, wavelength, thickness, filmN, lensR, wedgeAngle } = settings;
  const lam = wavelength * 1e-9;
  const color = (window as any).wavelengthToColor(wavelength) as string;

  const diagramRef = React.useRef<SVGSVGElement | null>(null);
  const patternRef = React.useRef<HTMLCanvasElement | null>(null);
  const plotRef = React.useRef<HTMLCanvasElement | null>(null);
  const [newtonSampleRatio, setNewtonSampleRatio] = React.useState<number>(0.28);
  const [dragNewtonSample, setDragNewtonSample] = React.useState<boolean>(false);
  const isNewton = filmType === 'newton';
  const newtonRMax = Math.sqrt(8 * lam * lensR / filmN);
  const newtonSampleR = newtonSampleRatio * newtonRMax;
  const newtonSampleT = newtonThicknessAtR(newtonSampleR, lensR);
  const newtonSampleI = soapIntensityAtThickness(newtonSampleT, lam, filmN);

  (window as any).__thinfilmNewtonSampleRatio = newtonSampleRatio;
  React.useEffect(() => {
    (window as any).__thinfilmNewtonSampleRatio = newtonSampleRatio;
    window.dispatchEvent(new CustomEvent('__thinfilm_newton_sample_changed', { detail: { ratio: newtonSampleRatio } }));
  }, [newtonSampleRatio]);

  React.useEffect(() => {
    if (!isNewton) return;
    const nextRatio = clamp(newtonSampleRatio, 0, 0.92);
    if (nextRatio !== newtonSampleRatio) setNewtonSampleRatio(nextRatio);
  }, [isNewton, newtonSampleRatio]);

  React.useEffect(() => {
    if (!dragNewtonSample || !diagramRef.current || !isNewton) return;

    const updateSampleFromClientX = (clientX: number): void => {
      if (!diagramRef.current) return;
      const rect = diagramRef.current.getBoundingClientRect();
      const localX = ((clientX - rect.left) / rect.width) * 900;
      const ratio = clamp((localX - NEWTON_SAMPLE_X_MIN) / NEWTON_SAMPLE_X_RANGE, 0, 0.92);
      setNewtonSampleRatio(ratio);
    };

    const onMove = (event: PointerEvent): void => updateSampleFromClientX(event.clientX);
    const onUp = (): void => setDragNewtonSample(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragNewtonSample, isNewton]);

  React.useEffect(() => {
    drawPattern();
    drawPlot();
  }, [filmType, wavelength, thickness, filmN, lensR, wedgeAngle, settings.showIntensity, newtonSampleRatio]);

  function ringsIntensityAtR(r_m: number): number {
    const t = (r_m * r_m) / (2 * lensR);
    return soapIntensityAtThickness(t, lam, filmN);
  }

  function wedgeIntensityAtX(x_m: number): number {
    const t = Math.max(0, x_m) * Math.tan(wedgeAngle * Math.PI / 180 / 60);
    return soapIntensityAtThickness(t, lam, filmN);
  }

  function drawPattern(): void {
    const cv = patternRef.current as HTMLCanvasElement | null;
    if (!cv) return;
    const parent = cv.parentElement as HTMLElement;
    const W = parent.clientWidth, H = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) as RegExpMatchArray;
    const cr = +m[1], cg = +m[2], cb = +m[3];
    const img = ctx.createImageData(W, H);

    if (filmType === 'newton') {
      const rMax = Math.sqrt(8 * lam * lensR / filmN);
      const scale = Math.min(W, H) / 2 / Math.max(rMax, 1e-9);
      const sampleRPx = newtonSampleR * scale;
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const dx = (px - W / 2) / scale;
          const dy = (py - H / 2) / scale;
          const r = Math.hypot(dx, dy);
          const I = ringsIntensityAtR(r);
          const v = Math.pow(clamp(I, 0, 1), 0.72);
          const idx = (py * W + px) * 4;
          img.data[idx] = cr * v;
          img.data[idx + 1] = cg * v;
          img.data[idx + 2] = cb * v;
          img.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, Math.max(12, Math.min(W, H) * 0.09), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillText('中心暗斑', W / 2 - 28, 18);
      ctx.strokeStyle = 'rgba(255,255,255,0.84)';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(W / 2 + sampleRPx, H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.beginPath();
      ctx.arc(W / 2 + sampleRPx, H / 2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`采样 r = ${fmt(newtonSampleR * 1000)} mm`, W / 2 + sampleRPx + 10, H / 2 - 10);
      return;
    }

    if (filmType === 'wedge') {
      const xMax = 50 * lam / (2 * filmN) / Math.max(Math.tan(wedgeAngle * Math.PI / 180 / 60), 1e-7);
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const x_m = (px / W) * xMax;
          const I = wedgeIntensityAtX(x_m);
          const v = Math.pow(clamp(I, 0, 1), 0.72);
          const idx = (py * W + px) * 4;
          img.data[idx] = cr * v;
          img.data[idx + 1] = cg * v;
          img.data[idx + 2] = cb * v;
          img.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillText('等厚干涉条纹', 12, 18);
      return;
    }

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const tNm = thickness * (1 - py / H) + 50;
        const wobble = Math.sin(px * 0.02 + py * 0.015) * 40;
        const tEff = Math.max(0, (tNm + wobble) * 1e-9);
        let R = 0;
        let G = 0;
        let B = 0;
        SOAP_SAMPLES.forEach(([wl, tint]) => {
          const localLam = wl * 1e-9;
          const I = soapIntensityAtThickness(tEff, localLam, filmN);
          if (tint === '#ff5a36') R += I;
          if (tint === '#45d483') G += I;
          if (tint === '#4a8dff') B += I;
        });
        const idx = (py * W + px) * 4;
        img.data[idx] = Math.pow(Math.min(1, R), 0.72) * 255;
        img.data[idx + 1] = Math.pow(Math.min(1, G), 0.72) * 255;
        img.data[idx + 2] = Math.pow(Math.min(1, B), 0.72) * 255;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '12px JetBrains Mono, monospace';
    ctx.fillText('白光下不同波长在不同厚度位置增强', 12, 18);
  }

  function drawPlot(): void {
    const cv = plotRef.current as HTMLCanvasElement | null;
    if (!cv) return;
    const parent = cv.parentElement as HTMLElement;
    const W = parent.clientWidth, H = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
    const ink3 = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim();
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border-strong').trim();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const m = H * 0.15;
    const plotW = W - m * 2;
    const plotH = H - m * 2;

    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(m, m);
    ctx.lineTo(m, H - m);
    ctx.lineTo(W - m, H - m);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    let detail = '';

    if (filmType === 'newton') {
      const rMax = Math.sqrt(8 * lam * lensR / filmN);
      const r1 = Math.sqrt(1 * lam * lensR / filmN);
      const r5 = Math.sqrt(5 * lam * lensR / filmN);
      const xSample = m + (newtonSampleR / rMax) * plotW;
      const ySample = (H - m) - newtonSampleI * plotH;
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const r = (px / plotW) * rMax;
        const I = ringsIntensityAtR(r);
        const x = m + px;
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const x1 = m + (r1 / rMax) * plotW;
      const x5 = m + (r5 / rMax) * plotW;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = ink3;
      ctx.beginPath();
      ctx.moveTo(x1, m);
      ctx.lineTo(x1, H - m);
      ctx.moveTo(x5, m);
      ctx.lineTo(x5, H - m);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(60,60,60,0.55)';
      ctx.beginPath();
      ctx.moveTo(xSample, m);
      ctx.lineTo(xSample, H - m);
      ctx.stroke();
      ctx.fillStyle = 'rgba(132,255,41,0.95)';
      ctx.beginPath();
      ctx.arc(xSample, ySample, 5, 0, Math.PI * 2);
      ctx.fill();
      detail = `r₁ = ${fmt(r1 * 1000)} mm · r₅ = ${fmt(r5 * 1000)} mm`;
      ctx.fillStyle = ink3;
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText('I(r) 径向分布', m + 4, m + 12);
      ctx.fillText(`采样点：r = ${fmt(newtonSampleR * 1000)} mm`, W - m - 180, m + 12);
    } else if (filmType === 'wedge') {
      const xMax = 50 * lam / (2 * filmN) / Math.max(Math.tan(wedgeAngle * Math.PI / 180 / 60), 1e-7);
      const dx = lam / (2 * filmN * Math.max(Math.tan(wedgeAngle * Math.PI / 180 / 60), 1e-7));
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const xM = (px / plotW) * xMax;
        const I = wedgeIntensityAtX(xM);
        const x = m + px;
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const x1 = m + (dx / xMax) * plotW;
      const x2 = m + (2 * dx / xMax) * plotW;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = ink3;
      ctx.beginPath();
      ctx.moveTo(x1, m);
      ctx.lineTo(x1, H - m);
      ctx.moveTo(x2, m);
      ctx.lineTo(x2, H - m);
      ctx.stroke();
      ctx.setLineDash([]);
      detail = `条纹间距 Δx = ${fmt(dx * 1000)} mm`;
      ctx.fillStyle = ink3;
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText('I(x) 沿楔方向', m + 4, m + 12);
    } else {
      const tMax = thickness * 2 * 1e-9;
      SOAP_SAMPLES.forEach(([wl, stroke]) => {
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        for (let px = 0; px <= plotW; px++) {
          const t = (px / plotW) * tMax;
          const I = soapIntensityAtThickness(t, wl * 1e-9, filmN);
          const x = m + px;
          const y = (H - m) - I * plotH;
          if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      detail = '红 / 绿 / 蓝在不同膜厚位置满足增强条件';
      ctx.fillStyle = ink3;
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText('I(t) 与厚度对应关系', m + 4, m + 12);
      SOAP_SAMPLES.forEach(([wl, stroke], index) => {
        ctx.fillStyle = stroke;
        ctx.fillRect(W - m - 110, m + 4 + index * 15, 10, 3);
        ctx.fillStyle = ink3;
        ctx.fillText(`${wl} nm`, W - m - 94, m + 10 + index * 15);
      });
    }

    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(detail, m + 4, H - m + 14);
  }

  return (
    <div className="pattern-wrap thinfilm-layout" style={{ gridTemplateRows: settings.showIntensity ? '340px 1.18fr 0.42fr' : '340px 1fr' }}>
      <div className="pattern-card light">
        <div className="card-head">
          <span>{filmType === 'soap' ? '成因示意 · 膜厚沿高度变化' : filmType === 'wedge' ? '成因示意 · 等厚干涉' : '成因示意 · 空气膜厚随半径变化'}</span>
          <span className="chip"><span className="dot" />{filmType === 'newton' ? '拖动采样点观察 r -> t(r) -> 亮暗' : '为什么会形成这种图样'}</span>
        </div>
        <div className="card-body">
          <ThinFilmDiagram
            settings={settings}
            svgRef={diagramRef}
            newtonSampleRatio={newtonSampleRatio}
            onNewtonSampleDown={(clientX?: number) => {
              if (typeof clientX === 'number' && diagramRef.current) {
                const rect = diagramRef.current.getBoundingClientRect();
                const localX = ((clientX - rect.left) / rect.width) * 900;
                const ratio = clamp((localX - 420) / 240, 0, 0.92);
                setNewtonSampleRatio(ratio);
              }
              setDragNewtonSample(true);
            }}
          />
        </div>
      </div>

      <div className="pattern-card">
        <div className="card-head">
          <span>{filmType === 'soap' ? '肥皂泡彩色条纹' : filmType === 'wedge' ? '楔形薄膜条纹' : '牛顿环图样'}</span>
          <span className="chip"><span className="dot" style={{ background: filmType === 'soap' ? 'linear-gradient(90deg, #ff5a36, #45d483, #4a8dff)' : color }} />{filmType === 'soap' ? '白光' : `λ = ${wavelength} nm`}</span>
        </div>
        <div className="card-body"><canvas ref={patternRef} /></div>
      </div>

      {settings.showIntensity && (
        <div className="pattern-card light">
          <div className="card-head">
            <span>{filmType === 'soap' ? '厚度与颜色响应' : filmType === 'wedge' ? '位置与条纹关系' : '半径与环纹关系'}</span>
            <span className="chip"><span className="dot" />{filmType === 'soap' ? '多波长响应' : filmType === 'wedge' ? 'Δx 已标识' : 'r₁ / r₅ 已标识'}</span>
          </div>
          <div className="card-body"><canvas ref={plotRef} /></div>
        </div>
      )}
    </div>
  );
}

function ThinFilmDiagram({
  settings,
  svgRef,
  newtonSampleRatio,
  onNewtonSampleDown,
}: {
  settings: ThinFilmSettings;
  svgRef?: { current: SVGSVGElement | null };
  newtonSampleRatio?: number;
  onNewtonSampleDown?: (clientX?: number) => void;
}) {
  const { filmType, thickness, filmN, lensR, wedgeAngle } = settings;

  if (filmType === 'soap') {
    return (
      <svg className="thinfilm-diagram" viewBox="0 0 900 260" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="soap-film-h" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.78)" />
            <stop offset="100%" stopColor="rgba(110, 255, 215, 0.38)" />
          </linearGradient>
        </defs>
        {/* 薄膜结构 */}
        <line x1="200" y1="110" x2="580" y2="110" className="thinfilm-boundary" style={{ strokeWidth: 5 }} />
        <line x1="200" y1="180" x2="580" y2="180" className="thinfilm-boundary" style={{ strokeWidth: 5 }} />
        <rect x="200" y="110" width="380" height="70" fill="url(#soap-film-h)" opacity="0.72" />
        <text x="590" y="118" className="label-txt dim" style={{ fontSize: 15 }}>上表面</text>
        <text x="590" y="188" className="label-txt dim" style={{ fontSize: 15 }}>下表面</text>

        {/* 入射光：严格竖直 */}
        <line x1="390" y1="22" x2="390" y2="110" className="ray" stroke="rgba(255,199,62,0.96)" strokeWidth="4" />
        <polygon points="390,106 385,92 395,92" fill="rgba(255,199,62,0.96)" />

        {/* 穿过薄膜 */}
        <line x1="390" y1="110" x2="390" y2="180" className="ray" stroke="rgba(255,199,62,0.44)" strokeWidth="2.5" />

        {/* 上表面反射：严格竖直偏左 */}
        <line x1="390" y1="110" x2="370" y2="22" className="ray" stroke="rgba(255,120,120,0.88)" strokeWidth="3.6" />
        <polygon points="370,26 365,40 375,40" fill="rgba(255,120,120,0.88)" />

        {/* 下表面反射：严格竖直偏右 */}
        <line x1="390" y1="180" x2="410" y2="22" className="ray" stroke="rgba(100,220,255,0.88)" strokeWidth="3.6" />
        <polygon points="410,26 405,40 415,40" fill="rgba(100,220,255,0.88)" />

        {/* 标签：分列两侧，避免重叠 */}
        <text x="286" y="42" className="label-txt dim" style={{ fontSize: 15 }} fill="rgba(255,120,120,0.92)">上表面反射 ①</text>
        <text x="422" y="42" className="label-txt" style={{ fontSize: 15 }}>入射光</text>
        <text x="422" y="62" className="label-txt dim" style={{ fontSize: 15 }} fill="rgba(100,220,255,0.92)">下表面反射 ②</text>

        {/* 膜厚标注 */}
        <line x1="178" y1="110" x2="178" y2="180" className="thinfilm-guide" style={{ strokeWidth: 2 }} />
        <polygon points="178,112 173,124 183,124" fill="rgba(80,80,80,0.6)" />
        <polygon points="178,178 173,166 183,166" fill="rgba(80,80,80,0.6)" />
        <text x="152" y="150" className="label-txt" style={{ fontSize: 16 }} textAnchor="end">t</text>

        {/* 膜厚变化提示 */}
        <line x1="240" y1="210" x2="540" y2="210" className="thinfilm-guide" style={{ strokeWidth: 2 }} />
        <polygon points="240,210 254,205 254,215" fill="rgba(80,80,80,0.6)" />
        <polygon points="540,210 526,205 526,215" fill="rgba(80,80,80,0.6)" />
        <text x="390" y="236" className="label-txt dim" style={{ fontSize: 15 }} textAnchor="middle">膜厚沿水平方向变化</text>
        <text x="240" y="236" className="label-txt dim" style={{ fontSize: 13 }} textAnchor="middle">薄</text>
        <text x="540" y="236" className="label-txt dim" style={{ fontSize: 13 }} textAnchor="middle">厚</text>

        {/* 右侧参数 */}
        <text x="680" y="120" className="label-txt" style={{ fontSize: 16 }}>n = {filmN.toFixed(2)}</text>
        <text x="680" y="146" className="label-txt" style={{ fontSize: 16 }}>t ≈ {Math.round(thickness)} nm</text>
        <text x="680" y="174" className="label-txt dim" style={{ fontSize: 14 }}>垂直入射 (θ = 0)</text>
      </svg>
    );
  }

  if (filmType === 'wedge') {
    const hitX = 440;
    const topY = 168 - (hitX - 286) / (688 - 286) * (168 - 72);
    const bottomY = 168;
    return (
      <svg className="thinfilm-diagram" viewBox="0 0 900 260" preserveAspectRatio="xMidYMid meet">
        {/* 楔形结构 */}
        <line x1="286" y1="128" x2="688" y2="72" className="thinfilm-plate" style={{ strokeWidth: 5 }} />
        <line x1="286" y1="168" x2="688" y2="168" className="thinfilm-plate" style={{ strokeWidth: 5 }} />
        <polygon points="286,168 286,128 688,72 688,168" fill="rgba(170,220,205,0.18)" />

        {/* 入射光：严格竖直 */}
        <line x1={hitX} y1="18" x2={hitX} y2={topY} className="ray" stroke="rgba(255,199,62,0.96)" strokeWidth="4" />
        <polygon points={`${hitX},${topY - 4} ${hitX - 5},${topY - 18} ${hitX + 5},${topY - 18}`} fill="rgba(255,199,62,0.96)" />

        {/* 穿过楔形膜 */}
        <line x1={hitX} y1={topY} x2={hitX} y2={bottomY} className="ray" stroke="rgba(255,199,62,0.44)" strokeWidth="2.5" />

        {/* 上表面反射：偏左 */}
        <line x1={hitX} y1={topY} x2={hitX - 22} y2="18" className="ray" stroke="rgba(255,120,120,0.88)" strokeWidth="3.6" />
        <polygon points={`${hitX - 22},22 ${hitX - 27},36 ${hitX - 17},36`} fill="rgba(255,120,120,0.88)" />

        {/* 下表面反射：偏右 */}
        <line x1={hitX} y1={bottomY} x2={hitX + 22} y2="18" className="ray" stroke="rgba(100,220,255,0.88)" strokeWidth="3.6" />
        <polygon points={`${hitX + 22},22 ${hitX + 17},36 ${hitX + 27},36`} fill="rgba(100,220,255,0.88)" />

        {/* 标签：分列排布，不重叠 */}
        <text x={hitX - 26} y="14" className="label-txt dim" style={{ fontSize: 14 }} textAnchor="end" fill="rgba(255,120,120,0.92)">①</text>
        <text x={hitX + 26} y="14" className="label-txt dim" style={{ fontSize: 14 }} fill="rgba(100,220,255,0.92)">②</text>

        {/* 右侧图例 */}
        <text x="700" y="80" className="label-txt" style={{ fontSize: 15 }}>入射光</text>
        <line x1="755" y1="76" x2="776" y2="76" stroke="rgba(255,199,62,0.96)" strokeWidth="3" />
        <text x="700" y="104" className="label-txt dim" style={{ fontSize: 14 }} fill="rgba(255,120,120,0.92)">① 上表面反射</text>
        <text x="700" y="126" className="label-txt dim" style={{ fontSize: 14 }} fill="rgba(100,220,255,0.92)">② 下表面反射</text>
        <text x="700" y="158" className="label-txt dim" style={{ fontSize: 14 }}>垂直入射 (θ = 0)</text>

        {/* 膜厚标注 */}
        <line x1="560" y1={168 - (560 - 286) / (688 - 286) * (168 - 72)} x2="560" y2="168" className="thinfilm-guide" style={{ strokeWidth: 2 }} />
        <text x="572" y="142" className="label-txt" style={{ fontSize: 16 }}>t(x)</text>

        {/* 楔角标注 */}
        <path d="M 308 176 A 74 74 0 0 1 380 156" className="thinfilm-guide" style={{ strokeWidth: 2 }} />
        <text x="330" y="208" className="label-txt" style={{ fontSize: 16 }}>α = {wedgeAngle.toFixed(1)}′</text>
        <text x="530" y="208" className="label-txt dim" style={{ fontSize: 14 }}>从左到右膜厚增大</text>
      </svg>
    );
  }

  const normalizedR = clamp(lensR / 10, 0, 1);
  const sag = 38 + normalizedR * 44;
  const sampleX = NEWTON_SAMPLE_X_MIN + (newtonSampleRatio ?? 0.28) * NEWTON_SAMPLE_X_RANGE;
  const sampleYTop = newtonDiagramLensY(sampleX, sag * 1.1);
  return (
    <svg ref={svgRef} className="thinfilm-diagram" viewBox="0 0 900 260" preserveAspectRatio="xMidYMid meet">
      {/* 结构 */}
      <path d={`M 140 180 Q 280 ${180 - sag * 1.1} 420 180`} className="thinfilm-lens" style={{ strokeWidth: 5 }} />
      <line x1="118" y1="180" x2="442" y2="180" className="thinfilm-plate" style={{ strokeWidth: 5 }} />
      <path d={`M 140 180 Q 280 ${180 - sag * 1.1} 420 180 L 420 180 L 140 180 Z`} fill="rgba(131,198,255,0.16)" />
      <text x="200" y="202" className="label-txt dim" style={{ fontSize: 14 }}>平板玻璃</text>
      <text x="230" y={130 - sag * 0.5} className="label-txt dim" style={{ fontSize: 14 }}>平凸透镜</text>
      <text x="240" y="164" className="label-txt dim" style={{ fontSize: 14 }}>空气膜</text>

      <circle cx="140" cy="180" r="4" fill="rgba(255,255,255,0.92)" />
      <text x="100" y="216" className="label-txt dim" style={{ fontSize: 13 }}>接触点</text>

      {/* 入射光：严格竖直 */}
      <line x1={sampleX} y1="42" x2={sampleX} y2={sampleYTop} className="ray" stroke="rgba(255,199,62,0.96)" strokeWidth="4" />
      <polygon points={`${sampleX},${sampleYTop - 2} ${sampleX - 5},${sampleYTop - 16} ${sampleX + 5},${sampleYTop - 16}`} fill="rgba(255,199,62,0.96)" />

      {/* 穿过空气膜 */}
      <line x1={sampleX} y1={sampleYTop} x2={sampleX} y2="180" className="ray" stroke="rgba(255,199,62,0.44)" strokeWidth="2.5" />

      {/* 上表面反射：偏左 */}
      <line x1={sampleX} y1={sampleYTop} x2={sampleX - 20} y2="42" className="ray" stroke="rgba(255,120,120,0.88)" strokeWidth="3.6" />
      <polygon points={`${sampleX - 20},46 ${sampleX - 25},60 ${sampleX - 15},60`} fill="rgba(255,120,120,0.88)" />

      {/* 下表面反射：偏右 */}
      <line x1={sampleX} y1="180" x2={sampleX + 20} y2="42" className="ray" stroke="rgba(100,220,255,0.88)" strokeWidth="3.6" />
      <polygon points={`${sampleX + 20},46 ${sampleX + 15},60 ${sampleX + 25},60`} fill="rgba(100,220,255,0.88)" />

      {/* 膜厚标注 */}
      <line x1={sampleX + 36} y1="180" x2={sampleX + 36} y2={sampleYTop} className="thinfilm-guide" style={{ strokeWidth: 2 }} />
      <text x={sampleX + 44} y={sampleYTop + 16} className="label-txt" style={{ fontSize: 15 }}>t(r)</text>

      {/* 采样半径线 + 绿点 */}
      <line x1="140" y1="180" x2={sampleX} y2="180" className="thinfilm-guide" style={{ strokeWidth: 2.2 }} />
      <circle
        cx={sampleX}
        cy="184"
        r="9"
        fill="rgba(132,255,41,0.96)"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.5"
        style={{ cursor: 'grab' }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onNewtonSampleDown?.(event.clientX);
        }}
      />

      {/* 右侧说明 */}
      <text x="530" y="44" className="label-txt" style={{ fontSize: 16 }}>垂直入射 · 两束反射光干涉</text>
      <line x1="530" y1="60" x2="550" y2="60" stroke="rgba(255,120,120,0.88)" strokeWidth="3" />
      <text x="556" y="65" className="label-txt dim" style={{ fontSize: 14 }} fill="rgba(255,120,120,0.92)">① 上表面反射</text>
      <line x1="530" y1="82" x2="550" y2="82" stroke="rgba(100,220,255,0.88)" strokeWidth="3" />
      <text x="556" y="87" className="label-txt dim" style={{ fontSize: 14 }} fill="rgba(100,220,255,0.92)">② 下表面反射</text>

      <text x="530" y="130" className="label-txt" style={{ fontSize: 15 }}>拖动绿点观察：</text>
      <text x="530" y="152" className="label-txt dim" style={{ fontSize: 14 }}>r 增大 → t(r) 增大 → 亮暗交替</text>
      <text x="530" y="174" className="label-txt dim" style={{ fontSize: 14 }}>中心 t = 0，牛顿环中心为暗</text>
    </svg>
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
          { value: 'wedge' as FilmKind, label: '楔形薄膜（平行条纹）' },
          { value: 'soap' as FilmKind, label: '肥皂泡（彩色条纹）' },
        ]).map((o) => (
          <button
            key={o.value}
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
        <Slider label="透镜曲率半径 R" value={settings.lensR} onChange={(v: number) => setSettings({ ...settings, lensR: v })} min={getParamSpec('lensR')?.min ?? 0.1} max={getParamSpec('lensR')?.max ?? 10.0} step={getParamSpec('lensR')?.step ?? 0.1} unit="m" />
      )}
      {settings.filmType === 'wedge' && (
        <Slider label="楔角 α" value={settings.wedgeAngle} onChange={(v: number) => setSettings({ ...settings, wedgeAngle: v })} min={getParamSpec('wedgeAngle')?.min ?? 0.1} max={getParamSpec('wedgeAngle')?.max ?? 10} step={getParamSpec('wedgeAngle')?.step ?? 0.1} unit="′" hint="楔角越小，条纹越稀疏" />
      )}
      {settings.filmType === 'soap' && (
        <Slider label="薄膜厚度 t" value={settings.thickness} onChange={(v: number) => setSettings({ ...settings, thickness: v })} min={getParamSpec('thickness')?.min ?? 200} max={getParamSpec('thickness')?.max ?? 1800} step={getParamSpec('thickness')?.step ?? 20} unit="nm" />
      )}
      {settings.filmType !== 'soap' && (
        <Slider label="波长 λ" value={settings.wavelength} onChange={(v: number) => setSettings({ ...settings, wavelength: v })} min={getParamSpec('wavelength')?.min ?? 380} max={getParamSpec('wavelength')?.max ?? 780} step={getParamSpec('wavelength')?.step ?? 10} unit="nm" />
      )}
      <Slider label="薄膜折射率 n" value={settings.filmN} onChange={(v: number) => setSettings({ ...settings, filmN: v })} min={getParamSpec('filmN')?.min ?? 1.0} max={getParamSpec('filmN')?.max ?? 1.6} step={getParamSpec('filmN')?.step ?? 0.01} unit="" />

      <SectionTitle aside="SCENE">课堂预设</SectionTitle>
      {settings.filmType === 'soap' && (
        <>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, thickness: 400, filmN: 1.33 })}>更薄泡膜</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, thickness: 1200, filmN: 1.33 })}>更厚泡膜</button>
          </div>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, thickness: 700, filmN: 1.20 })}>较低折射率</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, thickness: 700, filmN: 1.50 })}>较高折射率</button>
          </div>
        </>
      )}
      {settings.filmType === 'wedge' && (
        <>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, wedgeAngle: 0.4 })}>更小楔角</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, wedgeAngle: 2.4 })}>更大楔角</button>
          </div>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, wavelength: 700 })}>更长波长</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, wavelength: 450 })}>更短波长</button>
          </div>
        </>
      )}
      {settings.filmType === 'newton' && (
        <>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, lensR: 0.5 })}>更小曲率半径</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, lensR: 3.0 })}>更大曲率半径</button>
          </div>
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, wavelength: 700 })}>更长波长</button>
            <button className="preset-btn" onClick={() => setSettings({ ...settings, wavelength: 450 })}>更短波长</button>
          </div>
        </>
      )}

      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>
      <Toggle label="关系曲线" checked={settings.showIntensity} onChange={(v: boolean) => setSettings({ ...settings, showIntensity: v })} />
      <Toggle label="公式验证" checked={settings.showFormula} onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />
    </>
  );
}

function ThinFilmReadouts({ settings, newtonSampleRatio = (window as any).__thinfilmNewtonSampleRatio ?? 0.28 }: { settings: ThinFilmSettings; newtonSampleRatio?: number }) {
  const lam = settings.wavelength * 1e-9;
  const SectionTitle = (window as any).SectionTitle;
  const Readout = (window as any).Readout;
  const FormulaBlock = (window as any).FormulaBlock;
  const [interactiveRatio, setInteractiveRatio] = React.useState<number>(newtonSampleRatio);

  React.useEffect(() => {
    setInteractiveRatio(newtonSampleRatio);
  }, [newtonSampleRatio]);

  React.useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent).detail as { ratio?: number } | undefined;
      if (typeof detail?.ratio === 'number') setInteractiveRatio(detail.ratio);
    };
    window.addEventListener('__thinfilm_newton_sample_changed', handler as EventListener);
    return () => window.removeEventListener('__thinfilm_newton_sample_changed', handler as EventListener);
  }, []);

  let primary: any = null;
  let formula: any = null;
  let heroTitle = '';
  let heroValue = '';
  let heroUnit = '';
  let heroNote = '';
  let trend = '';

  if (settings.filmType === 'newton') {
    const r1 = Math.sqrt(1 * lam * settings.lensR / settings.filmN);
    const r5 = Math.sqrt(5 * lam * settings.lensR / settings.filmN);
    const rMax = Math.sqrt(8 * lam * settings.lensR / settings.filmN);
    const sampleR = interactiveRatio * rMax;
    const sampleT = newtonThicknessAtR(sampleR, settings.lensR);
    const sampleI = soapIntensityAtThickness(sampleT, lam, settings.filmN);
    heroTitle = '第一暗环半径';
    heroValue = fmt(r1 * 1000);
    heroUnit = 'mm';
    heroNote = '中心接触处膜厚最小，中心为暗斑。';
    trend = 'R ↑ 或 λ ↑ => 环纹半径增大';
    primary = (
      <>
        <Readout label="曲率半径 R" value={settings.lensR.toFixed(2)} unit="m" />
        <Readout label="波长 λ" value={settings.wavelength} unit="nm" />
        <Readout label="第一暗环半径 r₁" value={fmt(r1 * 1000)} unit="mm" hi />
        <Readout label="第五暗环半径 r₅" value={fmt(r5 * 1000)} unit="mm" />
        <Readout label="采样半径 r" value={fmt(sampleR * 1000)} unit="mm" />
        <Readout label="采样膜厚 t(r)" value={fmt(sampleT * 1e9)} unit="nm" />
        <Readout label="采样亮度 I" value={fmt(sampleI, 3)} unit="" />
        <Readout label="采样判定" value={sampleI > 0.66 ? '亮环附近' : sampleI < 0.34 ? '暗环附近' : '过渡区'} unit="" />
      </>
    );
    formula = (
      <FormulaBlock>
        <span className="step"><span className="lhs">r_k</span><span className="eq">=</span><span className="rhs">√(kλR / n)</span></span>
        <span className="step"><span className="lhs">r₁</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(r1 * 1000)} mm</span></span></span>
      </FormulaBlock>
    );
  } else if (settings.filmType === 'wedge') {
    const dx = lam / (2 * settings.filmN * Math.max(Math.tan(settings.wedgeAngle * Math.PI / 180 / 60), 1e-7));
    heroTitle = '条纹间距';
    heroValue = fmt(dx * 1000);
    heroUnit = 'mm';
    heroNote = '楔角越小，膜厚变化越慢，条纹越稀疏。';
    trend = 'α ↓ 或 λ ↑ => 条纹变疏';
    primary = (
      <>
        <Readout label="楔角 α" value={settings.wedgeAngle.toFixed(1)} unit="′" />
        <Readout label="波长 λ" value={settings.wavelength} unit="nm" />
        <Readout label="条纹间距 Δx" value={fmt(dx * 1000)} unit="mm" hi />
        <Readout label="折射率 n" value={settings.filmN.toFixed(2)} unit="" />
      </>
    );
    formula = (
      <FormulaBlock>
        <span className="step"><span className="lhs">Δx</span><span className="eq">=</span><span className="rhs">λ / (2n tan α)</span></span>
        <span className="step"><span className="lhs">Δx</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(dx * 1000)} mm</span></span></span>
      </FormulaBlock>
    );
  } else {
    heroTitle = '典型膜厚';
    heroValue = fmt(settings.thickness, 0);
    heroUnit = 'nm';
    heroNote = '膜厚沿高度变化，不同波长在不同位置增强。';
    trend = '膜厚变化 => 不同颜色位置发生迁移';
    primary = (
      <>
        <Readout label="薄膜厚度 t" value={settings.thickness} unit="nm" hi />
        <Readout label="折射率 n" value={settings.filmN.toFixed(2)} unit="" />
        <Readout label="有效光程 2nt" value={fmt(2 * settings.filmN * settings.thickness, 0)} unit="nm" />
      </>
    );
    formula = (
      <FormulaBlock>
        <span className="step"><span className="lhs">2nt + λ / 2</span><span className="eq">=</span><span className="rhs">kλ（亮）</span></span>
        <span className="step"><span className="lhs">2nt + λ / 2</span><span className="eq">=</span><span className="rhs">(k + 1/2)λ（暗）</span></span>
        <span className="step">白光下，不同 λ 在不同膜厚位置满足增强条件。</span>
      </FormulaBlock>
    );
  }

  return (
    <>
      <SectionTitle aside="CORE">教学结论</SectionTitle>
      <div className="film-readout-hero-grid">
        <div className="film-summary-card primary">
          <div className="film-summary-label">{heroTitle}</div>
          <div className="film-summary-value mono">{heroValue} <span>{heroUnit}</span></div>
          <div className="film-summary-note">{heroNote}</div>
        </div>
        <div className="film-summary-card">
          <div className="film-summary-label">变化趋势</div>
          <div className="film-summary-text">{trend}</div>
        </div>
      </div>
      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="readouts">{primary}</div>
      {settings.showFormula && <><SectionTitle aside="FILM">公式</SectionTitle>{formula}</>}
    </>
  );
}

Object.assign(window, { ThinFilmModule, ThinFilmControls, ThinFilmReadouts });

export {};
