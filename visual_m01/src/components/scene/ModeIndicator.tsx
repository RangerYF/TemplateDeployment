import { useToolStore } from '@/editor/store';
import type { ToolStep } from '@/editor/store/toolStore';
import { COLORS } from '@/styles/tokens';

/** 工具模式 → 默认提示文案映射 */
const MODE_TIPS: Record<string, string> = {
  select: '选择模式 — 点击选中元素，右键菜单操作，Ctrl/⌘+点击穿透选中被遮挡元素',
  drawSegment: '画线模式 — 依次点击两个顶点画线段',
  crossSection: '截面模式 — 点击选择截面定义点（至少3个）',
  coordSystem: '坐标系模式 — 点击选择原点',
  circumCircle: '外接圆模式 — 点击选择3个点',
};

function StepIndicator({ steps }: { steps: ToolStep[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && (
            <div style={{
              width: 16,
              height: 1,
              background: step.status === 'done' ? COLORS.success : COLORS.border,
            }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StepBadge index={i + 1} status={step.status} />
            <span style={{
              fontSize: 12,
              color: step.status === 'done' ? COLORS.success
                : step.status === 'active' ? COLORS.text
                : COLORS.textMuted,
              fontWeight: step.status === 'active' ? 600 : 400,
            }}>
              {step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StepBadge({ index, status }: { index: number; status: ToolStep['status'] }) {
  const isDone = status === 'done';
  const isActive = status === 'active';
  return (
    <div style={{
      width: 18,
      height: 18,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 10,
      fontWeight: 700,
      flexShrink: 0,
      background: isDone ? COLORS.success : 'transparent',
      color: isDone ? '#fff' : isActive ? COLORS.text : COLORS.textMuted,
      border: isDone ? 'none' : `1.5px solid ${isActive ? COLORS.text : COLORS.border}`,
    }}>
      {isDone ? '✓' : index}
    </div>
  );
}

/** 支持文本指令输入的工具（有输入框时说明条下移） */
const TEXT_COMMAND_TOOLS = new Set(['drawSegment', 'crossSection']);

export function ModeIndicator() {
  const activeToolId = useToolStore((s) => s.activeToolId);
  const toolStepInfo = useToolStore((s) => s.toolStepInfo);
  const toolSteps = useToolStore((s) => s.toolSteps);

  // 优先渲染结构化步骤，其次单行文案，最后静态映射
  const hasSteps = toolSteps && toolSteps.length > 0;
  const tip = !hasSteps ? (toolStepInfo ?? MODE_TIPS[activeToolId]) : null;

  if (!hasSteps && !tip) return null;

  const hasCommandInput = TEXT_COMMAND_TOOLS.has(activeToolId);

  return (
    <div
      style={{
        position: 'absolute',
        top: hasCommandInput ? 106 : 72,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.95)',
        color: '#000',
        border: '1px solid #000',
        padding: '5px 16px',
        borderRadius: 6,
        fontSize: 13,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 15,
        fontWeight: 500,
        backdropFilter: 'blur(4px)',
      }}
    >
      {hasSteps ? <StepIndicator steps={toolSteps} /> : tip}
    </div>
  );
}
