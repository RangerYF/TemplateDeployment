import { useSimulationStore } from '@/store';
import type { ViewportType } from '@/core/types';

const VIEWPORT_LABELS: Record<ViewportType, string> = {
  force: '受力',
  motion: '运动',
  energy: '能量',
  momentum: '动量',
  field: '场',
  circuit: '电路',
};

/**
 * 视角切换栏 — 显示当前预设支持的视角，允许切换
 */
export function ViewportBar() {
  const supportedViewports = useSimulationStore((s) => s.supportedViewports);
  const currentViewport = useSimulationStore((s) => s.viewportState.primary);
  const switchViewport = useSimulationStore((s) => s.switchPrimaryViewport);

  // 只有一个视角时不显示
  if (supportedViewports.length <= 1) return null;

  return (
    <div
      className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-1 rounded-lg px-1 py-1"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      }}
    >
      {supportedViewports.map((vp) => {
        const isActive = vp === currentViewport;
        return (
          <button
            key={vp}
            onClick={() => switchViewport(vp)}
            className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: isActive ? '#1A1A2E' : 'transparent',
              color: isActive ? '#fff' : '#595959',
            }}
          >
            {VIEWPORT_LABELS[vp] ?? vp}
          </button>
        );
      })}
    </div>
  );
}
