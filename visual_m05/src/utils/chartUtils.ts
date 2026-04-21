// chartUtils.ts — Canvas 2D utilities (deprecated, renderers now use SVG)
// Kept as minimal module to avoid breaking any stray imports during transition

export function formatNumber(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  return n.toFixed(decimals);
}
