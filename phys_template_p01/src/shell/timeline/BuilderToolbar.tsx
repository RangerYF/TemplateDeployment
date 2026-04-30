import {
  inferQualifier,
  normalizeBuilderParamValues,
  type BuilderWorkspaceId,
  useBuilderStore,
  useBuilderWorkspace,
} from '@/store/builder-store';
import { isSingleEntryBuilderFeedbackMode } from '@/app-config';
import { COLORS } from '@/styles/tokens';

interface BuilderToolbarProps {
  entryMode?: 'template' | 'free';
  showTemplateLibraryInFree?: boolean;
  onBack: () => void;
  currentTemplateLabel?: string | null;
  advancedEditEnabled: boolean;
}

const WORKSPACE_LABELS: Record<BuilderWorkspaceId, string> = {
  primary: '左工作区',
  secondary: '右工作区',
};

export function BuilderToolbar({
  entryMode = 'template',
  showTemplateLibraryInFree = false,
  onBack,
  currentTemplateLabel,
  advancedEditEnabled,
}: BuilderToolbarProps) {
  const activeWorkspaceId = useBuilderStore((state) => state.activeWorkspaceId);
  const layoutMode = useBuilderStore((state) => state.layoutMode);
  const builderClipboard = useBuilderStore((state) => state.builderClipboard);
  const selectWorkspace = useBuilderStore((state) => state.selectWorkspace);
  const setLayoutMode = useBuilderStore((state) => state.setLayoutMode);
  const copyWorkspaceToWorkspace = useBuilderStore((state) => state.copyWorkspaceToWorkspace);
  const runCircuit = useBuilderStore((state) => state.runCircuit);
  const stopCircuit = useBuilderStore((state) => state.stopCircuit);
  const clearWorkspace = useBuilderStore((state) => state.clearWorkspace);
  const copyScene = useBuilderStore((state) => state.copyScene);
  const pasteClipboard = useBuilderStore((state) => state.pasteClipboard);
  const isRunning = useBuilderWorkspace(activeWorkspaceId, (state) => state.isRunning);
  const entities = useBuilderWorkspace(activeWorkspaceId, (state) => state.entities);
  const builderParamValues = useBuilderWorkspace(activeWorkspaceId, (state) => state.builderParamValues);
  const entityCount = useBuilderWorkspace(activeWorkspaceId, (state) => state.entities.size);
  const relationCount = useBuilderWorkspace(activeWorkspaceId, (state) => state.relations.length);
  const canInsertClipboard = entryMode === 'free' || advancedEditEnabled;
  const targetWorkspaceId = activeWorkspaceId === 'primary' ? 'secondary' : 'primary';

  const normalizedParams = normalizeBuilderParamValues(entities, builderParamValues);
  const activeCurrentMeter = normalizedParams.activeCurrentMeterId
    ? entities.get(String(normalizedParams.activeCurrentMeterId))
    : undefined;
  const activeVoltmeter = normalizedParams.activeVoltmeterId
    ? entities.get(String(normalizedParams.activeVoltmeterId))
    : undefined;
  const qualifier = inferQualifier(entities);
  const circuitLabel = qualifier?.circuit === 'voltammetry-compare'
    ? `伏安法·${normalizedParams.method === 'external' ? '外接' : '内接'}判读`
    : null;

  const modeTitle = currentTemplateLabel
    ? `${WORKSPACE_LABELS[activeWorkspaceId]} · ${currentTemplateLabel}`
    : entryMode === 'free'
      ? `${WORKSPACE_LABELS[activeWorkspaceId]} · 空白自由搭建`
      : `${WORKSPACE_LABELS[activeWorkspaceId]} · 模板驱动搭建`;
  const modeDescription = currentTemplateLabel
    ? (advancedEditEnabled
        ? '当前激活工作区已加载模板骨架，可直接调结构、补元件和改连线。'
        : '当前激活工作区已加载模板骨架，可直接调结构和参数；需要补元件时到左侧开启进阶编辑。')
    : entryMode === 'free'
      ? (showTemplateLibraryInFree
          ? '当前激活工作区可从空白开始，也可随时在左侧加载模板后继续自由搭建。'
          : '当前激活工作区从空白开始，自由拖元件、拉线后即可运行。')
      : '先从左侧给当前激活工作区选模板，再继续调整接法、参数和器材。';
  const editStatusLabel = advancedEditEnabled
    ? entryMode === 'free'
      ? '编辑已开启'
      : '进阶编辑已开启'
    : entryMode === 'free'
      ? '当前只读'
      : '模板锁定中';
  const editStatusDescription = advancedEditEnabled
    ? '当前允许拖拽补元件、移动位置、拉线删线。'
    : entryMode === 'free'
      ? '左侧面板顶部可重新开启编辑。'
      : '左侧面板顶部可开启进阶编辑，继续补元件和改连线。';

  return (
    <div
      className="space-y-3 px-4 py-3"
      style={{
        borderTop: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      <div className="flex flex-wrap items-stretch gap-3">
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-3"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
        >
          {!isSingleEntryBuilderFeedbackMode && (
            <button
              onClick={onBack}
              className="rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-100"
              style={{ color: COLORS.textSecondary, backgroundColor: COLORS.bg }}
            >
              ← 返回
            </button>
          )}

          {!isRunning ? (
            <button
              onClick={() => runCircuit(activeWorkspaceId)}
              disabled={entityCount === 0}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: entityCount > 0 ? COLORS.primary : COLORS.primaryDisabled }}
            >
              ▶ 运行当前工作区
            </button>
          ) : (
            <button
              onClick={() => stopCircuit(activeWorkspaceId)}
              className="rounded-xl px-4 py-2 text-xs font-semibold transition-colors hover:bg-red-50"
              style={{ color: COLORS.error, border: `1px solid ${COLORS.error}`, backgroundColor: COLORS.bg }}
            >
              ■ 停止当前工作区
            </button>
          )}

          <button
            onClick={() => clearWorkspace(activeWorkspaceId)}
            disabled={entityCount === 0}
            className="rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-40"
            style={{ color: COLORS.textSecondary, backgroundColor: COLORS.bg }}
          >
            清空当前工作区
          </button>

          <button
            onClick={() => copyScene(activeWorkspaceId)}
            disabled={entityCount === 0}
            className="rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-40"
            style={{ color: COLORS.textSecondary, backgroundColor: COLORS.bg }}
            title="复制当前整张电路图。Ctrl/Cmd+C 在未选中元件时也会执行同样动作。"
          >
            复制当前电路图
          </button>

          <button
            onClick={() => pasteClipboard(activeWorkspaceId)}
            disabled={!builderClipboard || !canInsertClipboard}
            className="rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-40"
            style={{ color: COLORS.textSecondary, backgroundColor: COLORS.bg }}
            title={
              canInsertClipboard
                ? '粘贴内部剪贴板内容。Ctrl/Cmd+V 同样可用。'
                : '当前处于模板锁定状态，请先开启进阶编辑再粘贴。'
            }
          >
            粘贴到当前工作区
          </button>

          <button
            onClick={() => copyWorkspaceToWorkspace(activeWorkspaceId, targetWorkspaceId)}
            disabled={entityCount === 0}
            className="rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-40"
            style={{ color: COLORS.primary, backgroundColor: COLORS.primaryLight }}
            title="显式把当前工作区整图替换复制到另一侧，不依赖先复制再切换粘贴。"
          >
            复制到{WORKSPACE_LABELS[targetWorkspaceId]}
          </button>
        </div>

        <div
          className="min-w-[260px] rounded-2xl border px-4 py-3"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: COLORS.textMuted }}>
            Layout
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { id: 'single' as const, label: '单图模式' },
              { id: 'dual' as const, label: '双图模式' },
            ].map((mode) => {
              const isActive = layoutMode === mode.id;

              return (
                <button
                  key={mode.id}
                  onClick={() => setLayoutMode(mode.id)}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
                  style={{
                    color: isActive ? COLORS.primary : COLORS.textSecondary,
                    backgroundColor: isActive ? COLORS.primaryLight : COLORS.bgMuted,
                    border: `1px solid ${isActive ? COLORS.primary : COLORS.border}`,
                  }}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
            {layoutMode === 'single'
              ? '当前只展示激活工作区，便于专注编辑。'
              : '左右两个工作区同时显示，可并排对比改前改后或 A / B 方案。'}
          </div>
        </div>

        <div
          className="min-w-[260px] rounded-2xl border px-4 py-3"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: COLORS.textMuted }}>
            Workspace
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['primary', 'secondary'] as const).map((workspaceId) => {
              const isActive = workspaceId === activeWorkspaceId;

              return (
                <button
                  key={workspaceId}
                  onClick={() => selectWorkspace(workspaceId)}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
                  style={{
                    color: isActive ? COLORS.primary : COLORS.textSecondary,
                    backgroundColor: isActive ? COLORS.primaryLight : COLORS.bg,
                    border: `1px solid ${isActive ? COLORS.primary : COLORS.border}`,
                  }}
                >
                  {WORKSPACE_LABELS[workspaceId]}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
            右侧属性面板和左侧模板选择始终作用于当前激活工作区。
          </div>
        </div>

        <div
          className="min-w-[300px] flex-1 rounded-2xl border px-4 py-3"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: COLORS.textMuted }}>
            Workbench
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.text }}>
            {modeTitle}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
            {modeDescription}
          </div>
        </div>

        <div
          className="min-w-[220px] rounded-2xl border px-4 py-3"
          style={{
            borderColor: advancedEditEnabled ? `${COLORS.primary}55` : COLORS.border,
            backgroundColor: advancedEditEnabled ? COLORS.primaryLight : COLORS.bgMuted,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
              编辑状态
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                color: advancedEditEnabled ? COLORS.primary : COLORS.textSecondary,
                backgroundColor: COLORS.bg,
              }}
            >
              {editStatusLabel}
            </span>
          </div>
          <div className="mt-2 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
            {editStatusDescription}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <MetaChip label={`当前：${WORKSPACE_LABELS[activeWorkspaceId]}`} accent="info" />
        <MetaChip label={layoutMode === 'dual' ? '双图对比中' : '单图聚焦中'} />
        <MetaChip label={`${entityCount} 个元件`} />
        <MetaChip label={`${relationCount} 条连线`} />
        {circuitLabel && <MetaChip label={circuitLabel} accent="info" />}
        {builderClipboard && (
          <MetaChip
            label={`剪贴板：${builderClipboard.type === 'entity' ? '单元件' : '整图'}`}
            accent="info"
          />
        )}
        {activeCurrentMeter && (
          <MetaChip
            label={`活动电流表：${activeCurrentMeter.label ?? activeCurrentMeter.id.slice(-4)}`}
          />
        )}
        {activeVoltmeter && (
          <MetaChip
            label={`活动电压表：${activeVoltmeter.label ?? activeVoltmeter.id.slice(-4)}`}
          />
        )}
      </div>
    </div>
  );
}

function MetaChip({
  label,
  accent = 'neutral',
}: {
  label: string;
  accent?: 'neutral' | 'info';
}) {
  return (
    <span
      className="rounded-full px-3 py-1 text-[10px] font-medium"
      style={{
        color: accent === 'info' ? COLORS.info : COLORS.textSecondary,
        backgroundColor: accent === 'info' ? COLORS.infoLight : COLORS.bgMuted,
        border: `1px solid ${accent === 'info' ? '#BFDBFE' : COLORS.border}`,
      }}
    >
      {label}
    </span>
  );
}
