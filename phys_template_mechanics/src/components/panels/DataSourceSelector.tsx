import { useState, useRef, useEffect } from 'react'
import { useSceneStore } from '@/store/sceneStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { getChartColor } from '@/components/charts/chartColors'
import { isAnalyzableBody } from '@/components/charts/chartUtils'
import { COLORS, EDITOR_CHROME } from '@/styles/tokens'
import { Trash2 } from 'lucide-react'
import { Tip } from '@/components/ui/Tip'

/** 双击 inline 编辑的组名组件 */
function EditableGroupName({ groupId, name }: { groupId: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateGroup = useAnalysisStore(s => s.updateGroup)

  useEffect(() => { setValue(name) }, [name])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed && trimmed !== name) {
      updateGroup(groupId, { name: trimmed })
    } else {
      setValue(name)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setValue(name); setEditing(false) }
        }}
        style={{
          width: '100%',
          fontSize: 12,
          padding: '0 2px',
          border: `1px solid ${COLORS.primary}`,
          borderRadius: 3,
          outline: 'none',
          color: COLORS.text,
          backgroundColor: COLORS.bg,
        }}
      />
    )
  }

  return (
    <Tip text="双击重命名">
      <span
        onDoubleClick={() => setEditing(true)}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'text',
        }}
      >
        {name}
      </span>
    </Tip>
  )
}

export function DataSourceSelector() {
  const bodies = useSceneStore(s => s.scene.bodies)
  const activeDataSourceIds = useAnalysisStore(s => s.activeDataSourceIds)
  const toggleDataSource = useAnalysisStore(s => s.toggleDataSource)
  const analysisGroups = useAnalysisStore(s => s.analysisGroups)
  const removeGroup = useAnalysisStore(s => s.removeGroup)

  // 只列出可分析的教学对象（方块、小球、杆件），排除基础设施
  const analyzableBodies = bodies.filter(isAnalyzableBody)

  return (
    <div
      style={{
        width: 130,
        flexShrink: 0,
        borderRight: `1px solid ${COLORS.border}`,
        overflowY: 'auto',
        padding: `${Math.round(EDITOR_CHROME.panelPadding / 2)}px ${Math.round(EDITOR_CHROME.panelPadding * 0.67)}px`,
        fontSize: 12,
      }}
    >
      <Tip text="勾选要在图表中显示的物体" position="bottom">
        <div style={{ color: COLORS.textMuted, marginBottom: 4, fontWeight: 500 }}>
          数据源
        </div>
      </Tip>
      {analyzableBodies.map((body, idx) => {
        const color = getChartColor(idx)
        const checked = activeDataSourceIds.has(body.id)
        return (
          <label
            key={body.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 0',
              cursor: 'pointer',
              color: COLORS.text,
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleDataSource(body.id)}
              style={{ margin: 0, accentColor: color }}
            />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {body.label}
            </span>
          </label>
        )
      })}
      {analyzableBodies.length === 0 && (
        <div style={{ color: COLORS.textPlaceholder, fontSize: 11 }}>
          无可分析物体
        </div>
      )}

      {/* 分析组 */}
      {analysisGroups.length > 0 && (
        <>
          <div
            style={{
              borderTop: `1px solid ${COLORS.border}`,
              margin: '6px 0 4px',
            }}
          />
          <Tip text="多选物体后可在右侧面板创建，查看系统级物理量" position="bottom">
            <div style={{ color: COLORS.textMuted, marginBottom: 4, fontWeight: 500 }}>
              分析组
            </div>
          </Tip>
          {analysisGroups.map((group, gi) => {
            const groupSourceId = `group:${group.id}`
            const checked = activeDataSourceIds.has(groupSourceId)
            const color = group.color || getChartColor(analyzableBodies.length + gi)
            return (
              <div
                key={group.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flex: 1,
                    minWidth: 0,
                    color: COLORS.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDataSource(groupSourceId)}
                    style={{ margin: 0, accentColor: color, cursor: 'pointer' }}
                  />
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: color,
                      flexShrink: 0,
                    }}
                  />
                  <EditableGroupName groupId={group.id} name={group.name} />
                  <span style={{ color: COLORS.textMuted, fontSize: 10, flexShrink: 0 }}>
                    ({group.bodyIds.length})
                  </span>
                </div>
                <Tip text="删除分析组">
                  <button
                    onClick={() => removeGroup(group.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 2,
                      cursor: 'pointer',
                      color: COLORS.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                </Tip>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
