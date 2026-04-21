import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import { COLORS } from '@/styles/tokens';

/**
 * 底部时间轴控制栏
 * 播放/暂停/重置按钮 + 时间显示，同步驱动 simulator 和 store
 */
export function TimelineBar() {
  const status = useSimulationStore((s) => s.simulationState.status);
  const currentTime = useSimulationStore((s) => s.simulationState.timeline.currentTime);
  const duration = useSimulationStore((s) => s.simulationState.timeline.duration);

  const isRunning = status === 'running';
  const isIdle = status === 'idle';
  const isStatic = duration === 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handlePlay = useCallback(() => {
    simulator.play();
    useSimulationStore.getState().setStatus('running');
  }, []);

  const handlePause = useCallback(() => {
    simulator.pause();
    useSimulationStore.getState().setStatus('paused');
  }, []);

  const handleReset = useCallback(() => {
    simulator.reset();
    const state = simulator.getState();
    const store = useSimulationStore.getState();
    store.setSimulationState({
      status: state.status,
      timeline: state.timeline,
      currentResult: state.currentResult,
    });
    store.setCurrentResult(state.currentResult);
  }, []);

  return (
    <div
      className="flex items-center gap-3 px-4"
      style={{
        height: 52,
        borderTop: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      {/* 控制按钮 */}
      <div className="flex items-center gap-2">
        {isStatic ? (
          <span className="text-xs px-2" style={{ color: COLORS.textMuted }}>
            静态场景
          </span>
        ) : isRunning ? (
          <Button size="sm" variant="secondary" onClick={handlePause}>
            ⏸ 暂停
          </Button>
        ) : (
          <Button size="sm" onClick={handlePlay} disabled={status === 'finished'}>
            ▶ 播放
          </Button>
        )}
        {!isStatic && (
          <Button size="sm" variant="ghost" onClick={handleReset} disabled={isIdle}>
            ↺ 重置
          </Button>
        )}
      </div>

      {/* 进度条 */}
      <div className="relative flex-1 h-1.5 rounded-full" style={{ backgroundColor: COLORS.bgMuted }}>
        <div
          className="absolute h-full rounded-full"
          style={{
            width: `${progress}%`,
            backgroundColor: COLORS.primary,
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {/* 时间显示 */}
      <span className="min-w-[80px] text-right text-xs tabular-nums" style={{ color: COLORS.textSecondary }}>
        {formatTime(currentTime)} / {isStatic ? '—' : formatTime(duration)}
      </span>
    </div>
  );
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  return s.toFixed(2) + 's';
}
