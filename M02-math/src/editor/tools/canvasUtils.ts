/**
 * HiDPI canvas utilities shared by all tools that render on the dynamic layer.
 */

/**
 * Clear a HiDPI canvas and set the devicePixelRatio transform
 * so subsequent drawing uses CSS-pixel coordinates.
 */
export function hiDpiClear(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
