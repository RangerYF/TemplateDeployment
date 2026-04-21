import type { TemplateDefinition, TemplateModuleGroup, TemplateStatus } from '@/templates'
import { COLORS, FEEDBACK_VISUAL, RADIUS } from '@/styles/tokens'

interface ModulePageProps {
  group: TemplateModuleGroup
  onOpenScene: (sceneId: string) => void
  editedSceneIds?: Set<string>
  activeSceneId?: string | null
}

const STATUS_TEXT: Record<TemplateStatus, string> = {
  ready: '已接入',
  planned: '待接入',
}

const STATUS_STYLE: Record<
  TemplateStatus,
  { color: string; marker: string }
> = {
  ready: {
    color: COLORS.success,
    marker: COLORS.success,
  },
  planned: {
    color: COLORS.warning,
    marker: COLORS.warning,
  },
}

function TemplateCardItem({
  template,
  onOpenScene,
  isEdited,
  isActive,
}: {
  template: TemplateDefinition
  onOpenScene: (sceneId: string) => void
  isEdited: boolean
  isActive: boolean
}) {
  const { meta } = template
  const statusStyle = STATUS_STYLE[meta.status]

  return (
    <button
      type="button"
      onClick={() => onOpenScene(meta.id)}
      className="text-left px-3.5 py-3"
      style={{
        border: `1px solid ${isActive ? FEEDBACK_VISUAL.selectedColor : COLORS.border}`,
        borderRadius: RADIUS.md,
        backgroundColor: isActive ? FEEDBACK_VISUAL.selectedFill : COLORS.bg,
        transition: 'background-color 0.12s ease, border-color 0.12s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = FEEDBACK_VISUAL.selectedColor
        event.currentTarget.style.backgroundColor = FEEDBACK_VISUAL.selectedFill
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = COLORS.border
        event.currentTarget.style.backgroundColor = COLORS.bg
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div
            className="text-xs font-semibold tracking-wide"
            style={{ color: COLORS.textMuted }}
          >
            {meta.id}
          </div>
          {isEdited ? (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                color: COLORS.primary,
                backgroundColor: FEEDBACK_VISUAL.selectedFill,
              }}
            >
              已编辑
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1 h-3"
            style={{
              borderRadius: 2,
              backgroundColor: statusStyle.marker,
            }}
          />
          <span
            className="text-[11px]"
            style={{ color: statusStyle.color }}
          >
            {STATUS_TEXT[meta.status]}
          </span>
        </div>
      </div>
      <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
        {meta.name}
      </div>
    </button>
  )
}

export function ModulePage({
  group,
  onOpenScene,
  editedSceneIds = new Set<string>(),
  activeSceneId = null,
}: ModulePageProps) {
  const readyTemplates = group.templates.filter((template) => template.meta.status === 'ready')

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ backgroundColor: COLORS.bgPage }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-7">
          <h1
            className="text-2xl font-semibold mb-2"
            style={{ color: COLORS.text }}
          >
            {group.title}
          </h1>
          <p
            className="text-sm mb-3"
            style={{ color: COLORS.textSecondary }}
          >
            {group.summary}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.teachingFocus.map((item) => (
              <span
                key={item}
                className="text-[11px] px-2 py-1 rounded-full"
                style={{
                  color: COLORS.textMuted,
                  backgroundColor: COLORS.bgMuted,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {readyTemplates.length > 0 ? (
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {readyTemplates.map((template) => (
              <TemplateCardItem
                key={template.meta.id}
                template={template}
                onOpenScene={onOpenScene}
                isEdited={editedSceneIds.has(template.meta.id)}
                isActive={activeSceneId === template.meta.id}
              />
            ))}
          </div>
        ) : (
          <p
            className="text-sm"
            style={{ color: COLORS.textMuted }}
          >
            当前模块暂无可用模板。
          </p>
        )}
      </div>
    </div>
  )
}
