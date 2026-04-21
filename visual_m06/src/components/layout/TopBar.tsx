import { COLORS } from '@/styles/tokens';
import { cn } from '@/lib/utils/cn';
import { useVectorStore, useHistoryStore } from '@/editor';
import { OPERATION_META } from '@/editor/entities/types';
import type { OperationType } from '@/editor/entities/types';
import { Undo2, Redo2 } from 'lucide-react';

// 分组展示（按运算类别）
const OPERATION_GROUPS: { label: string; ops: OperationType[] }[] = [
  {
    label: '基础概念',
    ops: ['concept', 'coordinate'],
  },
  {
    label: '基本运算',
    ops: ['parallelogram', 'triangle', 'subtraction', 'scalar'],
  },
  {
    label: '数量积',
    ops: ['dotProduct'],
  },
  {
    label: '分解',
    ops: ['decomposition'],
  },
  {
    label: '空间向量',
    ops: ['space3D', 'crossProduct', 'geometry3D'],
  },
  {
    label: '演示台',
    ops: ['demoStage'],
  },
];

export function TopBar() {
  const operation = useVectorStore((s) => s.operation);
  const setOperation = useVectorStore((s) => s.setOperation);
  const { canUndo, canRedo, undo, redo } = useHistoryStore();

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b overflow-x-auto shrink-0"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg, minHeight: 52 }}
    >
      {/* 左侧：运算类型分组 */}
      <div className="flex items-center gap-2 flex-1">
        {OPERATION_GROUPS.map((group, gi) => (
          <div key={group.label} className="flex items-center">
            {gi > 0 && (
              <div
                className="mx-2 self-stretch"
                style={{ width: 1, backgroundColor: COLORS.border, minHeight: 24 }}
              />
            )}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ backgroundColor: COLORS.bgMuted }}
            >
              <span
                className="mr-1.5 whitespace-nowrap"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.textSecondary,
                  letterSpacing: '0.05em',
                }}
              >
                {group.label}
              </span>
              {group.ops.map((op) => {
                const meta = OPERATION_META[op];
                const isActive = operation === op;
                return (
                  <button
                    key={op}
                    onClick={() => setOperation(op)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-all duration-150',
                      'hover:opacity-80',
                    )}
                    style={{
                      backgroundColor: isActive ? COLORS.primary : 'transparent',
                      color: isActive ? COLORS.white : COLORS.textSecondary,
                      fontSize: 14,
                    }}
                    title={meta.description}
                  >
                    {meta.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 右侧：撤销/重做 */}
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150"
          style={{
            color: canUndo ? COLORS.textSecondary : COLORS.textTertiary,
            backgroundColor: 'transparent',
            cursor: canUndo ? 'pointer' : 'not-allowed',
          }}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150"
          style={{
            color: canRedo ? COLORS.textSecondary : COLORS.textTertiary,
            backgroundColor: 'transparent',
            cursor: canRedo ? 'pointer' : 'not-allowed',
          }}
          title="重做 (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>
      </div>
    </div>
  );
}
