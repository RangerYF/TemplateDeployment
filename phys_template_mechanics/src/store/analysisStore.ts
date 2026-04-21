import { create } from 'zustand'
import type { FrameRecord } from '@/engine/AnalysisRecorder'

export interface AnalysisGroup {
  id: string
  name: string
  bodyIds: string[]
  color: string
}

export interface CollisionEvent {
  t: number
  bodyIdA: string
  bodyIdB: string
  impulse: number
}

export interface TabDef {
  key: string
  label: string
  dataKey: string   // BodyFrameData 中的字段名
  yLabel: string    // Y 轴标签
  tooltip: string   // 标签页 hover 说明
}

export interface TabGroup {
  label: string
  tabs: TabDef[]
}

/** 按分析主题分组的标签页 */
export const TAB_GROUPS: TabGroup[] = [
  {
    label: '运动',
    tabs: [
      { key: 'v-t', label: 'v-t', dataKey: 'speed', yLabel: '速率 (m/s)', tooltip: '速率-时间图：匀速运动为水平线，匀加速为斜线' },
      { key: 'vxy-t', label: 'v分-t', dataKey: '_velocityComponents', yLabel: '速度分量 (m/s)', tooltip: '速度分量图：在同一张图中同时观察 vx 与 vy 的时间变化，适合平抛、斜抛和传送带场景' },
      { key: 'vx-t', label: 'vx-t', dataKey: 'vx', yLabel: '横向速度 (m/s)', tooltip: '横向速度-时间图：适合平抛、斜抛、传送带与双物体相对运动分析' },
      { key: 'vy-t', label: 'vy-t', dataKey: 'vy', yLabel: '纵向速度 (m/s)', tooltip: '纵向速度-时间图：适合平抛、斜抛和竖直方向受力分析' },
      { key: 'a-t', label: 'a-t', dataKey: 'accel', yLabel: '加速度 (m/s²)', tooltip: '加速度-时间图：恒力作用下为水平线' },
      { key: 'x-t', label: 'x-t', dataKey: 'displacement', yLabel: '位移 (m)', tooltip: '位移-时间图：观察物体离初始位置的距离变化' },
    ],
  },
  {
    label: '能量',
    tabs: [
      { key: 'E-t', label: 'E-t', dataKey: '_energy', yLabel: '能量 (J)', tooltip: '能量-时间图：追踪动能、势能、总能量，验证能量守恒' },
      { key: 'E-bar', label: 'E柱', dataKey: '_energyBar', yLabel: '能量 (J)', tooltip: '能量柱状图：对比当前时刻各物体的动能、势能和摩擦热' },
    ],
  },
  {
    label: '诊断',
    tabs: [
      { key: 'Em-t', label: 'E机-t', dataKey: 'eMech', yLabel: '机械能 (J)', tooltip: '机械能-时间图：用于观察额外耗散或守恒偏离' },
      { key: 'dL-t', label: 'ΔL-t', dataKey: 'jointError', yLabel: '约束误差 (m)', tooltip: '约束长度误差：观察绳/杆长度相对目标值的偏离' },
      { key: 'slack-t', label: 'slack-t', dataKey: 'ropeSlack', yLabel: '松绳深度 (m)', tooltip: '绳松弛深度：大于 0 表示绳约束未被拉紧' },
      { key: 'vb-t', label: 'v底-t', dataKey: 'bottomPeakSpeed', yLabel: '底点峰值速率 (m/s)', tooltip: '最近一次底点峰值速率，适合观察逐圈衰减' },
      { key: 'vtop-t', label: 'v顶-t', dataKey: 'topPeakSpeed', yLabel: '顶点峰值速率 (m/s)', tooltip: '最近一次顶点峰值速率，适合观察逐圈衰减' },
      { key: 'tb-t', label: 'T底-t', dataKey: 'bottomPeakTension', yLabel: '底点峰值拉力 (N)', tooltip: '最近一次底点峰值拉力，适合观察圆周运动关键点受力' },
      { key: 'ttop-t', label: 'T顶-t', dataKey: 'topPeakTension', yLabel: '顶点峰值拉力 (N)', tooltip: '最近一次顶点峰值拉力，适合观察圆周运动关键点受力' },
    ],
  },
  {
    label: '动量',
    tabs: [
      { key: 'p-t', label: 'p-t', dataKey: 'momentum', yLabel: '动量 (kg·m/s)', tooltip: '动量-时间图：系统总动量水平线 = 动量守恒' },
      { key: 'p-bar', label: 'p柱', dataKey: '_momentumBar', yLabel: '动量 (kg·m/s)', tooltip: '动量柱状图：对比各物体动量，碰撞后自动显示碰前/碰后对比' },
    ],
  },
]

/** 所有标签页（扁平列表，用于查找） */
export const ALL_TABS: TabDef[] = TAB_GROUPS.flatMap(g => g.tabs)

interface AnalysisState {
  // 分析组管理
  analysisGroups: AnalysisGroup[]

  // 数据源勾选（bodyId 或 "group:groupId"）
  activeDataSourceIds: Set<string>

  // 当前选中的标签页（支持 1-2 个并排）
  activeTabs: string[]

  // 帧历史（核心）
  frameHistory: FrameRecord[]
  maxFrames: number

  // 仿真时间
  simTime: number

  // 初始位置快照（用于计算位移）
  initialPositions: Record<string, { x: number; y: number }>

  // 碰撞事件
  collisionEvents: CollisionEvent[]

