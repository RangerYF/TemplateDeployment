import { templateCatalog } from '@/templates'
import type { TemplateModule } from '@/templates'
import { COLORS, FEEDBACK_VISUAL, RADIUS } from '@/styles/tokens'

interface ModuleHubPageProps {
  onOpenModule: (moduleId: TemplateModule) => void
}

export function ModuleHubPage({ onOpenModule }: ModuleHubPageProps) {
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
            模块导航
          </h1>
          <p
            className="text-sm"
            style={{ color: COLORS.textSecondary }}
          >
            先按学科模块进入独立页面，再选择具体模板入口。
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {templateCatalog.map((group) => {
            const readyCount = group.templates.filter((template) => template.meta.status === 'ready').length
            return (
              <button
                key={group.module}
                type="button"
                onClick={() => onOpenModule(group.module)}
                className="text-left p-5"
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
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div
                    className="text-lg font-semibold"
                    style={{ color: COLORS.text }}
                  >
                    {group.title}
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      color: COLORS.primary,
                      backgroundColor: FEEDBACK_VISUAL.selectedFill,
                    }}
                  >
                    {readyCount} 个模板
                  </span>
                </div>
                <p
                  className="text-sm mb-4"
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
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
