import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getModuleGroup, getTemplateById } from '@/templates'

interface MechanicsTeachingModalProps {
  sceneId: string
  onClose: () => void
}

type Tab = 'goal' | 'steps' | 'relations' | 'source'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'goal', label: '场景目标' },
  { key: 'steps', label: '构造步骤' },
  { key: 'relations', label: '物理关系' },
  { key: 'source', label: '数据来源' },
]

export function MechanicsTeachingModal({ sceneId, onClose }: MechanicsTeachingModalProps) {
  const [tab, setTab] = useState<Tab>('goal')
  const template = getTemplateById(sceneId)
  const group = template ? getModuleGroup(template.meta.module) : undefined

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!template) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-label="关闭教学弹窗"
      />
      <section
        className="relative flex max-h-[80vh] w-[600px] max-w-[90vw] flex-col overflow-hidden rounded-xl border shadow-2xl"
        style={{
          background: 'var(--theme-panel-bg)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <div>
            <div className="text-base font-semibold">{template.meta.name}</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {group?.title} · {template.meta.id}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'var(--theme-surface-hover)', color: 'var(--theme-text-secondary)' }}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </header>

        <nav className="flex border-b px-5" style={{ borderColor: 'var(--theme-border)' }}>
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className="border-b-2 px-3 py-3 text-sm font-semibold"
              style={{
                borderColor: tab === item.key ? 'var(--theme-primary)' : 'transparent',
                color: tab === item.key ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="overflow-y-auto px-5 py-4 text-sm leading-7">
          {tab === 'goal' ? (
            <p style={{ color: 'var(--theme-text-secondary)' }}>{template.teaching.teachingObjective}</p>
          ) : null}
          {tab === 'steps' ? (
            <ol className="space-y-2">
              {template.teaching.constructionSteps.map((step) => (
                <li key={step} className="rounded-lg px-3 py-2" style={{ background: 'var(--theme-surface-hover)' }}>
                  {step}
                </li>
              ))}
            </ol>
          ) : null}
          {tab === 'relations' ? (
            <div className="space-y-3" style={{ color: 'var(--theme-text-secondary)' }}>
              {group?.teachingFocus.map((item) => (
                <div key={item} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--theme-border)' }}>
                  <span style={{ color: 'var(--theme-primary)' }}>•</span> {item}
                </div>
              ))}
            </div>
          ) : null}
          {tab === 'source' ? (
            <div className="space-y-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
              <div>Scene ID：{template.meta.id}</div>
              <div>Module：{template.meta.module}</div>
              <div>Source：{template.sceneSource}</div>
              <div>Path：{template.sceneJsonPath ?? '未配置'}</div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
