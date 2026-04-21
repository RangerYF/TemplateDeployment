import { useHistoryStore } from '@/editor/store/historyStore';
import { COLORS } from '@/styles/colors';

/**
 * Displays a scrollable list of executed commands (undo stack) and
 * undone commands (redo stack, greyed out), with a ▶ marker at the
 * current position.
 *
 * Clicking an undo-stack entry is read-only (display only); Undo/Redo
 * are handled by the TopBar buttons and Ctrl+Z/Y.
 */
export function HistoryPanel() {
  const undoStack = useHistoryStore((s) => s.undoStack);
  const redoStack = useHistoryStore((s) => s.redoStack);

  const isEmpty = undoStack.length === 0 && redoStack.length === 0;

  return (
    <div style={{ marginBottom: '12px' }}>
      <p
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: COLORS.textPrimary,
          margin: '0 0 8px',
        }}
      >
        操作历史
      </p>

      {isEmpty && (
        <p style={{ fontSize: '12px', color: COLORS.textSecondary, margin: 0 }}>
          暂无历史记录
        </p>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          maxHeight: '160px',
          overflowY: 'auto',
        }}
      >
        {/* Undo stack: oldest first → current state at bottom */}
        {undoStack.map((cmd, i) => {
          const isCurrent = i === undoStack.length - 1;
          return (
            <div
              key={`u-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 6px',
                borderRadius: '4px',
                background: isCurrent ? COLORS.surface : 'transparent',
                border: isCurrent ? `1px solid ${COLORS.border}` : '1px solid transparent',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  color: COLORS.primary,
                  width: '10px',
                  flexShrink: 0,
                }}
              >
                {isCurrent ? '▶' : ''}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: COLORS.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cmd.label}
              </span>
            </div>
          );
        })}

        {/* Redo stack: greyed out future states (most-recently-undone first) */}
        {[...redoStack].reverse().map((cmd, i) => (
          <div
            key={`r-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 6px',
              borderRadius: '4px',
            }}
          >
            <span style={{ width: '10px', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '12px',
                color: COLORS.neutral,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: 'line-through',
                opacity: 0.6,
              }}
            >
              {cmd.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
