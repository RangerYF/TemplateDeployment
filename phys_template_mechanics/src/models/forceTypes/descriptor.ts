import type { ForceType, SceneForce } from '../types'

export interface ForceTypeDescriptor {
  type: ForceType
  label: string
  icon: string
  color: string
  letterSymbol: string
  chineseName: string
  defaults: Partial<SceneForce>
  // 渲染和 hitTest 在 6.3 补充
}
