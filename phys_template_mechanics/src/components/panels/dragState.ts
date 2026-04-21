import type { JointType } from '@/models/types'

/** Shared drag state between ObjectPanel and Canvas.
 *  Module-level variable because browser security prevents getData during dragenter/dragover. */
let _currentDragBodyType: string | null = null
let _currentDragJointType: JointType | null = null
let _pendingJointType: JointType | null = null

export function setCurrentDragBodyType(type: string | null): void {
  _currentDragBodyType = type
}

export function getCurrentDragBodyType(): string | null {
  return _currentDragBodyType
}

export function setCurrentDragJointType(type: JointType | null): void {
  _currentDragJointType = type
}

export function getCurrentDragJointType(): JointType | null {
  return _currentDragJointType
}

export function setPendingJointType(type: JointType | null): void {
  _pendingJointType = type
}

export function getPendingJointType(): JointType | null {
  return _pendingJointType
}

export function consumePendingJointType(): JointType | null {
  const type = _pendingJointType
  _pendingJointType = null
  return type
}