  // 碰撞快照（碰撞前一帧的 bodies 数据，用于 p 柱对比）
  collisionSnapshot: Record<string, import('@/engine/AnalysisRecorder').BodyFrameData> | null
}

interface AnalysisActions {
  pushFrame: (record: FrameRecord) => void
  clearHistory: () => void
  resetForScene: () => void
  setInitialPositions: (pos: Record<string, { x: number; y: number }>) => void
  toggleDataSource: (id: string) => void
  setDataSources: (ids: Set<string>) => void
  toggleTab: (tab: string) => void
  addGroup: (group: AnalysisGroup) => void
  removeGroup: (id: string) => void
  updateGroup: (id: string, patch: Partial<Pick<AnalysisGroup, 'name' | 'bodyIds'>>) => void
  removeBodyFromGroups: (bodyId: string) => void
  addCollisionEvent: (event: CollisionEvent) => void
  setCollisionSnapshot: (snapshot: Record<string, import('@/engine/AnalysisRecorder').BodyFrameData> | null) => void
  seekToTime: (t: number) => void
  trimToTime: (t: number) => void
}

/** 生成分析组自动名称 */
function nextGroupName(groups: AnalysisGroup[]): string {
  let idx = 1
  const names = new Set(groups.map(g => g.name))
  while (names.has(`系统${idx}`)) idx++
  return `系统${idx}`
}

export const useAnalysisStore = create<AnalysisState & AnalysisActions>()(
  (set, get) => ({
    analysisGroups: [],
    activeDataSourceIds: new Set<string>(),
    activeTabs: ['v-t'],
    frameHistory: [],
    maxFrames: 1800,
    simTime: 0,
    initialPositions: {},
    collisionEvents: [],
    collisionSnapshot: null,

    pushFrame: (record) => {
      const { frameHistory, maxFrames } = get()
      const next = [...frameHistory, record]
      if (next.length > maxFrames) {
        next.splice(0, next.length - maxFrames)
      }
      set({ frameHistory: next, simTime: record.t })
    },

    clearHistory: () => {
      set({ frameHistory: [], simTime: 0, collisionEvents: [], collisionSnapshot: null })
    },

    resetForScene: () => {
      set((state) => ({
        analysisGroups: [],
        activeDataSourceIds: new Set<string>(),
        frameHistory: [],
        maxFrames: state.maxFrames,
        simTime: 0,
        initialPositions: {},
        collisionEvents: [],
        collisionSnapshot: null,
      }))
    },

    setInitialPositions: (pos) => {
      set({ initialPositions: pos })
    },

    toggleDataSource: (id) => {
      const next = new Set(get().activeDataSourceIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      set({ activeDataSourceIds: next })
    },

    setDataSources: (ids) => {
      set({ activeDataSourceIds: ids })
    },

    toggleTab: (tab) => {
      const { activeTabs } = get()
      if (activeTabs.includes(tab)) {
        // 取消选中（但至少保留 1 个）
        if (activeTabs.length > 1) {
          set({ activeTabs: activeTabs.filter(t => t !== tab) })
        }
      } else {
        // 添加选中（最多 2 个，超出则替换最早的）
        if (activeTabs.length >= 2) {
          set({ activeTabs: [activeTabs[1], tab] })
        } else {
          set({ activeTabs: [...activeTabs, tab] })
        }
      }
    },

    addGroup: (group) => {
      const { analysisGroups } = get()
      // 自动命名（如果未指定）
      const name = group.name || nextGroupName(analysisGroups)
      set({ analysisGroups: [...analysisGroups, { ...group, name }] })
    },

    removeGroup: (id) => {
      const { analysisGroups, activeDataSourceIds } = get()
      const next = analysisGroups.filter(g => g.id !== id)
      const nextIds = new Set(activeDataSourceIds)
      nextIds.delete(`group:${id}`)
      set({ analysisGroups: next, activeDataSourceIds: nextIds })
    },

    updateGroup: (id, patch) => {
      const { analysisGroups } = get()
      set({
        analysisGroups: analysisGroups.map(g =>
          g.id === id ? { ...g, ...patch } : g,
        ),
      })
    },

    removeBodyFromGroups: (bodyId) => {
      const { analysisGroups, activeDataSourceIds } = get()
      const updated: AnalysisGroup[] = []
      const removedGroupIds: string[] = []
      for (const g of analysisGroups) {
        const filtered = g.bodyIds.filter(id => id !== bodyId)
        if (filtered.length === 0) {
          removedGroupIds.push(g.id)
        } else {
          updated.push(filtered.length === g.bodyIds.length ? g : { ...g, bodyIds: filtered })
        }
      }
      if (removedGroupIds.length > 0) {
        const nextIds = new Set(activeDataSourceIds)
        for (const gid of removedGroupIds) nextIds.delete(`group:${gid}`)
        set({ analysisGroups: updated, activeDataSourceIds: nextIds })
      } else {
        set({ analysisGroups: updated })
      }
    },

    addCollisionEvent: (event) => {
      set({ collisionEvents: [...get().collisionEvents, event] })
    },

    setCollisionSnapshot: (snapshot) => {
      set({ collisionSnapshot: snapshot })
    },

    seekToTime: (t) => {
      set({
        simTime: t,
        collisionSnapshot: null,
      })
    },

    trimToTime: (t) => {
      set((state) => ({
        simTime: t,
        frameHistory: state.frameHistory.filter((f) => f.t <= t + 1e-6),
        collisionEvents: state.collisionEvents.filter((e) => e.t <= t + 1e-6),
        collisionSnapshot: null,
      }))
    },
  }),
)
