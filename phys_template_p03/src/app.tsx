// P-03 光学实验台 — App shell (TypeScript)
const React = (window as any).React;
const ReactDOM = (window as any).ReactDOM;

type ModuleId = 'refraction' | 'lens' | 'doubleslit' | 'diffraction' | 'thinfilm';
type ThemeName = 'light' | 'dark' | 'blueprint';
const W = window as any;
const MODULES: ModuleDef[] = W.P03_MODULES;
const DEFAULTS = W.P03_DEFAULTS;

function loadState<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem('p03-' + key);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch (e) {}
  return def;
}
function saveState(key: string, state: unknown): void {
  try { localStorage.setItem('p03-' + key, JSON.stringify(state)); } catch (e) {}
}

const { useState, useEffect } = React;

function App() {
  const [active, setActive] = useState<ModuleId>(
    () => (localStorage.getItem('p03-active') as ModuleId) || 'refraction'
  );
  const [tweaksOpen, setTweaksOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeName>((window as any).__TWEAKS.theme || 'light');
  const [rayThick, setRayThick] = useState<number>((window as any).__TWEAKS.rayThick || 2);

  const [refr, setRefr] = useState<any>(() => loadState('refraction', DEFAULTS.refraction));
  const [lens, setLens] = useState<any>(() => loadState('lens', DEFAULTS.lens));
  const [dbl, setDbl]   = useState<any>(() => loadState('doubleslit', DEFAULTS.doubleslit));
  const [diff, setDiff] = useState<any>(() => loadState('diffraction', DEFAULTS.diffraction));
  const [film, setFilm] = useState<any>(() => loadState('thinfilm', DEFAULTS.thinfilm));

  useEffect(() => (window as any).applyTheme(theme), [theme]);
  useEffect(() => localStorage.setItem('p03-active', active), [active]);
  useEffect(() => saveState('refraction', refr), [refr]);
  useEffect(() => saveState('lens', lens), [lens]);
  useEffect(() => saveState('doubleslit', dbl), [dbl]);
  useEffect(() => saveState('diffraction', diff), [diff]);
  useEffect(() => saveState('thinfilm', film), [film]);

  useEffect(() => {
    function handler(e: MessageEvent): void {
      const d = (e.data || {}) as { type?: string };
      if (d.type === '__activate_edit_mode') setTweaksOpen(true);
      if (d.type === '__deactivate_edit_mode') setTweaksOpen(false);
    }
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const persistTweak = (edits: Record<string, unknown>): void => {
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
  };

  const refrFinal = { ...refr, rayThick };
  const lensFinal = { ...lens, rayThick };
  const mod = MODULES.find(m => m.id === active)!;
  const activeSettings = active === 'refraction' ? refr : active === 'lens' ? lens : active === 'doubleslit' ? dbl : active === 'diffraction' ? diff : film;
  const experimentMeta = W.getP03Experiment(active, activeSettings.experimentId);
  const experimentLabel = experimentMeta?.title || '';

  let StageMod: any, Ctrls: any, Reads: any;
  if (active === 'refraction')  { StageMod = <W.RefractionModule settings={refrFinal} />;  Ctrls = <W.RefractionControls settings={refr} setSettings={setRefr} />; Reads = <W.RefractionReadouts settings={refr} />; }
  if (active === 'lens')        { StageMod = <W.LensModule settings={lensFinal} />;         Ctrls = <W.LensControls settings={lens} setSettings={setLens} />;         Reads = <W.LensReadouts settings={lens} />; }
  if (active === 'doubleslit')  { StageMod = <W.DoubleSlitModule settings={dbl} />;         Ctrls = <W.DoubleSlitControls settings={dbl} setSettings={setDbl} />;     Reads = <W.DoubleSlitReadouts settings={dbl} />; }
  if (active === 'diffraction') { StageMod = <W.DiffractionModule settings={diff} />;       Ctrls = <W.DiffractionControls settings={diff} setSettings={setDiff} />;  Reads = <W.DiffractionReadouts settings={diff} />; }
  if (active === 'thinfilm')    { StageMod = <W.ThinFilmModule settings={film} />;          Ctrls = <W.ThinFilmControls settings={film} setSettings={setFilm} />;     Reads = <W.ThinFilmReadouts settings={film} />; }

  const SectionTitle = W.SectionTitle;
  const SegSelect = W.SegSelect;
  const Slider = W.Slider;

  return (
    <div className="app" data-screen-label={`${mod.num} ${mod.short}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">P03</div>
          <div className="brand-name">
            光学实验台
            <small>OPTICS LAB / INTERACTIVE</small>
          </div>
        </div>
        <nav className="modules">
          {MODULES.map(m => (
            <button key={m.id}
              className={active === m.id ? 'module-btn active' : 'module-btn'}
              onClick={() => setActive(m.id)}
              title={m.desc}
            >
              <span className="mod-num">{m.num}</span>
              <span>{m.short}</span>
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="topbar-meta">教学演示器</span>
          <span className="topbar-pill">{experimentLabel || mod.full}</span>
        </div>
      </header>

      <div className="main">
        <aside className="panel-left">
          <div className="side-card side-card-primary">{Ctrls}</div>
        </aside>

        <section className="stage">
          <div className="stage-toolbar">
            <span className="crumbs">{mod.num}</span>
            <span className="title">{mod.full}</span>
            <span className="crumbs" style={{ marginLeft: 8, color: 'var(--ink-3)' }}>· {mod.desc}</span>
            <span className="crumbs" style={{ marginLeft: 8, color: 'var(--accent-strong)' }}>{experimentLabel}</span>
          </div>
          <div className="stage-canvas">{StageMod}</div>
        </section>

        <aside className="panel-right">
          <div className="side-card side-card-primary">
            {Reads}
          </div>
          {experimentMeta && (
            <div className="side-card side-card-muted">
              <ExperimentInfoCard experiment={experimentMeta} />
            </div>
          )}
        </aside>
      </div>

      <div className={tweaksOpen ? 'tweaks open' : 'tweaks'}>
        <div className="tweaks-head">
          <span>Tweaks</span>
          <button className="close" onClick={() => setTweaksOpen(false)}>×</button>
        </div>
        <div className="tweaks-body">
          <SectionTitle aside="THEME">视觉风格</SectionTitle>
          <SegSelect
            value={theme}
            onChange={(v: ThemeName) => { setTheme(v); persistTweak({ theme: v }); }}
            options={[
              { value: 'light', label: '白绿' },
              { value: 'blueprint', label: '薄荷' },
              { value: 'dark', label: '暗色' },
            ]}
          />
          <SectionTitle aside="RAY">光线粗细</SectionTitle>
          <Slider label="线宽" value={rayThick}
            onChange={(v: number) => { setRayThick(v); persistTweak({ rayThick: v }); }}
            min={1} max={4} step={0.1} unit="px" />
        </div>
      </div>
    </div>
  );
}

function ExperimentInfoCard({ experiment }: { experiment: ExperimentSpec }) {
  const W = window as any;
  const SectionTitle = W.SectionTitle;
  const FormulaBlock = W.FormulaBlock;
  return (
    <>
      <SectionTitle aside="EXPERIMENT">实验摘要</SectionTitle>
      <div className="formula">
        <span className="step">{experiment.summary}</span>
      </div>
      <SectionTitle aside="FORMULAS">关键公式</SectionTitle>
      <FormulaBlock>
        {experiment.formulas.map((line, index) => (
          <span key={index} className="step">{line}</span>
        ))}
      </FormulaBlock>
      <SectionTitle aside="TEACH">教学要点</SectionTitle>
      <div className="formula">
        {experiment.teachingPoints.map((item, index) => (
          <span key={index} className="step">- {item}</span>
        ))}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

export {};
