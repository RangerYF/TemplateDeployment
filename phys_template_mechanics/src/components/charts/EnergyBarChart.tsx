import { useMemo, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { useAnalysisStore } from '@/store/analysisStore'
import { useSceneStore } from '@/store/sceneStore'
import type { ChartOptions } from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
)

/** P-14 配色 */
const BAR_COLORS = {
  ek: '#F44336',
  epGravity: '#2196F3',
  epSpring: '#4CAF50',
  Q: '#FF9800',
}

export function EnergyBarChart() {
  const frameHistory = useAnalysisStore(s => s.frameHistory)
  const activeDataSourceIds = useAnalysisStore(s => s.activeDataSourceIds)
  const analysisGroups = useAnalysisStore(s => s.analysisGroups)
  const bodies = useSceneStore(s => s.scene.bodies)
  const chartRef = useRef<ChartJS<'bar'>>(null)

  const dynamicBodies = useMemo(
    () => bodies.filter(b => !b.isStatic),
    [bodies],
  )

  const data = useMemo(() => {
    const activeIds = Array.from(activeDataSourceIds)
    const bodyIds = activeIds.filter(id => !id.startsWith('group:'))
    const activeBodies = dynamicBodies.filter(b => bodyIds.includes(b.id))
    const groupIds = activeIds.filter(id => id.startsWith('group:')).map(id => id.slice(6))
    const activeGroups = analysisGroups.filter(g => groupIds.includes(g.id))

    const lastFrame = frameHistory[frameHistory.length - 1]
    const firstFrame = frameHistory[0]

    // X 轴：每个物体 + 每个分析组一组柱子
    const labels = [
      ...activeBodies.map(b => b.label),
      ...activeGroups.map(g => g.name),
    ]

    const getBodyValue = (bodyId: string, field: 'ek' | 'epGravity' | 'epSpring' | 'Q') => {
      if (!lastFrame) return 0
      const bd = lastFrame.bodies[bodyId]
      if (!bd) return 0
      if (field === 'Q') {
        const fd = firstFrame?.bodies[bodyId]
        if (!fd) return 0
        const e0 = fd.ek + fd.epGravity + fd.epSpring
        const eNow = bd.ek + bd.epGravity + bd.epSpring
        return Math.max(0, e0 - eNow)
      }
      return bd[field]
    }

    const getGroupValue = (groupId: string, field: 'ek' | 'epGravity' | 'epSpring' | 'Q') => {
      if (!lastFrame) return 0
      const gd = lastFrame.groups[groupId]
      if (!gd) return 0
      if (field === 'Q') {
        const fg = firstFrame?.groups[groupId]
        if (!fg) return 0
        return Math.max(0, fg.eMech - gd.eMech)
      }
      return gd[field as keyof typeof gd] as number
    }

    const datasets = [
      {
        label: 'Ek',
        data: [
          ...activeBodies.map(b => getBodyValue(b.id, 'ek')),
          ...activeGroups.map(g => getGroupValue(g.id, 'ek')),
        ],
        backgroundColor: BAR_COLORS.ek,
      },
      {
        label: 'Ep(重)',
        data: [
          ...activeBodies.map(b => getBodyValue(b.id, 'epGravity')),
          ...activeGroups.map(g => getGroupValue(g.id, 'epGravity')),
        ],
        backgroundColor: BAR_COLORS.epGravity,
      },
      {
        label: 'Ep(弹)',
        data: [
          ...activeBodies.map(b => getBodyValue(b.id, 'epSpring')),
          ...activeGroups.map(g => getGroupValue(g.id, 'epSpring')),
        ],
        backgroundColor: BAR_COLORS.epSpring,
      },
      {
        label: 'Q',
        data: [
          ...activeBodies.map(b => getBodyValue(b.id, 'Q')),
          ...activeGroups.map(g => getGroupValue(g.id, 'Q')),
        ],
        backgroundColor: BAR_COLORS.Q,
      },
    ]

    return { labels, datasets }
  }, [frameHistory, activeDataSourceIds, dynamicBodies, analysisGroups])

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        ticks: { font: { size: 10 } },
      },
      y: {
        title: { display: true, text: '能量 (J)', font: { size: 11 } },
        ticks: { font: { size: 10 } },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { font: { size: 10 }, boxWidth: 12, padding: 6 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(3)} J`,
        },
      },
    },
  }), [])

  return (
    <div style={{ flex: 1, minWidth: 0, padding: '4px 8px' }}>
      <Bar ref={chartRef} data={data} options={options} />
    </div>
  )
}
