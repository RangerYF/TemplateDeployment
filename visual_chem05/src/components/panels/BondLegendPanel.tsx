import { COLORS, RADIUS } from '@/styles/tokens';
import { BOND_COLORS } from '@/engine/types';
import type { BondType } from '@/engine/types';

const BOND_TYPE_ORDER: BondType[] = [
  'ionic',
  'covalent-sigma',
  'covalent-pi',
  'metallic',
  'hydrogen',
  'vanDerWaals',
];

const BOND_GRADE: Record<string, string> = {
  'ionic': '高中必修',
  'covalent-sigma': '高中必修',
  'covalent-pi': '高中选修',
  'metallic': '高中必修',
  'hydrogen': '高中选修',
  'vanDerWaals': '高中选修',
};

const H_BOND_ENERGIES = [
  { label: 'O-H···O', energy: '~20 kJ/mol', note: '水, 冰' },
  { label: 'N-H···O', energy: '~8 kJ/mol', note: '' },
  { label: 'N-H···N', energy: '~13 kJ/mol', note: '' },
  { label: 'F-H···F', energy: '~155 kJ/mol', note: '最强氢键' },
];

export function BondLegendPanel() {
  return (
    <div className="space-y-1.5">
      {BOND_TYPE_ORDER.map((bt) => {
        const info = BOND_COLORS[bt];
        return (
          <div key={bt} className="flex items-center gap-2">
            {/* Colored line indicator */}
            <svg width="24" height="8" className="shrink-0">
              {info.dashed ? (
                <line
                  x1="0"
                  y1="4"
                  x2="24"
                  y2="4"
                  stroke={info.color}
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
              ) : (
                <line
                  x1="0"
                  y1="4"
                  x2="24"
                  y2="4"
                  stroke={info.color}
                  strokeWidth="2"
                />
              )}
            </svg>
            {/* Label */}
            <span className="text-xs" style={{ color: COLORS.text }}>
              {info.label}
            </span>
            {/* Grade badge (S-019) */}
            {BOND_GRADE[bt] && (
              <span
                className="text-[9px] px-1 py-px"
                style={{
                  borderRadius: RADIUS.xs,
                  backgroundColor: COLORS.bgMuted,
                  color: COLORS.textMuted,
                }}
              >
                {BOND_GRADE[bt]}
              </span>
            )}
          </div>
        );
      })}

      {/* 氢键能参考 (B-019) */}
      <div className="mt-3">
        <p
          className="text-[10px] font-semibold mb-1"
          style={{ color: COLORS.textSecondary }}
        >
          氢键能参考
        </p>
        <div className="space-y-0.5">
          {H_BOND_ENERGIES.map((item) => (
            <p
              key={item.label}
              className="text-[10px]"
              style={{ color: COLORS.textMuted }}
            >
              {item.label}  {item.energy}
              {item.note && ` (${item.note})`}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
