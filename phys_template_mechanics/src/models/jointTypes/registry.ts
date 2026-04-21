import type { JointType } from '../types'
import type { JointTypeDescriptor } from './descriptor'

const registry = new Map<JointType, JointTypeDescriptor>()

export function registerJointType(desc: JointTypeDescriptor): void {
  registry.set(desc.type, desc)
}

export function getJointDescriptor(type: JointType): JointTypeDescriptor | undefined {
  return registry.get(type)
}

export function getAllJointDescriptors(): JointTypeDescriptor[] {
  return Array.from(registry.values())
}
