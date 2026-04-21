import { useState, useCallback, useRef, useEffect } from 'react'
import { useAnalysisStore } from '@/store/analysisStore'
import { useViewportStore } from '@/store/viewportStore'
import { DataSourceSelector } from './DataSourceSelector'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { EnergyBarChart } from '@/components/charts/EnergyBarChart'
import { MomentumBarChart } from '@/components/charts/MomentumBarChart'
import { COLORS, RADIUS, EDITOR_CHROME } from '@/styles/tokens'
import { ALL_TABS, TAB_GROUPS } from '@/store/analysisStore'
import { Tip } from '@/components/ui/Tip'

const MIN_HEIGHT = 150
const MAX_HEIGHT = 500
const DEFAULT_HEIGHT = 280
const HEADER_HEIGHT = 32

function getResponsivePanelHeights() {
  if (typeof window === 'undefined') {
    return {
      min: MIN_HEIGHT,
      max: MAX_HEIGHT,
      defaultHeight: DEFAULT_HEIGHT,
    }
  }

  const viewportH = window.innerHeight
  const responsiveMax = Math.min(MAX_HEIGHT, Math.max(220, Math.floor(viewportH * 0.5)))
  const responsiveDefault = Math.min(DEFAULT_HEIGHT, Math.floor(viewportH * 0.38))
  const defaultHeight = Math.max(MIN_HEIGHT, Math.min(responsiveMax, responsiveDefault))

  return {
    min: MIN_HEIGHT,
    max: responsiveMax,
    defaultHeight,
  }
}

export function AnalysisPanel() {
  const activeTabs = useAnalysisStore(s => s.activeTabs)
  const toggleTab = useAnalysisStore(s => s.toggleTab)
  const pan = useViewportStore(s => s.pan)

  const [heightBounds, setHeightBounds] = useState(() => getResponsivePanelHeights())
  const [panelHeight, setPanelHeight] = useState(() => heightBounds.defaultHeight)
  const [collapsed, setCollapsed] = useState(false)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const compensationRef = useRef(0)

  const selectedTabs = activeTabs
    .map(key => ALL_TABS.find(t => t.key === key))
    .filter(Boolean)

  const doCollapse = useCallback(() => {
    setCollapsed(true)
    compensationRef.current = panelHeight
    pan(0, panelHeight)
  }, [panelHeight, pan])

  const doExpand = useCallback(() => {
    setCollapsed(false)
    const comp = compensationRef.current
    compensationRef.current = 0
    if (comp > 0) pan(0, -comp)
  }, [pan])

  useEffect(() => {
    const onResize = () => {
      const next = getResponsivePanelHeights()
      setHeightBounds(next)
      setPanelHeight((prev) => Math.max(next.min, Math.min(next.max, prev)))
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: panelHeight }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      const next = Math.max(heightBounds.min, Math.min(heightBounds.max, dragRef.current.startH + delta))
      setPanelHeight(next)
    }

    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [heightBounds.max, heightBounds.min, panelHeight])

  return (
    <div
      style={{
        height: collapsed ? HEADER_HEIGHT : panelHeight + HEADER_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderTop: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      {/* 拖拽条 */}
      {!collapsed && (
        <div
          onMouseDown={onDragStart}
          style={{
            height: 4,
            cursor: 'row-resize',
            backgroundColor: COLORS.bgMuted,
            flexShrink: 0,
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          height: HEADER_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${Math.max(8, EDITOR_CHROME.panelPadding - 2)}px`,
          gap: 4,
          borderBottom: !collapsed ? `1px solid ${COLORS.border}` : undefined,
          backgroundColor: COLORS.bgPage,
          fontSize: 12,
        }}
      >
        {/* 分组标签页（多选） */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flex: 1,
            minWidth: 0,
            alignItems: 'center',
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 2,
          }}
        >
          {TAB_GROUPS.map((group, gi) => (
            <div
              key={group.label}
              style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            >
              {gi > 0 && (
                <div style={{ width: 1, height: 14, backgroundColor: COLORS.border, flexShrink: 0, marginRight: 2 }} />
              )}
              <span style={{ color: COLORS.textMuted, fontSize: 11, flexShrink: 0 }}>
                {group.label}
              </span>
              {group.tabs.map(tab => {
                const isActive = activeTabs.includes(tab.key)
                return (
                  <Tip key={tab.key} text={tab.tooltip} position="bottom">
                    <label
                      onClick={() => toggleTab(tab.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '2px 8px',
                        fontSize: 12,
                        borderRadius: RADIUS.xs,
                        cursor: 'pointer',
                        backgroundColor: isActive ? COLORS.primaryLight : 'transparent',
                        color: isActive ? COLORS.primary : COLORS.textSecondary,
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: `1.5px solid ${isActive ? COLORS.primary : COLORS.borderStrong}`,
                          backgroundColor: isActive ? COLORS.primary : COLORS.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: 10,
                          color: COLORS.white,
                          lineHeight: 1,
                        }}
                      >
                        {isActive && '✓'}
                      </span>
                      {tab.label}
                    </label>
                  </Tip>
                )
              })}
            </div>
          ))}
        </div>

        {/* 折叠按钮 */}
        <button
          onClick={() => collapsed ? doExpand() : doCollapse()}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: COLORS.textMuted,
            fontSize: 14,
            padding: '0 4px',
            lineHeight: 1,
          }}
          title={collapsed ? '展开面板' : '折叠面板'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {/* Body：1-2 张图表并排 */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <DataSourceSelector />
          {selectedTabs.length > 0 ? (
            selectedTabs.map(tab => {
              if (tab!.dataKey === '_energyBar') return <EnergyBarChart key={tab!.key} />
              if (tab!.dataKey === '_momentumBar') return <MomentumBarChart key={tab!.key} />
              return <TimeSeriesChart key={tab!.key} dataKey={tab!.dataKey} yLabel={tab!.yLabel} />
            })
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLORS.textPlaceholder,
                fontSize: 13,
              }}
            >
              选择标签页查看图表
            </div>
          )}
        </div>
      )}
    </div>
  )
}
