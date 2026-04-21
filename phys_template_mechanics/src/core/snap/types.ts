export interface SnapSurface {
  type: 'rest' | 'contact'
  // 'rest' = supporting surface (other objects can be placed on top)
  // 'contact' = contact surface (this object's surface that rests on others)

  // World-coordinate line segment
  start: { x: number; y: number }
  end: { x: number; y: number }

  // Outward normal direction (normalized, world coordinates)
  normal: { x: number; y: number }

  // Optional local geometry metadata for computing snap pose after rotation.
  localStart?: { x: number; y: number }
  localEnd?: { x: number; y: number }
  localNormal?: { x: number; y: number }
}

export interface SnapResult {
  // Snapped position for the body
  position: { x: number; y: number }
  // Snapped angle for the body
  angle: number
  // The target rest surface being snapped to
  targetSurface: SnapSurface
  // Distance before snapping (for threshold comparison)
  distance: number
}
