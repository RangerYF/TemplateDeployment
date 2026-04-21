// Module 2: Thin-lens imaging — convex / concave
const React = (window as any).React;

type LensKind = 'convex' | 'concave';
interface LensSettings {
  experimentId: 'opt-011' | 'opt-012';
  lensType: LensKind;
  focalLength: number;
  objectDistance: number;
  objectHeight: number;
  showRays: boolean;
  showFormula: boolean;
  rayThick: number;
}
interface Point { x: number; y: number; }

const LENS_TYPES: { value: LensKind; label: string }[] = [
  { value: 'convex',  label: '凸透镜（会聚）' },
  { value: 'concave', label: '凹透镜（发散）' },
];

interface RaySpec {
  key: string;
  from: Point;
  via: Point;
  to: Point;
  color: string;
}

function LensModule({ settings }: { settings: LensSettings }) {
  const { lensType, focalLength, objectDistance, objectHeight, showRays, rayThick } = settings;
  const VW = 800, VH = 520;
  const cx = VW * 0.5, cy = VH * 0.5;
  const f = lensType === 'concave' ? -Math.abs(focalLength) : Math.abs(focalLength);
  const u = objectDistance;
  const h = objectHeight;
  const parallelCase = lensType === 'convex' && Math.abs(u - Math.abs(f)) < 1e-6;
  const v = parallelCase ? Infinity : 1 / (1 / f - 1 / u);
  const m = parallelCase ? Infinity : -v / u;
  const hImage = Number.isFinite(m) ? m * h : 0;
  const realImage = Number.isFinite(v) && v > 0;

  const axisY = cy;
  const lensX = cx;
  const objX = cx - u;
  const objTopY = axisY - h;
  const imgX = cx + v;
  const imgTopY = axisY - hImage;

  const Fright = cx + f;
  const Fleft  = cx - f;

  const extend = (x1: number, y1: number, x2: number, y2: number, toX: number): Point => {
    if (x2 === x1) return { x: x2, y: y2 };
    const t = (toX - x1) / (x2 - x1);
    return { x: toX, y: y1 + t * (y2 - y1) };
  };

  const rays: RaySpec[] = [];
  if (showRays) {
    const hitLens1: Point = { x: lensX, y: objTopY };
    let dir1End: Point;
    if (lensType === 'convex') {
      dir1End = extend(hitLens1.x, hitLens1.y, Fright, axisY, lensX + 280);
    } else {
      const Fvirt: Point = { x: lensX - Math.abs(f), y: axisY };
      const dx = hitLens1.x - Fvirt.x, dy = hitLens1.y - Fvirt.y;
      dir1End = { x: hitLens1.x + dx * 2, y: hitLens1.y + dy * 2 };
    }
    rays.push({ key: 'r1', from: { x: objX, y: objTopY }, via: hitLens1, to: dir1End, color: 'oklch(0.55 0.17 30)' });

    const endX2 = lensX + 280;
    const pEnd2 = extend(objX, objTopY, lensX, axisY, endX2);
    rays.push({ key: 'r2', from: { x: objX, y: objTopY }, via: { x: lensX, y: axisY }, to: pEnd2, color: 'oklch(0.55 0.17 145)' });

    if (lensType === 'convex') {
      const p1 = extend(objX, objTopY, Fleft, axisY, lensX);
      rays.push({ key: 'r3', from: { x: objX, y: objTopY }, via: p1, to: { x: lensX + 280, y: p1.y }, color: 'oklch(0.55 0.17 255)' });
    } else {
      const Fr: Point = { x: lensX + Math.abs(f), y: axisY };
      const p1 = extend(objX, objTopY, Fr.x, Fr.y, lensX);
      rays.push({ key: 'r3', from: { x: objX, y: objTopY }, via: p1, to: { x: lensX + 280, y: p1.y }, color: 'oklch(0.55 0.17 255)' });
    }
  }

  const virtualImage = Number.isFinite(v) && !realImage;

  const GridBg = (window as any).GridBg || (({ w, h }: { w: number; h: number }) => <g />);

  return (
    <>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <LensGrid w={VW} h={VH} />
        <line className="axis" x1={40} y1={axisY} x2={VW - 40} y2={axisY} strokeDasharray="2 4" />
        <text className="label-txt dim" x={VW - 40} y={axisY - 6} textAnchor="end">主光轴</text>

        <LensShape type={lensType} x={lensX} y={axisY} height={180} />

        <FocalMark x={Fleft} y={axisY} label="F" />
        <FocalMark x={Fright} y={axisY} label="F′" />
        <FocalMark x={cx - 2*Math.abs(f)} y={axisY} label="2F" dim />
        <FocalMark x={cx + 2*Math.abs(f)} y={axisY} label="2F′" dim />

        <ObjectArrow x={objX} y={axisY} h={h} label={`h = ${h} cm`} />

        {Number.isFinite(v) && (
          <ObjectArrow x={imgX} y={axisY} h={hImage}
            label={`h' = ${hImage.toFixed(1)} cm`}
            virtual={virtualImage}
            color={virtualImage ? 'var(--ink-3)' : 'var(--accent)'} />
        )}

        {rays.map(r => (
          <g key={r.key}>
            <line x1={r.from.x} y1={r.from.y} x2={r.via.x} y2={r.via.y}
              className="ray" stroke={r.color} strokeWidth={rayThick} />
            <line x1={r.via.x} y1={r.via.y} x2={r.to.x} y2={r.to.y}
              className="ray" stroke={r.color} strokeWidth={rayThick} />
            {virtualImage && (
              <line x1={r.via.x} y1={r.via.y}
                x2={r.via.x - (r.to.x - r.via.x)} y2={r.via.y - (r.to.y - r.via.y)}
                className="ray" stroke={r.color} strokeWidth={rayThick}
                strokeDasharray="4 4" opacity="0.6" />
            )}
          </g>
        ))}

        <DistanceBracket x1={objX} x2={lensX} y={axisY + 80} label={`u = ${u} cm`} />
        {Number.isFinite(v) && (
          <DistanceBracket x1={lensX} x2={imgX} y={axisY + 110}
            label={`v = ${v.toFixed(1)} cm ${virtualImage ? '(虚)' : ''}`} />
        )}
      </svg>

      <div className="legend">
        <div className="legend-title">三条特殊光线</div>
        <div className="legend-row"><span className="swatch" style={{ background: 'oklch(0.55 0.17 30)' }} /><span className="label">平行于主轴的光</span></div>
        <div className="legend-row"><span className="swatch" style={{ background: 'oklch(0.55 0.17 145)' }} /><span className="label">过光心的光</span></div>
        <div className="legend-row"><span className="swatch" style={{ background: 'oklch(0.55 0.17 255)' }} /><span className="label">过焦点的光</span></div>
      </div>

      <div className="placard">
        <div className="name">{lensType === 'convex' ? '凸透镜（会聚透镜）' : '凹透镜（发散透镜）'}</div>
        <div className="desc">
          {parallelCase
            ? '物体位于焦点上，出射光近似平行，不形成有限远的像。'
            : lensType === 'convex'
            ? (realImage ? '实像：倒立、位于透镜另一侧，能被屏接收' : '虚像：正立、与物体同侧，放大')
            : '凹透镜对实物永远成缩小的正立虚像'}
        </div>
      </div>

      <div className="hud">
        <span className="chip"><span className="dot" />焦距 f = {f.toFixed(0)} cm</span>
        <span className="chip"><span className="dot" />物距 u = {u} cm</span>
        <span className="chip"><span className="dot" />像距 v = {Number.isFinite(v) ? v.toFixed(1) : '∞'} cm</span>
        <span className={`chip ${parallelCase || virtualImage ? 'warn' : 'ok'}`}>
          <span className="dot" />{parallelCase ? '不成像' : virtualImage ? '虚像' : '实像'} · 放大率 {Number.isFinite(m) ? `|m| = ${Math.abs(m).toFixed(2)}` : '→ ∞'}
        </span>
      </div>
    </>
  );
}

