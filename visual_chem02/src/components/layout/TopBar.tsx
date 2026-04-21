/**
 * 顶部栏 — 标题 + 分子名 + 快捷操作
 */

import { useMoleculeStore } from '@/store/moleculeStore';
import { COLORS, SHADOWS } from '@/styles/tokens';

export function TopBar() {
  const mol = useMoleculeStore(s => s.currentMolecule);
  const compareMode = useMoleculeStore(s => s.compareMode);

  return (
    <header
      className="flex items-center justify-between px-4 h-12 shrink-0"
      style={{
        background: COLORS.bg,
        borderBottom: `1px solid ${COLORS.border}`,
        boxShadow: SHADOWS.sm,
      }}
    >
      {/* 左侧标题 */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold" style={{ color: COLORS.text }}>
          分子结构查看器
        </h1>
        {mol && (
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>
            {mol.formula} · {mol.name_cn}
          </span>
        )}
        {compareMode && (
          <span
            className="px-2 py-0.5 text-xs rounded-full"
            style={{
              background: COLORS.infoLight,
              color: COLORS.info,
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            对比模式
          </span>
        )}
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: COLORS.textPlaceholder }}>
          C-02 · EduMindAI
        </span>
      </div>
    </header>
  );
}
