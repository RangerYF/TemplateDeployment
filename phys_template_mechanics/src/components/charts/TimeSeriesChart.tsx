import { useMemo, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { AnnotationOptions } from 'chartjs-plugin-annotation'
import { Line } from 'react-chartjs-2'
import { useAnalysisStore } from '@/store/analysisStore'
import { useSceneStore } from '@/store/sceneStore'
import { usePlaybackControlStore } from '@/store/playbackControlStore'
import { useEditorStore } from '@/store/editorStore'
import { getChartColor } from '@/components/charts/chartColors'
import type { BodyFrameData, GroupFrameData } from '@/engine/AnalysisRecorder'
import type { ChartOptions } from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin,
)

interface Props {
  dataKey: string
  yLabel: string
}

/** P-14 配色方案 + Q 摩擦热 */
const ENERGY_LINES: { key: string; label: string; color: string; dash?: number[] }[] = [
  { key: 'ek', label: 'Ek', color: '#F44336' },             // 红
  { key: 'epGravity', label: 'Ep(重)', color: '#2196F3' },   // 蓝
  { key: 'epSpring', label: 'Ep(弹)', color: '#4CAF50', dash: [4, 2] }, // 绿
  { key: '_etotal', label: 'E总', color: '#9E9E9E', dash: [8, 4] },     // 灰
  { key: '_Q', label: 'Q', color: '#FF9800', dash: [4, 4] },            // 橙
]

/** 分析组可用于图表的字段映射 */
const GROUP_DATA_KEY_MAP: Record<string, keyof GroupFrameData | '_energy'> = {
  speed: 'speed',           // v-t → 质心速率
  vx: 'cvx',                // vx-t → 质心水平速度
  vy: 'cvy',                // vy-t → 质心竖直速度
  momentum: 'momentum',     // p-t → 系统总动量
  eMech: 'eMech',           // E机-t → 系统机械能
  _energy: '_energy',       // E-t → 系统总能量
}

function getGroupDatasetLabel(groupName: string, dataKey: string): string {
  switch (dataKey) {
    case 'speed':
      return `${groupName} v_cm`
    case 'vx':
      return `${groupName} vx_cm`
    case 'vy':
      return `${groupName} vy_cm`
    case 'momentum':
      return `${groupName} Σp`
    case 'eMech':
      return `${groupName} E机械`
    default:
      return groupName
  }
}