function LensGrid({ w, h, step = 20 }: { w: number; h: number; step?: number }) {
  const lines: any[] = [];
  for (let x = 0; x <= w; x += step) lines.push(<line key={'vx'+x} className={`grid-line${x % 100 === 0 ? ' strong' : ''}`} x1={x} y1={0} x2={x} y2={h} />);
  for (let y = 0; y <= h; y += step) lines.push(<line key={'hy'+y} className={`grid-line${y % 100 === 0 ? ' strong' : ''}`} x1={0} y1={y} x2={w} y2={y} />);
  return <g>{lines}</g>;
}

function LensShape({ type, x, y, height }: { type: LensKind; x: number; y: number; height: number }) {
  if (type === 'convex') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <path className="glass"
          d={`M 0 ${-height/2} Q 16 0 0 ${height/2} Q -16 0 0 ${-height/2} Z`} />
        <line className="axis" x1={0} y1={-height/2 - 10} x2={0} y2={height/2 + 10} strokeDasharray="2 2" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path className="glass"
        d={`M -7 ${-height/2} L 7 ${-height/2} Q -3 0 7 ${height/2} L -7 ${height/2} Q 3 0 -7 ${-height/2} Z`} />
    </g>
  );
}

function FocalMark({ x, y, label, dim }: { x: number; y: number; label: string; dim?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={3} fill={dim ? 'var(--ink-3)' : 'var(--accent)'} />
      <text className={`label-txt ${dim ? 'dim' : ''}`} y={16} textAnchor="middle">{label}</text>
    </g>
  );
}

