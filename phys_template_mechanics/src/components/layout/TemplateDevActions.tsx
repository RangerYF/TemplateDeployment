import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Tip } from '@/components/ui/Tip'
import { useToastHook } from '@/components/ui/toast'
import { useModuleWorkspaceStore } from '@/store/moduleWorkspaceStore'
import { COLORS } from '@/styles/tokens'
import { createDefaultSceneDraft, loadRuntimeSceneDraft } from '@/templates/editorRuntime'
import { loadTemplateById } from '@/templates/loader'

interface TemplateDevActionsProps {
  templateId: string | null
}

export function TemplateDevActions({ templateId }: TemplateDevActionsProps) {
  const toast = useToastHook()
  const [isResetting, setIsResetting] = useState(false)
  const canReset = Boolean(templateId) && !isResetting

  const resetScene = async () => {
    if (!templateId || !canReset) return
    const confirmed = window.confirm(`确认将当前场景 ${templateId} 恢复为初始状态吗？`)
    if (!confirmed) return

    setIsResetting(true)
    try {
      const result = await loadTemplateById(templateId)
      if (!result.ok) {
        throw new Error(
          result.reason === 'sanity_failed'
            ? `默认场景校验失败：${result.summary}`
            : `场景加载失败：${result.reason}`,
        )
      }
      if (!result.template.scene) {
        throw new Error('默认场景不存在。')
      }

      const draft = createDefaultSceneDraft(result.template.scene)
      useModuleWorkspaceStore.getState().upsertSceneDraft(templateId, draft)
      loadRuntimeSceneDraft(draft)
      toast.success('当前场景已重置', `${templateId} 已恢复为初始状态`)
    } catch (error) {
      toast.error(
        '重置场景失败',
        error instanceof Error ? error.message : String(error),
      )
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="absolute right-2 top-0 z-10 flex items-center gap-1.5">
      <Tip text="将当前场景恢复为初始状态" position="bottom">
        <button
          type="button"
          aria-label="重置当前场景"
          onClick={() => {
            void resetScene()
          }}
          disabled={!canReset}
          className="inline-flex items-center justify-center gap-1.5 px-2.5 h-7 rounded-md text-xs transition-colors"
          style={{
            color: canReset ? COLORS.text : COLORS.textMuted,
            backgroundColor: canReset ? COLORS.white : COLORS.bgMuted,
            border: `1px solid ${canReset ? COLORS.borderStrong : COLORS.border}`,
            cursor: canReset ? 'pointer' : 'not-allowed',
          }}
        >
          <RotateCcw size={14} strokeWidth={2.1} />
          {isResetting ? '重置中...' : '重置场景'}
        </button>
      </Tip>
    </div>
  )
}
