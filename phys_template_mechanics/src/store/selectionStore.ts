import { create } from 'zustand'

export type SelectableObject =
  | { type: 'body'; id: string }
  | { type: 'joint'; id: string }

interface SelectionState {
  selected: SelectableObject[]
  hovered: SelectableObject | null
  // 力选中独立于物体/约束选中
  selectedForceId: string | null
  hoveredForceId: string | null
}

interface SelectionActions {
  /** 单选：清除已有，仅选中 obj */
  select: (obj: SelectableObject) => void
  /** 追加到选中集合 */
  addToSelection: (obj: SelectableObject) => void
  /** 从选中集合移除 */
  removeFromSelection: (obj: SelectableObject) => void
  /** 有则移除，无则追加（Shift+点击） */
  toggleSelection: (obj: SelectableObject) => void
  /** 直接设置整个选中集合（框选） */
  setSelection: (objs: SelectableObject[]) => void
  /** 清空选中 */
  clearSelection: () => void
  /** 兼容别名 */
  deselect: () => void
  setHovered: (obj: SelectableObject | null) => void
  selectForce: (id: string) => void
  deselectForce: () => void
  setHoveredForce: (id: string | null) => void
}

/** 比较两个 SelectableObject 是否相同 */
function isSameObject(a: SelectableObject, b: SelectableObject): boolean {
  return a.type === b.type && a.id === b.id
}

export const useSelectionStore = create<SelectionState & SelectionActions>()(
  (set) => ({
    selected: [],
    hovered: null,
    selectedForceId: null,
    hoveredForceId: null,

    select: (obj) => set({ selected: [obj] }),

    addToSelection: (obj) =>
      set((state) => {
        if (state.selected.some((s) => isSameObject(s, obj))) return state
        return { selected: [...state.selected, obj] }
      }),

    removeFromSelection: (obj) =>
      set((state) => ({
        selected: state.selected.filter((s) => !isSameObject(s, obj)),
      })),

    toggleSelection: (obj) =>
      set((state) => {
        const exists = state.selected.some((s) => isSameObject(s, obj))
        if (exists) {
          return { selected: state.selected.filter((s) => !isSameObject(s, obj)) }
        }
        return { selected: [...state.selected, obj] }
      }),

    setSelection: (objs) => set({ selected: objs }),

    clearSelection: () => set({ selected: [], selectedForceId: null }),

    deselect: () => set({ selected: [], selectedForceId: null }),

    setHovered: (obj) => set({ hovered: obj }),

    selectForce: (id) => set({ selectedForceId: id }),

    deselectForce: () => set({ selectedForceId: null }),

    setHoveredForce: (id) => set({ hoveredForceId: id }),
  }),
)

// ─── 便捷 selectors ───

export const selectedBodyIds = (state: SelectionState) =>
  state.selected.filter((s) => s.type === 'body').map((s) => s.id)

export const selectedJointIds = (state: SelectionState) =>
  state.selected.filter((s) => s.type === 'joint').map((s) => s.id)

export const primarySelected = (state: SelectionState) =>
  state.selected[0] ?? null
