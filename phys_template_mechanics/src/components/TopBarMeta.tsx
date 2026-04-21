import { ChevronLeft } from 'lucide-react'
import { Tip } from '@/components/ui/Tip'
import { COLORS, EDITOR_CHROME } from '@/styles/tokens'

interface TopBarMetaProps {
  backHref: string
  backLabel?: string
}

export function TopBarMeta({
  backHref,
  backLabel = '返回模板入口',
}: TopBarMetaProps) {
  const goBack = () => {
    if (window.location.hash === backHref) return
    window.location.hash = backHref
  }
  return (
    <div
      className="flex items-center px-4 gap-2"
      style={{ height: EDITOR_CHROME.barHeight }}
    >
      <Tip text={backLabel} position="bottom">
        <button
          type="button"
          aria-label={backLabel}
          onClick={goBack}
          className="inline-flex items-center justify-center"
          style={{
            width: EDITOR_CHROME.controlSize,
            height: EDITOR_CHROME.controlSize,
            color: COLORS.text,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
      </Tip>
      <span className="text-sm font-medium mr-2" style={{ color: COLORS.text }}>
        物理编辑器
      </span>
    </div>
  )
}
