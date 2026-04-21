import {
  templateCatalog,
  type TemplateDefinition,
  type TemplateStatus,
} from '@/templates'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { COLORS, FEEDBACK_VISUAL, RADIUS } from '@/styles/tokens'

interface WorkbenchPageProps {
  onOpenTemplate: (templateId: string) => void
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
  onOpenTemplate,
}: {
  template: TemplateDefinition
  onOpenTemplate: (templateId: string) => void
}) {
  const { meta } = template
  const statusStyle = STATUS_STYLE[meta.status]

  return (
    <button
      type="button"
      onClick={() => onOpenTemplate(meta.id)}
      className="text-left px-3.5 py-3"
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.bg,
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
        <div
          className="text-xs font-semibold tracking-wide"
          style={{ color: COLORS.textMuted }}
        >
          {meta.id}
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

export function WorkbenchPage({ onOpenTemplate }: WorkbenchPageProps) {
  const readyGroups = templateCatalog
    .map((group) => ({
      ...group,
      templates: group.templates.filter((template) => template.meta.status === 'ready'),
    }))
    .filter((group) => group.templates.length > 0)

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{
        backgroundColor: COLORS.bgPage,
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-7">
          <h1
            className="text-2xl font-semibold mb-2"
            style={{ color: COLORS.text }}
          >
            模板工作台
          </h1>
          <p
            className="text-sm"
            style={{ color: COLORS.textSecondary }}
          >
            顶部标签切换模块，进入编辑器后可继续编辑场景。
          </p>
        </div>

        {readyGroups.length > 0 ? (
          <Tabs
            defaultValue={readyGroups[0].module}
            className="space-y-4"
          >
            <div className="overflow-x-auto pb-1">
              <TabsList className="min-w-max">
                {readyGroups.map((group) => (
                  <TabsTrigger
                    key={group.module}
                    value={group.module}
                    className="shrink-0"
                  >
                    {group.title}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {readyGroups.map((group) => (
              <TabsContent
                key={group.module}
                value={group.module}
              >
                <section>
                  <p
                    className="text-xs mb-2.5"
                    style={{ color: COLORS.textMuted }}
                  >
                    {group.summary}
                  </p>
                  <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {group.templates.map((template) => (
                      <TemplateCardItem
                        key={template.meta.id}
                        template={template}
                        onOpenTemplate={onOpenTemplate}
                      />
                    ))}
                  </div>
                </section>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p
            className="text-sm"
            style={{ color: COLORS.textMuted }}
          >
            暂无可用模板。
          </p>
        )}
      </div>
    </div>
  )
}
