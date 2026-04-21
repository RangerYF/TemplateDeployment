import { COLORS, SHADOWS } from '@/styles/tokens';
import { useVectorStore, useHistoryStore } from '@/editor';
import { LoadPresetCommand } from '@/editor/commands/updateVector';
import { getPresetsByOperation } from '@/data/presets';
import type { PresetData } from '@/editor/entities/types';
import { cn } from '@/lib/utils/cn';
import { BookOpen } from 'lucide-react';

export function ScenarioPanel() {
  const operation = useVectorStore((s) => s.operation);
  const activePresetId = useVectorStore((s) => s.activePresetId);
  const loadPreset = useVectorStore((s) => s.loadPreset);
  const getSnapshot = useVectorStore((s) => s.getSnapshot);
  const loadSnapshot = useVectorStore((s) => s.loadSnapshot);
  const { execute } = useHistoryStore();

  const presets = getPresetsByOperation(operation);

  const handleLoadPreset = (preset: PresetData) => {
    const before = getSnapshot();
    const cmd = new LoadPresetCommand(
      `加载预设 ${preset.name}`,
      () => loadPreset(preset),
      () => loadSnapshot(before),
    );
    execute(cmd);
  };

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        maxWidth: 220,
        backgroundColor: COLORS.bg,
        borderRight: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 标题 */}
      <div
        className="flex items-center gap-2 px-3 py-3"
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.bgMuted,
        }}
      >
        <BookOpen size={14} style={{ color: COLORS.primary }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, letterSpacing: '0.03em' }}>
          场景库
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 14,
            color: COLORS.textMuted,
            background: COLORS.bgActive,
            borderRadius: 10,
            padding: '1px 6px',
          }}
        >
          {presets.length}
        </span>
      </div>

      {/* 预设列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {presets.length === 0 ? (
          <div className="px-3 py-4 text-center" style={{ fontSize: 14, color: COLORS.textMuted }}>
            暂无预设场景
          </div>
        ) : (
          presets.map((preset) => {
            const isActive = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset)}
                className={cn(
                  'w-full text-left px-3 py-2.5 transition-all duration-150',
                  'border-l-2 mb-0.5',
                )}
                style={{
                  backgroundColor: isActive ? COLORS.primaryLight : 'transparent',
                  borderLeftColor: isActive ? COLORS.primary : 'transparent',
                  boxShadow: isActive ? SHADOWS.sm : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = COLORS.bgHover;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* ID 标签 */}
                <div
                  style={{
                    fontSize: 14,
                    color: isActive ? COLORS.primary : COLORS.textMuted,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    marginBottom: 2,
                  }}
                >
                  {preset.id}
                </div>

                {/* 名称 */}
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? COLORS.text : COLORS.textSecondary,
                    lineHeight: 1.4,
                  }}
                >
                  {preset.name}
                </div>

                {/* 教学要点（折叠显示） */}
                {isActive && (
                  <div
                    style={{
                      fontSize: 14,
                      color: COLORS.textMuted,
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {preset.teachingPoint}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* 底部提示 */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: `1px solid ${COLORS.border}`,
          fontSize: 14,
          color: COLORS.textMuted,
          lineHeight: 1.5,
        }}
      >
        点击场景可加载预设向量组
      </div>
    </aside>
  );
}
