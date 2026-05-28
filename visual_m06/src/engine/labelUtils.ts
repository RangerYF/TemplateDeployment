import type { DemoEntity } from '@/editor/demo/demoTypes';

const TYPE_LABELS: Record<string, string> = {
  demoVector: '向量',
  demoMarker: '标记点',
  demoSlider: '滑块',
  demoPoint: '端点',
};

export function findLabelConflict(
  label: string,
  entities: Record<string, DemoEntity>,
  excludeId?: string,
): string | null {
  if (!label) return null;
  for (const e of Object.values(entities)) {
    if (excludeId && e.id === excludeId) continue;
    if ('label' in e && (e as { label: string }).label === label) {
      return TYPE_LABELS[e.type] ?? e.type;
    }
  }
  return null;
}
