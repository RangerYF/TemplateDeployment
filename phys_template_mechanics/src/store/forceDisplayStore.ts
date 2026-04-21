import { create } from 'zustand'
import type { ForceData } from '@/engine/types'

/**
 * 力显示状态管理
 * - availableForces: Canvas 计算/收集的力数据（编辑模式 probe / 仿真模式 collect）
 * - hiddenForceKeys: 被隐藏的力标识集合
 *   key 格式: "${bodyId}:${forceType}" 或 "${bodyId}:external:${sourceId}"
 */

export function forceKey(f: ForceData): string {
  if (f.forceType === 'external' && f.sourceId) {
    return `${f.bodyId}:external:${f.sourceId}`
  }
  if (f.sourceId?.includes(':teaching:')) {
    return f.sourceId
  }
  if (f.forceType === 'resultant') {
    return `${f.bodyId}:resultant`
  }
  return `${f.bodyId}:${f.forceType}`
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

interface ForceDisplayState {
  availableForces: ForceData[]
  hiddenForceKeys: Set<string>
  /** 用户手动操作过的 key（toggle/showAll/hideAll），不会被自动隐藏逻辑覆盖 */
  _manualOverrides: Set<string>
  /** 正在正交分解的力 key 集合 */
  decomposedForceKeys: Set<string>
}

interface ForceDisplayActions {
  setAvailableForces: (forces: ForceData[], staticBodyIds?: Set<string>) => void
  toggleForce: (key: string) => void
  showAllForBody: (bodyId: string) => void
  hideAllForBody: (bodyId: string, keys: string[]) => void
  isForceVisible: (key: string) => boolean
  toggleDecompose: (key: string) => void
  resetDisplay: () => void
}

export const useForceDisplayStore = create<ForceDisplayState & ForceDisplayActions>()(
  (set, get) => ({
    availableForces: [],
    hiddenForceKeys: new Set(),
    _manualOverrides: new Set(),
    decomposedForceKeys: new Set(),

    setAvailableForces: (forces, staticBodyIds) => {
      const state = get()
      const activeKeys = new Set(forces.map((force) => forceKey(force)))

      const nextManualOverrides = new Set(
        [...state._manualOverrides].filter((key) => activeKeys.has(key)),
      )
      const nextDecomposed = new Set(
        [...state.decomposedForceKeys].filter((key) => activeKeys.has(key)),
      )
      const nextHidden = new Set(
        [...state.hiddenForceKeys].filter((key) => activeKeys.has(key)),
      )

      if (staticBodyIds) {
        // 静态/默认隐藏类物体的力默认隐藏（除非用户手动操作过）
        for (const f of forces) {
          if (!staticBodyIds.has(f.bodyId)) continue
          const key = forceKey(f)
          if (!nextManualOverrides.has(key)) {
            nextHidden.add(key)
          }
        }
      }

      const patch: Partial<ForceDisplayState> = { availableForces: forces }
      if (!setsEqual(nextHidden, state.hiddenForceKeys)) {
        patch.hiddenForceKeys = nextHidden
      }
      if (!setsEqual(nextManualOverrides, state._manualOverrides)) {
        patch._manualOverrides = nextManualOverrides
      }
      if (!setsEqual(nextDecomposed, state.decomposedForceKeys)) {
        patch.decomposedForceKeys = nextDecomposed
      }
      set(patch)
    },

    toggleForce: (key) =>
      set((state) => {
        const next = new Set(state.hiddenForceKeys)
        const overrides = new Set(state._manualOverrides)
        overrides.add(key)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return { hiddenForceKeys: next, _manualOverrides: overrides }
      }),

    showAllForBody: (bodyId) =>
      set((state) => {
        const next = new Set(state.hiddenForceKeys)
        const overrides = new Set(state._manualOverrides)
        // 遍历 hiddenForceKeys 中已有的
        for (const k of next) {
          if (k.startsWith(`${bodyId}:`)) {
            next.delete(k)
            overrides.add(k)
          }
        }
        // 同时标记所有 available forces 的 key 为手动覆盖（防止仿真中新力被自动隐藏）
        for (const f of state.availableForces) {
          if (f.bodyId === bodyId) {
            overrides.add(forceKey(f))
          }
        }
        return { hiddenForceKeys: next, _manualOverrides: overrides }
      }),

    hideAllForBody: (bodyId, keys) =>
      set((state) => {
        const next = new Set(state.hiddenForceKeys)
        const overrides = new Set(state._manualOverrides)
        for (const k of keys) {
          if (k.startsWith(`${bodyId}:`)) {
            next.add(k)
            overrides.add(k)
          }
        }
        return { hiddenForceKeys: next, _manualOverrides: overrides }
      }),

    isForceVisible: (key) => !get().hiddenForceKeys.has(key),

    toggleDecompose: (key) =>
      set((state) => {
        const next = new Set(state.decomposedForceKeys)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return { decomposedForceKeys: next }
      }),

    resetDisplay: () =>
      set({
        availableForces: [],
        hiddenForceKeys: new Set(),
        _manualOverrides: new Set(),
        decomposedForceKeys: new Set(),
      }),
  }),
)
