import { Toolbar } from '@/components/Toolbar'
import { TopBarMeta } from '@/components/TopBarMeta'
import { TemplateDevActions } from '@/components/layout/TemplateDevActions'
import { Canvas } from '@/components/Canvas'
import { ObjectPanel } from '@/components/panels/ObjectPanel'
import { PropertyPanel, PropertyPanelTabBar } from '@/components/panels/PropertyPanel'
import { AnalysisPanel } from '@/components/panels/AnalysisPanel'
import { buildModuleHash } from '@/routes/hashRoutes'
import { useSelectionStore } from '@/store/selectionStore'
import { COLORS, EDITOR_CHROME, SHADOWS } from '@/styles/tokens'
import type { TemplateModule } from '@/templates'

const LEFT_PANEL_WIDTH = 'clamp(12rem, 16vw, 15rem)'
const RIGHT_PANEL_WIDTH = 'clamp(14rem, 19vw, 17.5rem)'

interface EditorLayoutProps {
  moduleId: TemplateModule
  sceneId: string
}

export function EditorLayout({ moduleId, sceneId }: EditorLayoutProps) {
  const showPropertyTabs = useSelectionStore(
    (s) => s.selected.length === 1 && s.selected[0].type === 'body',
  )
  const backHref = buildModuleHash(moduleId)

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div
        className="border-b flex items-stretch"
        style={{
          height: EDITOR_CHROME.barHeight,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bgPage,
          boxShadow: SHADOWS.sm,
          zIndex: 5,
        }}
      >
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{
            width: LEFT_PANEL_WIDTH,
            backgroundColor: COLORS.bgPage,
            borderRight: `1px solid ${COLORS.border}`,
          }}
        >
          <TopBarMeta backHref={backHref} backLabel="返回场景列表" />
        </div>
        <div
          className="flex-1 min-w-0"
          style={{ backgroundColor: COLORS.bgPage }}
        >
          <Toolbar />
        </div>
        <div
          className="flex-shrink-0 overflow-hidden relative"
          style={{
            width: RIGHT_PANEL_WIDTH,
            backgroundColor: COLORS.bgPage,
            borderLeft: `1px solid ${COLORS.border}`,
          }}
        >
          <div className="h-full w-full">{showPropertyTabs ? <PropertyPanelTabBar /> : null}</div>
          <TemplateDevActions templateId={sceneId} />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Object library */}
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{
            width: LEFT_PANEL_WIDTH,
            borderRight: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.bgPage,
          }}
        >
          <ObjectPanel />
        </div>

        {/* Center - Canvas + AnalysisPanel */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Canvas />
          <AnalysisPanel />
        </div>

        {/* Right panel - Properties */}
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{
            width: RIGHT_PANEL_WIDTH,
            borderLeft: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.bgPage,
          }}
        >
          <PropertyPanel />
        </div>
      </div>
    </div>
  )
}
