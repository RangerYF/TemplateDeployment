import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import {
  getModuleGroup,
  getTemplateById,
  type TemplateModule,
} from '@/templates'

interface SceneSelectorProps {
  moduleId: TemplateModule
  sceneId: string
  onSelectScene: (moduleId: TemplateModule, sceneId: string) => void
}

export function SceneSelector({ moduleId, sceneId, onSelectScene }: SceneSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const current = getTemplateById(sceneId)
  const currentGroup = getModuleGroup(moduleId)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const visibleTemplates = useMemo(() => {
    const raw = currentGroup?.templates.filter((template) => template.meta.status === 'ready') ?? []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return raw
    return raw.filter((template) => {
      const haystack = `${template.meta.id} ${template.meta.name}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [currentGroup?.templates, query])

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 max-w-[36vw] items-center gap-2 rounded-lg border px-3 text-left text-sm font-normal transition-colors max-[600px]:max-w-[52vw]"
        style={{
          background: 'var(--theme-surface)',
          borderColor: open ? 'var(--theme-primary)' : 'var(--theme-border)',
          color: 'var(--theme-text)',
          boxShadow: open ? '0 0 0 3px var(--theme-primary-light)' : undefined,
        }}
        aria-expanded={open}
      >
        <span className="truncate">
          {current ? `${current.meta.id} ${current.meta.name}` : sceneId}
        </span>
        <ChevronDown size={15} className="shrink-0" />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-11 z-[90] w-[min(720px,calc(100vw-32px))] overflow-hidden rounded-xl border shadow-2xl"
          style={{
            background: 'var(--theme-panel-bg)',
            borderColor: 'var(--theme-border)',
            boxShadow: '0 24px 60px rgba(15,23,42,0.18)',
          }}
        >
          <div className="border-b p-3" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
                  选择场景
                </div>
              </div>
              <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {visibleTemplates.length} 个可用
              </div>
            </div>
            <label
              className="flex h-9 items-center gap-2 rounded-lg border px-3"
              style={{
                background: 'var(--theme-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-secondary)',
              }}
            >
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索场景编号或名称"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--theme-text)' }}
              />
            </label>
          </div>

          <div className="max-h-[min(56vh,430px)] overflow-y-auto p-2">
            {visibleTemplates.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-1.5">
                {visibleTemplates.map((template) => {
                  const active = template.meta.id === sceneId
                  return (
                    <button
                      key={template.meta.id}
                      type="button"
                      onClick={() => {
                        onSelectScene(template.meta.module, template.meta.id)
                        setOpen(false)
                      }}
                      className="rounded-lg border px-2.5 py-2 text-left transition-colors"
                      style={{
                        background: active ? 'var(--theme-primary-light)' : 'var(--theme-surface)',
                        borderColor: active ? 'var(--theme-primary)' : 'var(--theme-border)',
                        color: 'var(--theme-text)',
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--theme-primary)' }}>
                          {template.meta.id}
                        </span>
                      </div>
                      <div
                        className="truncate text-sm"
                        style={{ color: active ? 'var(--theme-primary)' : 'var(--theme-text)' }}
                      >
                        {template.meta.name}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                没有匹配的场景
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
