import type { ForceType } from '../types'
import type { ForceTypeDescriptor } from './descriptor'

const registry = new Map<ForceType, ForceTypeDescriptor>()

export function registerForceType(desc: ForceTypeDescriptor): void {
  registry.set(desc.type, desc)
}

export function getForceDescriptor(type: ForceType): ForceTypeDescriptor | undefined {
  return registry.get(type)
}

export function getAllForceDescriptors(): ForceTypeDescriptor[] {
  return Array.from(registry.values())
}
