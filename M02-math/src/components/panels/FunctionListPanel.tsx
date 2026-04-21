import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useFunctionStore } from '@/editor/store/functionStore';
import { executeM02Command } from '@/editor/commands/m02Execute';
import { RemoveFunctionCommand } from '@/editor/commands/RemoveFunctionCommand';
import { type FunctionEntry } from '@/types';
import { getTemplate, buildReadableExpr } from '@/engine/functionTemplates';
import { COLORS } from '@/styles/colors';
import { dangerHover, rowHover } from '@/styles/interactionStyles';

export function FunctionListPanel() {
  const functions       = useFunctionStore((s) => s.functions);
  const activeFunctionId = useFunctionStore((s) => s.activeFunctionId);
  const setActiveFunctionId = useFunctionStore((s) => s.setActiveFunctionId);
  const updateFunction  = useFunctionStore((s) => s.updateFunction);

  const handleRemove = (e: React.MouseEvent, fn: FunctionEntry) => {
    e.stopPropagation();
    executeM02Command(new RemoveFunctionCommand(fn));
  };

  const handleToggleVisible = (e: React.MouseEvent, fn: FunctionEntry) => {
    e.stopPropagation();
    updateFunction(fn.id, { visible: !fn.visible });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: '8px' }}>
        <span style={{
          fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary,
          letterSpacing: '0.02em',
        }}>
          函数列表
        </span>
      </div>

      {/* Function rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {functions.length === 0 ? (
          <div style={{ padding: '32px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: COLORS.neutral, lineHeight: 1.8 }}>
              暂无函数<br />从顶栏选择模板添加
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {functions.map((fn) => {
              const isActive = fn.id === activeFunctionId;
              return (
                <div
                  key={fn.id}
                  onClick={() => setActiveFunctionId(fn.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: isActive ? COLORS.primaryLight : 'transparent',
                    border: isActive ? `1px solid ${COLORS.primary}33` : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                  {...rowHover(isActive)}
                >
                  {/* Active indicator dot */}
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: isActive ? COLORS.primary : COLORS.borderMuted,
                    flexShrink: 0,
                    transition: 'background 120ms',
                  }} />

                  {/* Label + expression */}
                  <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{
                        fontSize: '12px', fontWeight: isActive ? 600 : 400,
                        color: fn.visible ? COLORS.textPrimary : COLORS.neutral,
                        flexShrink: 0,
                      }}>
                        {fn.label}
                      </span>
                      {fn.templateId && (
                        <span style={{
                          fontSize: '9px',
                          background: `${COLORS.primary}15`,
                          color: COLORS.primary,
                          border: `1px solid ${COLORS.primary}40`,
                          borderRadius: '9999px',
                          padding: '0 5px',
                          flexShrink: 0,
                        }}>
                          {getTemplate(fn.templateId)?.label ?? fn.templateId}
                        </span>
                      )}
                    </div>
                    <span style={{
                      display: 'block',
                      fontSize: '10px', fontFamily: 'monospace',
                      color: fn.visible ? COLORS.textSecondary : COLORS.neutral,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginTop: '1px',
                    }}>
                      = {buildReadableExpr(fn.exprStr)}
                    </span>
                  </div>

                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => handleToggleVisible(e, fn)}
                    title={fn.visible ? '隐藏' : '显示'}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '2px', flexShrink: 0,
                      color: fn.visible ? COLORS.neutral : COLORS.textSecondary,
                      transition: 'color 120ms',
                    }}
                  >
                    {fn.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={(e) => handleRemove(e, fn)}
                    title="删除"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '2px', flexShrink: 0,
                      color: COLORS.neutral,
                      transition: 'color 120ms',
                    }}
                    {...dangerHover(COLORS.neutral)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
