/**
 * 显示模式面板 — 切换渲染模式和标注选项
 */

import { useUIStore, is2DMode, type DisplayMode } from '@/store/uiStore';
import { useMoleculeStore } from '@/store/moleculeStore';
import { PanelSection } from './PanelSection';
import { COLORS } from '@/styles/tokens';
import { MOLECULE_MAP } from '@/data/moleculeMetadata';

const MODE_3D: { value: DisplayMode; label: string; desc: string }[] = [
  { value: 'ball-and-stick', label: '球棍模型', desc: '原子球体 + 化学键圆柱' },
  { value: 'space-filling', label: '空间填充', desc: '按范德华半径显示' },
  { value: 'electron-cloud', label: '成键电子云', desc: 'σ/π 电子云椭球覆盖' },
];

const MODE_2D: { value: DisplayMode; label: string; desc: string }[] = [
  { value: 'structural', label: '结构简式', desc: '2D 平面结构简式' },
  { value: 'electron-formula', label: '电子式', desc: '共用/孤电子对标注' },
  { value: 'skeletal', label: '键线式', desc: '碳骨架折线表示' },
];

export function DisplayModePanel() {
  const displayMode = useUIStore(s => s.displayMode);
  const setDisplayMode = useUIStore(s => s.setDisplayMode);
  const showLabels = useUIStore(s => s.showLabels);
  const showBondLengths = useUIStore(s => s.showBondLengths);
  const showLonePairs = useUIStore(s => s.showLonePairs);
  const autoRotate = useUIStore(s => s.autoRotate);
  const toggleLabels = useUIStore(s => s.toggleLabels);
  const toggleBondLengths = useUIStore(s => s.toggleBondLengths);
  const toggleLonePairs = useUIStore(s => s.toggleLonePairs);
  const toggleAutoRotate = useUIStore(s => s.toggleAutoRotate);
  const currentModel = useMoleculeStore(s => s.currentModel);
  const currentMolecule = useMoleculeStore(s => s.currentMolecule);

  const in2D = is2DMode(displayMode);

  // 碳原子数 < 4 时不显示键线式
  const carbonCount = currentModel?.atoms.filter(a => a.element === 'C').length ?? 0;

  // 检查当前分子是否需要跳过电子式
  const currentMoleculeId = currentMolecule?.id;
  const meta = currentMoleculeId ? MOLECULE_MAP.get(currentMoleculeId) : null;
  const skipElectronFormula = meta?.skipElectronFormula ?? false;

  // 根据条件过滤可用的2D模式
  let available2D = [...MODE_2D];
  if (carbonCount < 4) {
    available2D = available2D.filter(m => m.value !== 'skeletal');
  }
  if (skipElectronFormula) {
    available2D = available2D.filter(m => m.value !== 'electron-formula');
  }

  return (
    <PanelSection id="display" title="显示设置">
      <div className="space-y-3">
        {/* 3D 模型 */}
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: COLORS.text }}>3D 模型</div>
          <div className="flex gap-1.5">
            {MODE_3D.map(mode => (
              <ModeButton key={mode.value} mode={mode} active={displayMode === mode.value} onClick={() => setDisplayMode(mode.value)} />
            ))}
          </div>
        </div>

        {/* 2D 化学式 */}
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: COLORS.text }}>2D 化学式</div>
          <div className="flex gap-1.5">
            {available2D.map(mode => (
              <ModeButton key={mode.value} mode={mode} active={displayMode === mode.value} onClick={() => setDisplayMode(mode.value)} />
            ))}
          </div>
        </div>

        {/* 标注选项 — 2D 下隐藏部分 */}
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: COLORS.text }}>标注与覆盖</div>
          <div className="space-y-1.5">
            <ToggleRow label="原子标签" checked={showLabels} onChange={toggleLabels} />
            <ToggleRow label="键长标注" checked={showBondLengths} onChange={toggleBondLengths} />
            {!in2D && <ToggleRow label="孤电子对" checked={showLonePairs} onChange={toggleLonePairs} />}
            {!in2D && <ToggleRow label="自动旋转" checked={autoRotate} onChange={toggleAutoRotate} />}
          </div>
        </div>

        {/* 操作提示 */}
        <div className="text-xs pt-2" style={{
          color: COLORS.textMuted,
          borderTop: `1px solid ${COLORS.border}`,
        }}>
          <p>点选 2 个原子 → 显示键长</p>
          <p>点选 3 个原子 → 显示键角</p>
          <p>双击原子/键 → 详细信息弹窗</p>
          <p>点击空白处 → 清除选择</p>
        </div>
      </div>
    </PanelSection>
  );
}

function ModeButton({ mode, active, onClick }: {
  mode: { value: DisplayMode; label: string; desc: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex-1 py-2 px-1 text-xs font-medium rounded-lg transition-colors"
      style={{
        background: active ? COLORS.primary : COLORS.bgMuted,
        color: active ? COLORS.white : COLORS.textSecondary,
        border: active
          ? `1px solid ${COLORS.primary}`
          : `1px solid ${COLORS.border}`,
      }}
      onClick={onClick}
      title={mode.desc}
    >
      {mode.label}
    </button>
  );
}

function ToggleRow({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between cursor-pointer py-0.5"
      onClick={onChange}
    >
      <span className="text-xs" style={{ color: COLORS.textSecondary }}>{label}</span>
      <div
        className="relative w-8 h-4 rounded-full transition-colors"
        style={{
          background: checked ? COLORS.primary : COLORS.bgActive,
        }}
      >
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm"
          style={{
            transform: checked ? 'translateX(16px)' : 'translateX(2px)',
          }}
        />
      </div>
    </div>
  );
}
