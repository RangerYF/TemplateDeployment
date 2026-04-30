import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';

/**
 * 底部时间轴控制栏
 * 播放/暂停/重置按钮 + 时间显示，同步驱动 simulator 和 store
 */
export function TimelineBar() {
  const controls = usePlaybackControls();

  return (
    <div
      className="flex items-center gap-3 px-4"
      style={{
        height: 52,
        borderTop: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      <div
        className="hidden items-center text-[11px] font-semibold sm:flex"
        style={{ color: COLORS.textMuted, minWidth: 60 }}
      >
        {controls.isStatic ? '静态场景' : '运行控制'}
      </div>

      <PlaybackButtons controls={controls} mode="bar" />

      <div className="relative flex-1 h-1.5 rounded-full" style={{ backgroundColor: COLORS.bgMuted }}>
        <div
          className="absolute h-full rounded-full"
          style={{
            width: `${controls.progress}%`,
            backgroundColor: COLORS.primary,
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      <span className="min-w-[80px] text-right text-xs tabular-nums" style={{ color: COLORS.textSecondary }}>
        {formatTime(controls.currentTime)} / {controls.isStatic ? '—' : formatTime(controls.duration)}
      </span>
    </div>
  );
}

export function PlaybackDock() {
  const controls = usePlaybackControls();
  const status = controls.status;

  if (controls.isStatic) return null;

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        zIndex: 58,
        width: 280,
        padding: 14,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.card,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,248,250,0.98) 100%)',
        boxShadow: SHADOWS.lg,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.primary }}>
            运行控制
          </div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
            {status === 'running' ? '动画播放中' : status === 'finished' ? '已播放完成' : '点击播放开始演示'}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5, color: COLORS.textMuted }}>
            带电粒子运动类场景需要先点这里，画面才会开始运动。
          </div>
        </div>
        <div
          style={{
            minWidth: 64,
            padding: '6px 8px',
            borderRadius: RADIUS.md,
            backgroundColor: COLORS.primaryLight,
            color: COLORS.primary,
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600 }}>时间</div>
          <div className="tabular-nums" style={{ marginTop: 2, fontSize: 13, fontWeight: 700 }}>
            {formatTime(controls.currentTime)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div
          className="relative h-2 rounded-full"
          style={{
            backgroundColor: COLORS.bgActive,
          }}
        >
          <div
            className="absolute h-full rounded-full"
            style={{
              width: `${controls.progress}%`,
              backgroundColor: COLORS.primary,
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <PlaybackButtons controls={controls} mode="dock" />
      </div>
    </div>
  );
}

interface PlaybackControlsModel {
  status: 'idle' | 'running' | 'paused' | 'finished';
  currentTime: number;
  duration: number;
  progress: number;
  isRunning: boolean;
  isIdle: boolean;
  isStatic: boolean;
  handlePlay: () => void;
  handlePause: () => void;
  handleReset: () => void;
  handleClearTrajectory: () => void;
}

function usePlaybackControls(): PlaybackControlsModel {
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

  const handleClearTrajectory = useCallback(() => {
    simulator.clearTrajectories();
    useSimulationStore.getState().setCurrentResult(simulator.getCurrentResult());
  }, []);

  return {
    status,
    currentTime,
    duration,
    progress,
    isRunning,
    isIdle,
    isStatic,
    handlePlay,
    handlePause,
    handleReset,
    handleClearTrajectory,
  };
}

function PlaybackButtons({
  controls,
  mode,
}: {
  controls: PlaybackControlsModel;
  mode: 'bar' | 'dock';
}) {
  const playButtonSize = mode === 'dock' ? 'default' : 'sm';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: mode === 'dock' ? 8 : 6, flexWrap: 'wrap' }}>
      {controls.isRunning ? (
        <Button
          size={playButtonSize}
          variant={mode === 'dock' ? 'dark' : 'secondary'}
          onClick={controls.handlePause}
          style={mode === 'dock' ? { minWidth: 112 } : undefined}
        >
          ⏸ 暂停
        </Button>
      ) : (
        <Button
          size={playButtonSize}
          onClick={controls.handlePlay}
          disabled={controls.status === 'finished'}
          style={mode === 'dock' ? { minWidth: 112, boxShadow: '0 8px 18px rgba(0, 192, 107, 0.22)' } : undefined}
        >
          ▶ 播放
        </Button>
      )}

      <Button
        size={mode === 'dock' ? 'sm' : 'sm'}
        variant={mode === 'dock' ? 'secondary' : 'ghost'}
        onClick={controls.handleReset}
        disabled={controls.isIdle}
      >
        ↺ 重置
      </Button>

      <Button
        size={mode === 'dock' ? 'sm' : 'sm'}
        variant="ghost"
        onClick={controls.handleClearTrajectory}
      >
        清空轨迹
      </Button>
    </div>
  );
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  return s.toFixed(2) + 's';
}
