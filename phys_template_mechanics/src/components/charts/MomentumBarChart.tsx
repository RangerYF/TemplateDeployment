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
import annotationPlugin from 'chartjs-plugin-annotation'
import { Bar } from 'react-chartjs-2'
import { useAnalysisStore } from '@/store/analysisStore'
import { useSceneStore } from '@/store/sceneStore'
import { getChartColor } from '@/components/charts/chartColors'
import type { ChartOptions } from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin,
)

export function MomentumBarChart() {
  const frameHistory = useAnalysisStore(s => s.frameHistory)
  const activeDataSourceIds = useAnalysisStore(s => s.activeDataSourceIds)
  const collisionSnapshot = useAnalysisStore(s => s.collisionSnapshot)
  const bodies = useSceneStore(s => s.scene.bodies)
  const chartRef = useRef<ChartJS<'bar'>>(null)

  const dynamicBodies = useMemo(
    () => bodies.filter(b => !b.isStatic),
    [bodies],
  )

  const hasCollision = collisionSnapshot !== null

  const data = useMemo(() => {
    const activeIds = Array.from(activeDataSourceIds).filter(id => !id.startsWith('group:'))
    const activeBodies = dynamicBodies.filter(b => activeIds.includes(b.id))
    const lastFrame = frameHistory[frameHistory.length - 1]

    const labels = activeBodies.map(b => b.label)

    // 当前动量
    const currentData = activeBodies.map(b => {
      const bd = lastFrame?.bodies[b.id]
      return bd ? bd.momentum : 0
    })
    const currentColors = activeBodies.map(b => {
      const idx = dynamicBodies.findIndex(d => d.id === b.id)
      return getChartColor(idx)
    })

    const datasets: {
      label: string
      data: number[]
      backgroundColor: string | string[]
      borderColor?: string | string[]
      borderWidth?: number
    }[] = []

    if (hasCollision) {
      // 碰撞前快照
      const beforeData = activeBodies.map(b => {
        const bd = collisionSnapshot[b.id]
        return bd ? bd.momentum : 0
      })
      const beforeColors = currentColors.map(c => c + '80') // 半透明

      datasets.push({
        label: '碰撞前',
        data: beforeData,
        backgroundColor: beforeColors,
        borderColor: currentColors,
        borderWidth: 1,
      })
      datasets.push({
        label: '碰撞后（当前）',
        data: currentData,
        backgroundColor: currentColors,
      })
    } else {
      datasets.push({
        label: '动量 |p|',
        data: currentData,
        backgroundColor: currentColors,
      })
    }

    return { labels, datasets }
  }, [frameHistory, activeDataSourceIds, dynamicBodies, hasCollision, collisionSnapshot])

  // Σp 参考线
  const annotations = useMemo(() => {
    if (!hasCollision) return {}
    const activeIds = Array.from(activeDataSourceIds).filter(id => !id.startsWith('group:'))
    const activeBodies = dynamicBodies.filter(b => activeIds.includes(b.id))
    const lastFrame = frameHistory[frameHistory.length - 1]

    let sumBefore = 0, sumAfter = 0
    for (const b of activeBodies) {
      const bd = collisionSnapshot?.[b.id]
      if (bd) sumBefore += bd.momentum
      const cd = lastFrame?.bodies[b.id]
      if (cd) sumAfter += cd.momentum
    }

    return {
      sumBefore: {
        type: 'line' as const,
        yMin: sumBefore,
        yMax: sumBefore,
        borderColor: '#9E9E9E',
        borderWidth: 1.5,
        borderDash: [6, 3],
        label: {
          display: true,
          content: `Σp前=${sumBefore.toFixed(2)}`,
          position: 'start' as const,
          backgroundColor: '#9E9E9E80',
          color: '#fff',
          font: { size: 9 },
        },
      },
      sumAfter: {
        type: 'line' as const,
        yMin: sumAfter,
        yMax: sumAfter,
        borderColor: '#3b82f6',
        borderWidth: 1.5,
        borderDash: [6, 3],
        label: {
          display: true,
          content: `Σp后=${sumAfter.toFixed(2)}`,
          position: 'end' as const,
          backgroundColor: '#3b82f680',
          color: '#fff',
          font: { size: 9 },
        },
      },
    }
  }, [hasCollision, activeDataSourceIds, dynamicBodies, frameHistory, collisionSnapshot])

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        ticks: { font: { size: 10 } },
      },
      y: {
        title: { display: true, text: '动量 (kg·m/s)', font: { size: 11 } },
        ticks: { font: { size: 10 } },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        display: hasCollision,
        position: 'top' as const,
        labels: { font: { size: 10 }, boxWidth: 12, padding: 6 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(3)} kg·m/s`,
        },
      },
      annotation: {
        annotations,
      },
    },
  }), [hasCollision, annotations])

  return (
    <div style={{ flex: 1, minWidth: 0, padding: '4px 8px' }}>
      <Bar ref={chartRef} data={data} options={options} />
    </div>
  )
}