interface ObjectArrowProps { x: number; y: number; h: number; label: string; virtual?: boolean; color?: string; }
function ObjectArrow({ x, y, h, label, virtual, color }: ObjectArrowProps) {
  const tipY = y - h;
  const col = color || 'oklch(0.45 0.18 25)';
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={tipY}
        stroke={col} strokeWidth="2.5"
        strokeDasharray={virtual ? '4 4' : undefined} />
      <polygon
        points={h >= 0
          ? `${x-4},${tipY+6} ${x+4},${tipY+6} ${x},${tipY-2}`
          : `${x-4},${tipY-6} ${x+4},${tipY-6} ${x},${tipY+2}`}
        fill={col} opacity={virtual ? 0.7 : 1} />
      <text className="label-txt" x={x + 8} y={tipY + (h >= 0 ? 0 : 12)}
        fill={virtual ? 'var(--ink-3)' : 'var(--ink)'}>{label}</text>
    </g>
  );
}

function DistanceBracket({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y-4} x2={x1} y2={y+4} stroke="var(--ink-3)" />
      <line x1={x2} y1={y-4} x2={x2} y2={y+4} stroke="var(--ink-3)" />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="var(--ink-3)" strokeDasharray="2 3" />
      <text className="label-txt dim" x={mid} y={y + 14} textAnchor="middle">{label}</text>
    </g>
  );
}