export function TimeSeriesChart({ dataKey, yLabel }: Props) {
  const frameHistory = useAnalysisStore(s => s.frameHistory)
  const activeDataSourceIds = useAnalysisStore(s => s.activeDataSourceIds)
  const analysisGroups = useAnalysisStore(s => s.analysisGroups)
  const collisionEvents = useAnalysisStore(s => s.collisionEvents)
  const currentTime = usePlaybackControlStore((s) => s.currentTime)
  const maxTime = usePlaybackControlStore((s) => s.maxTime)
  const simState = useEditorStore((s) => s.simState)
  const bodies = useSceneStore(s => s.scene.bodies)
  const chartRef = useRef<ChartJS<'line'>>(null)

  const dynamicBodies = useMemo(
    () => bodies.filter(b => !b.isStatic),
    [bodies],
  )

  const isEnergy = dataKey === '_energy'
  const isMomentum = dataKey === 'momentum'
  const isVelocityComponents = dataKey === '_velocityComponents'

  const data = useMemo(() => {
    const labels = frameHistory.map(f => f.t.toFixed(2))
    const activeIds = Array.from(activeDataSourceIds)

    // 单体数据源
    const bodyIds = activeIds.filter(id => !id.startsWith('group:'))
    const activeBodies = dynamicBodies.filter(b => bodyIds.includes(b.id))

    // 分析组数据源
    const groupIds = activeIds
      .filter(id => id.startsWith('group:'))
      .map(id => id.slice(6))
    const activeGroups = analysisGroups.filter(g => groupIds.includes(g.id))

    const datasets: {
      label: string
      data: number[]
      borderColor: string
      backgroundColor: string
      borderWidth: number
      borderDash?: number[]
      pointRadius: number
      tension: number
    }[] = []

    if (isVelocityComponents) {
      const activeIds = Array.from(activeDataSourceIds)
      const bodyIds = activeIds.filter(id => !id.startsWith('group:'))
      const activeBodies = dynamicBodies.filter(b => bodyIds.includes(b.id))
      const groupIds = activeIds
        .filter(id => id.startsWith('group:'))
        .map(id => id.slice(6))
      const activeGroups = analysisGroups.filter(g => groupIds.includes(g.id))

      for (const body of activeBodies) {
        const colorIdx = dynamicBodies.findIndex(b => b.id === body.id)
        const baseColor = getChartColor(colorIdx)
        datasets.push({
          label: `${body.label} vx`,
          data: frameHistory.map(f => {
            const bd = f.bodies[body.id]
            return bd ? bd.vx : 0
          }),
          borderColor: baseColor,
          backgroundColor: 'transparent',
          borderWidth: 1.6,
          pointRadius: 0,
          tension: 0.1,
        })
        datasets.push({
          label: `${body.label} vy`,
          data: frameHistory.map(f => {
            const bd = f.bodies[body.id]
            return bd ? bd.vy : 0
          }),
          borderColor: baseColor,
          backgroundColor: 'transparent',
          borderWidth: 1.4,
          borderDash: [6, 3],
          pointRadius: 0,
          tension: 0.1,
        })
      }

      for (const group of activeGroups) {
        datasets.push({
          label: `${group.name} vx_cm`,
          data: frameHistory.map(f => {
            const gd = f.groups[group.id]
            return gd ? gd.cvx : 0
          }),
          borderColor: group.color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
        })
        datasets.push({
          label: `${group.name} vy_cm`,
          data: frameHistory.map(f => {
            const gd = f.groups[group.id]
            return gd ? gd.cvy : 0
          }),
          borderColor: group.color,
          backgroundColor: 'transparent',
          borderWidth: 1.6,
          borderDash: [6, 3],
          pointRadius: 0,
          tension: 0.1,
        })
      }

      return { labels, datasets }
    }

    if (isEnergy) {
      // 能量模式：每个物体 × 5 条线（Ek / Ep重 / Ep弹 / E总 / Q）
      for (const body of activeBodies) {
        const prefix = (activeBodies.length + activeGroups.length) > 1 ? `${body.label} ` : ''
        const firstFrame = frameHistory[0]?.bodies[body.id]
        const e0 = firstFrame
          ? firstFrame.ek + firstFrame.epGravity + firstFrame.epSpring
          : 0

        for (const el of ENERGY_LINES) {
          datasets.push({
            label: `${prefix}${el.label}`,
            data: frameHistory.map(f => {
              const bd = f.bodies[body.id]
              if (!bd) return 0
              const eTotal = bd.ek + bd.epGravity + bd.epSpring
              if (el.key === '_etotal') return eTotal
              if (el.key === '_Q') return Math.max(0, e0 - eTotal)
              return bd[el.key as keyof BodyFrameData] as number
            }),
            borderColor: el.color,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: el.dash ?? [],
            pointRadius: 0,
            tension: 0.1,
          })
        }
      }

      // 分析组的能量线
      for (const group of activeGroups) {
        const prefix = (activeBodies.length + activeGroups.length) > 1 ? `${group.name} ` : ''
        const firstGroup = frameHistory[0]?.groups[group.id]
        const e0 = firstGroup ? firstGroup.eMech : 0

        const energyGroupLines: { key: string; label: string; color: string; dash?: number[] }[] = [
          { key: 'ek', label: 'Ek', color: '#F44336' },
          { key: 'epGravity', label: 'Ep(重)', color: '#2196F3' },
          { key: 'epSpring', label: 'Ep(弹)', color: '#4CAF50', dash: [4, 2] },
          { key: '_etotal', label: 'E总', color: '#9E9E9E', dash: [8, 4] },
          { key: '_Q', label: 'Q', color: '#FF9800', dash: [4, 4] },
        ]

        for (const el of energyGroupLines) {
          datasets.push({
            label: `${prefix}${el.label}`,
            data: frameHistory.map(f => {
              const gd = f.groups[group.id]
              if (!gd) return 0
              if (el.key === '_etotal') return gd.eMech
              if (el.key === '_Q') return Math.max(0, e0 - gd.eMech)
              return gd[el.key as keyof GroupFrameData] as number
            }),
            borderColor: el.color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: el.dash ?? [],
            pointRadius: 0,
            tension: 0.1,
          })
        }
      }

      return { labels, datasets }
    }

    // 普通模式：每个物体一条线
    for (const body of activeBodies) {
      const colorIdx = dynamicBodies.findIndex(b => b.id === body.id)
      const color = getChartColor(colorIdx)
      datasets.push({
        label: body.label,
        data: frameHistory.map(f => {
          const bd = f.bodies[body.id]
          if (!bd) return 0
          return bd[dataKey as keyof BodyFrameData] as number
        }),
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.1,
      })
    }

    // 分析组线（仅系统级可解释字段）
    const groupKey = GROUP_DATA_KEY_MAP[dataKey]
    if (groupKey && groupKey !== '_energy') {
      for (const group of activeGroups) {
        datasets.push({
          label: getGroupDatasetLabel(group.name, dataKey),
          data: frameHistory.map(f => {
            const gd = f.groups[group.id]
            if (!gd) return 0
            return gd[groupKey as keyof GroupFrameData] as number
          }),
          borderColor: group.color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          tension: 0.1,
        })
      }
    }

    return { labels, datasets }
  }, [frameHistory, activeDataSourceIds, dynamicBodies, dataKey, isEnergy, isVelocityComponents, analysisGroups])

  // 图内竖线标注：时间回溯游标 + 碰撞线（p-t）
  const annotations = useMemo<Record<string, AnnotationOptions>>(() => {
    const result: Record<string, AnnotationOptions> = {}

    // 时间回溯游标：非播放态且当前时间早于轨迹末端时显示
    const isRewound = simState !== 'playing' && frameHistory.length > 1 && (maxTime - currentTime) > 1e-3
    let seekIndex = -1
    let seekTimeLabel = ''
    if (isRewound) {
      let nearestIndex = 0
      let minDelta = Math.abs(frameHistory[0].t - currentTime)
      for (let i = 1; i < frameHistory.length; i++) {
        const delta = Math.abs(frameHistory[i].t - currentTime)
        if (delta < minDelta) {
          minDelta = delta
          nearestIndex = i
        }
      }
      seekIndex = nearestIndex
      seekTimeLabel = frameHistory[nearestIndex].t.toFixed(2)
      result['seek-cursor'] = {
        type: 'line',
        xMin: seekTimeLabel,
        xMax: seekTimeLabel,
        borderColor: '#6b7280',
        borderWidth: 1.2,
        borderDash: [6, 4],
        label: {
          display: true,
          content: `t=${currentTime.toFixed(2)}s`,
          position: 'start',
          backgroundColor: '#6b728033',
          color: '#374151',
          font: { size: 9 },
        },
      }

      // 回溯时：在竖线与每条曲线交点处显示数值
      for (let i = 0; i < data.datasets.length; i++) {
        const ds = data.datasets[i]
        const raw = ds.data[seekIndex]
        const y = typeof raw === 'number' ? raw : Number(raw)
        if (!Number.isFinite(y)) continue
        const lineColor = typeof ds.borderColor === 'string' ? ds.borderColor : '#111111'

        result[`seek-point-${i}`] = {
          type: 'point',
          xValue: seekTimeLabel,
          yValue: y,
          radius: 2.6,
          backgroundColor: lineColor,
          borderColor: '#ffffff',
          borderWidth: 1,
        }

        result[`seek-value-${i}`] = {
          type: 'label',
          xValue: seekTimeLabel,
          yValue: y,
          xAdjust: 10,
          yAdjust: i % 2 === 0 ? -8 : 8,
          backgroundColor: '#ffffffdd',
          borderColor: lineColor,
          borderWidth: 1,
          color: '#111111',
          padding: 3,
          font: { size: 9 },
          content: Number(y).toFixed(2),
        }
      }
    }

    if (!isMomentum || collisionEvents.length === 0) return result

    for (let i = 0; i < collisionEvents.length; i++) {
      const event = collisionEvents[i]
      // 找到最近的时间标签索引
      const tStr = event.t.toFixed(2)
      result[`collision-${i}`] = {
        type: 'line',
        xMin: tStr,
        xMax: tStr,
        borderColor: '#ef4444',
        borderWidth: 1,
        borderDash: [4, 4],
        label: {
          display: true,
          content: '碰撞',
          position: 'start',
          backgroundColor: '#ef444480',
          color: '#fff',
          font: { size: 9 },
        },
      }
    }
    return result
  }, [isMomentum, collisionEvents, frameHistory, currentTime, maxTime, simState, data.datasets])

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        title: { display: true, text: '时间 (s)', font: { size: 11 } },
        ticks: {
          maxTicksLimit: 10,
          font: { size: 10 },
        },
      },
      y: {
        title: { display: true, text: yLabel, font: { size: 11 } },
        ticks: { font: { size: 10 } },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { font: { size: 10 }, boxWidth: 12, padding: 6 },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(3)}`,
        },
      },
      annotation: {
        annotations,
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
  }), [yLabel, annotations])

  return (
    <div style={{ flex: 1, minWidth: 0, padding: '4px 8px' }}>
      <Line ref={chartRef} data={data} options={options} />
    </div>
  )
}
