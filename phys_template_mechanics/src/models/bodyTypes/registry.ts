import type { BodyType } from '../types'
import type { BodyTypeDescriptor } from './descriptor'
import { _setDescriptorLookup } from './descriptor'

const registry = new Map<BodyType, BodyTypeDescriptor>()

// Wire up the descriptor lookup for getInteraction() (breaks circular import)
_setDescriptorLookup((type) => registry.get(type))

export function registerBodyType(desc: BodyTypeDescriptor): void {
  registry.set(desc.type, desc)
}

export function getBodyDescriptor(type: BodyType): BodyTypeDescriptor {
  const desc = registry.get(type)
  if (!desc) throw new Error(`Unknown body type: ${type}`)
  return desc
}

export function getAllDescriptors(): BodyTypeDescriptor[] {
  return Array.from(registry.values())
}

export function getDescriptorsByCategory(cat: string): BodyTypeDescriptor[] {
  return getAllDescriptors().filter(d => d.category === cat)
}