function LensControls({ settings, setSettings }: { settings: LensSettings; setSettings: (s: LensSettings) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const getParamSpec = (key: string): ExperimentParamSpec | undefined => (window as any).getP03ParamSpec('lens', settings.experimentId, key);
  return (
    <>
      <SectionTitle aside="LENS">透镜类型</SectionTitle>
      <div className="seg vertical">
        {LENS_TYPES.map(t => (
          <button key={t.value}
            className={settings.lensType === t.value ? 'seg-item active' : 'seg-item'}
            onClick={() => setSettings({ ...settings, lensType: t.value, experimentId: t.value === 'convex' ? 'opt-011' : 'opt-012' })}
          >{t.label}</button>
        ))}
      </div>

      <SectionTitle aside="PARAMS">参数调节</SectionTitle>
      <Slider label="焦距 f" value={settings.focalLength}
        onChange={(v: number) => setSettings({ ...settings, focalLength: v })}
        min={getParamSpec('focalLength')?.min ?? 2} max={getParamSpec('focalLength')?.max ?? 30} step={getParamSpec('focalLength')?.step ?? 1} unit="cm" />
      <Slider label="物距 u" value={settings.objectDistance}
        onChange={(v: number) => setSettings({ ...settings, objectDistance: v })}
        min={getParamSpec('objectDistance')?.min ?? 1} max={getParamSpec('objectDistance')?.max ?? 100} step={getParamSpec('objectDistance')?.step ?? 1} unit="cm"
        hint={Math.abs(settings.objectDistance - Math.abs(settings.focalLength)) < 1e-6
          ? '当前 u = f：不成像，出射光近似平行'
          : settings.objectDistance < Math.abs(settings.focalLength)
            ? '当前 u < f：虚像放大'
            : (settings.objectDistance < 2 * Math.abs(settings.focalLength) ? '当前 f < u < 2f：实像放大' : '当前 u > 2f：实像缩小')} />
      <Slider label="物高 h" value={settings.objectHeight}
        onChange={(v: number) => setSettings({ ...settings, objectHeight: v })}
        min={20} max={80} step={1} unit="cm" />

      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>
      <Toggle label="三条特殊光线" checked={settings.showRays}
        onChange={(v: boolean) => setSettings({ ...settings, showRays: v })} />
      <Toggle label="公式验证" checked={settings.showFormula}
        onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />
    </>
  );
}

function LensReadouts({ settings }: { settings: LensSettings }) {
  const f = settings.lensType === 'concave' ? -Math.abs(settings.focalLength) : Math.abs(settings.focalLength);
  const u = settings.objectDistance;
  const parallelCase = settings.lensType === 'convex' && Math.abs(u - Math.abs(f)) < 1e-6;
  const v = parallelCase ? Infinity : 1 / (1 / f - 1 / u);
  const m = parallelCase ? Infinity : -v / u;
  const virtual = Number.isFinite(v) && !(v > 0);
  const SectionTitle = (window as any).SectionTitle;
  const Readout = (window as any).Readout;
  const FormulaBlock = (window as any).FormulaBlock;
  return (
    <>
      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="readouts">
        <Readout label="焦距 f" value={f} unit="cm" />
        <Readout label="物距 u" value={u} unit="cm" />
        <Readout label="像距 v" value={Number.isFinite(v) ? v.toFixed(1) : '∞'} unit="cm" hi />
        <Readout label="放大率 m" value={Number.isFinite(m) ? m.toFixed(2) : '∞'} unit="×" />
        <Readout label="像的性质" value={parallelCase ? '不成像·平行光' : (virtual ? '虚像·正立' : (m < 0 ? '实像·倒立' : '实像·正立'))} unit="" />
      </div>
      {settings.showFormula && (
        <>
          <SectionTitle aside="LENS EQN">公式验证</SectionTitle>
          <FormulaBlock>
            <span className="step"><span className="lhs">1/u + 1/v</span><span className="eq">=</span><span className="rhs">1/f</span></span>
            <span className="step mono"> 1/{u} + 1/v = 1/{f}</span>
            {parallelCase ? (
              <>
                <span className="step mono"> 因为 u = f，所以 1/v = 0</span>
                <span className="step"><span className="lhs">v</span><span className="eq">=</span><span className="rhs"><span className="hi">∞</span></span></span>
                <span className="step">出射光近似平行，因此不形成有限远的像。</span>
              </>
            ) : (
              <>
                <span className="step mono"> 1/v = 1/{f} − 1/{u}</span>
                <span className="step mono"> 1/v = {(1 / f).toFixed(4)} − {(1 / u).toFixed(4)}</span>
                <span className="step"><span className="lhs">v</span><span className="eq">=</span><span className="rhs"><span className="hi">{Number.isFinite(v) ? v.toFixed(2) + ' cm' : '∞'}</span></span></span>
                <span className="step"><span className="lhs">m = −v/u</span><span className="eq">=</span><span className="rhs"><span className="hi">{Number.isFinite(m) ? m.toFixed(3) : '—'}</span></span></span>
              </>
            )}
          </FormulaBlock>
        </>
      )}
    </>
  );
}

Object.assign(window, { LensModule, LensControls, LensReadouts, LENS_TYPES });

export {};
