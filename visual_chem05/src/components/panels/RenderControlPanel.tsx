import { COLORS, RADIUS } from '@/styles/tokens';
import { useCrystalStore } from '@/store';
import { BOND_COLORS } from '@/engine/types';
import type { RenderMode, BondType } from '@/engine/types';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RENDER_MODES: { mode: RenderMode; label: string }[] = [
  { mode: 'ballAndStick', label: '球棍' },
  { mode: 'spaceFilling', label: '填充' },
  { mode: 'polyhedral', label: '多面体' },
  { mode: 'wireframe', label: '线框' },
];

const BOND_TYPE_ENTRIES: { type: BondType; label: string; color: string }[] = [
  { type: 'ionic', label: '离子键', color: BOND_COLORS.ionic.color },
  { type: 'covalent-sigma', label: '\u03C3共价键', color: BOND_COLORS['covalent-sigma'].color },
  { type: 'covalent-pi', label: '\u03C0共价键', color: BOND_COLORS['covalent-pi'].color },
  { type: 'metallic', label: '金属键', color: BOND_COLORS.metallic.color },
  { type: 'hydrogen', label: '氢键', color: BOND_COLORS.hydrogen.color },
  { type: 'vanDerWaals', label: '范德华力', color: BOND_COLORS.vanDerWaals.color },
];

// ---------------------------------------------------------------------------
// RenderControlPanel
// ---------------------------------------------------------------------------

export function RenderControlPanel() {
  const renderMode = useCrystalStore((s) => s.renderMode);
  const setRenderMode = useCrystalStore((s) => s.setRenderMode);
  const expansionRange = useCrystalStore((s) => s.expansionRange);
  const setExpansionRange = useCrystalStore((s) => s.setExpansionRange);
  const showUnitCell = useCrystalStore((s) => s.showUnitCell);
  const toggleUnitCell = useCrystalStore((s) => s.toggleUnitCell);
  const showBonds = useCrystalStore((s) => s.showBonds);
  const toggleBonds = useCrystalStore((s) => s.toggleBonds);
  const showLabels = useCrystalStore((s) => s.showLabels);
  const toggleLabels = useCrystalStore((s) => s.toggleLabels);
  const showAxes = useCrystalStore((s) => s.showAxes);
  const toggleAxes = useCrystalStore((s) => s.toggleAxes);
  const visibleBondTypes = useCrystalStore((s) => s.visibleBondTypes);
  const toggleBondType = useCrystalStore((s) => s.toggleBondType);

  const is2x2x2 =
    expansionRange.x[0] === 0 &&
    expansionRange.x[1] === 1 &&
    expansionRange.y[0] === 0 &&
    expansionRange.y[1] === 1 &&
    expansionRange.z[0] === 0 &&
    expansionRange.z[1] === 1;

  const handleExpansionToggle = () => {
    if (is2x2x2) {
      setExpansionRange({ x: [0, 0], y: [0, 0], z: [0, 0] });
    } else {
      setExpansionRange({ x: [0, 1], y: [0, 1], z: [0, 1] });
    }
  };

  return (
    <div className="space-y-3">
      {/* Render mode selector */}
      <div>
        <Label text="渲染模式" />
        <div className="flex gap-1">
          {RENDER_MODES.map((rm) => (
            <button
              key={rm.mode}
              className={cn('flex-1 py-1.5 text-xs font-medium transition-colors')}
              style={{
                borderRadius: RADIUS.xs,
                backgroundColor: renderMode === rm.mode ? COLORS.primary : COLORS.bgMuted,
                color: renderMode === rm.mode ? COLORS.white : COLORS.textSecondary,
              }}
              onClick={() => setRenderMode(rm.mode)}
            >
              {rm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expansion toggle */}
      <div>
        <Label text="晶胞扩展" />
        <button
          className="w-full py-1.5 text-xs font-medium transition-colors"
          style={{
            borderRadius: RADIUS.xs,
            backgroundColor: is2x2x2 ? COLORS.primary : COLORS.bgMuted,
            color: is2x2x2 ? COLORS.white : COLORS.textSecondary,
          }}
          onClick={handleExpansionToggle}
        >
          {is2x2x2 ? '2\u00D72\u00D72' : '1\u00D71\u00D71'}
        </button>
      </div>

      {/* Show/hide toggles */}
      <div>
        <Label text="显示控制" />
        <div className="space-y-1">
          <ToggleRow label="晶胞框架" active={showUnitCell} onToggle={toggleUnitCell} />
          <ToggleRow label="化学键" active={showBonds} onToggle={toggleBonds} />
          <ToggleRow label="原子标签" active={showLabels} onToggle={toggleLabels} />
          <ToggleRow label="坐标轴" active={showAxes} onToggle={toggleAxes} />
        </div>
      </div>

      {/* Bond type filter (only when bonds are shown) */}
      {showBonds && (
        <div>
          <Label text="键类型筛选" />
          <div className="space-y-1">
            {BOND_TYPE_ENTRIES.map((entry) => (
              <BondTypeCheckbox
                key={entry.type}
                label={entry.label}
                color={entry.color}
                checked={visibleBondTypes.has(entry.type)}
                onChange={() => toggleBondType(entry.type)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function Label({ text }: { text: string }) {
  return (
    <p
      className="text-xs font-semibold mb-1.5"
      style={{ color: COLORS.textSecondary }}
    >
      {text}
    </p>
  );
}

function ToggleRow({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="w-full flex items-center justify-between py-1 px-2 text-xs transition-colors"
      style={{
        borderRadius: RADIUS.xs,
        backgroundColor: active ? COLORS.primaryLight : 'transparent',
      }}
      onClick={onToggle}
    >
      <span style={{ color: COLORS.text }}>{label}</span>
      <span
        className="w-8 h-4 rounded-full relative transition-colors"
        style={{
          backgroundColor: active ? COLORS.primary : COLORS.bgActive,
        }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
          style={{
            backgroundColor: COLORS.white,
            left: active ? '16px' : '2px',
          }}
        />
      </span>
    </button>
  );
}

function BondTypeCheckbox({
  label,
  color,
  checked,
  onChange,
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-2 py-0.5 px-2 text-xs transition-colors"
      style={{ borderRadius: RADIUS.xs }}
      onClick={onChange}
    >
      {/* Color indicator dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{
          backgroundColor: color,
          opacity: checked ? 1 : 0.3,
        }}
      />
      {/* Checkbox */}
      <span
        className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
        style={{
          borderColor: checked ? COLORS.primary : COLORS.border,
          backgroundColor: checked ? COLORS.primary : 'transparent',
        }}
      >
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M1.5 4L3.2 5.7L6.5 2.3"
              stroke="white"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {/* Label */}
      <span style={{ color: checked ? COLORS.text : COLORS.textMuted }}>
        {label}
      </span>
    </button>
  );
}
