/** Point-in-polygon test using ray casting */
export function pointInPolygon(
  px: number,
  py: number,
  vertices: Array<{ x: number; y: number }>,
): boolean {
  const n = vertices.length
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y
    const xj = vertices[j].x, yj = vertices[j].y
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Cross product sign test for point-in-triangle */
export function pointInTriangle(
  px: number,
  py: number,
  v0: { x: number; y: number },
  v1: { x: number; y: number },
  v2: { x: number; y: number },
): boolean {
  const cross = (ax: number, ay: number, bx: number, by: number) =>
    ax * by - ay * bx

  const d0 = cross(v1.x - v0.x, v1.y - v0.y, px - v0.x, py - v0.y)
  const d1 = cross(v2.x - v1.x, v2.y - v1.y, px - v1.x, py - v1.y)
  const d2 = cross(v0.x - v2.x, v0.y - v2.y, px - v2.x, py - v2.y)

  const hasNeg = d0 < 0 || d1 < 0 || d2 < 0
  const hasPos = d0 > 0 || d1 > 0 || d2 > 0

  return !(hasNeg && hasPos)
}
