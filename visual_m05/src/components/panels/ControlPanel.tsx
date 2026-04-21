import { useCallback } from 'react';
import { Play, RotateCcw, Undo2, Redo2, Pause, Square, RefreshCw, StepForward } from 'lucide-react';
import { COLORS } from '@/styles/tokens';
import { Button } from '@/components/ui/button';
import { useSimulationStore, useHistoryStore, useAnimationStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import { isAnimatable, isMultiAnimatable, runOneTrial } from '@/engine/singleStep';
import type { AnimatableType } from '@/engine/singleStep';
import type { DiceRollParams, TwoDiceSumParams } from '@/types/simulation';
import type { MonteCarloPiResult } from '@/engine/simulations/monteCarloPi';
import type { BuffonsNeedleResult } from '@/engine/simulations/buffonsNeedle';
import type { MeetingProblemResult } from '@/engine/simulations/meetingProblem';

const SPEED_LABELS = ['极慢', '慢', '中', '快', '极快'];

export function ControlPanel() {
  const activeSimId = useSimulationStore(s => s.activeSimId);
  const simulations = useSimulationStore(s => s.simulations);
  const canUndo = useHistoryStore(s => s.canUndo);
  const canRedo = useHistoryStore(s => s.canRedo);

  const mode = useAnimationStore(s => s.mode);
  const status = useAnimationStore(s => s.status);
  const speed = useAnimationStore(s => s.speed);
  const animSimId = useAnimationStore(s => s.animSimId);
  const singleLastDisplay = useAnimationStore(s => s.singleLastDisplay);
  const singleTrials = useAnimationStore(s => s.singleTrials);
  const singleAnimating = useAnimationStore(s => s.singleAnimating);

  const activeSim = activeSimId ? simulations[activeSimId] : undefined;
  const animatable = activeSim ? isAnimatable(activeSim.type) : false;
  const multiAnimatable = activeSim ? isMultiAnimatable(activeSim.type) : false;
  const anyAnimatable = animatable || multiAnimatable;

  // Scope animation state to current simulation — other sims are NOT blocked
  const isAnimatingThis = animSimId === activeSimId && status !== 'idle';
  const isPlayingThis = animSimId === activeSimId && status === 'playing';
  const isPausedThis = animSimId === activeSimId && status === 'paused';
  const isDoneThis = animSimId === activeSimId && status === 'done';

  /** Read total trial/point count from a simulation result */
  const getResultTotal = useCallback((simId: string): number | null => {
    const sim = useSimulationStore.getState().simulations[simId];
    if (!sim?.result) return null;
    if (sim.type === 'monteCarloPi') {
      return (sim.result.data as MonteCarloPiResult).points.length;
    } else if (sim.type === 'buffonsNeedle') {
      return (sim.result.data as BuffonsNeedleResult).needles.length;
    } else if (sim.type === 'meetingProblem') {
      return (sim.result.data as MeetingProblemResult).points.length;
    } else {
      const data = sim.result.data as { trials?: unknown[] };
      return data?.trials?.length ?? null;
    }
  }, []);

  // ── Multi-mode handlers ─────────────────────────────────────────────
  const handleRun = useCallback(() => {
    if (!activeSim || !activeSimId) return;
    // Stop any animation from a different sim before running
    if (animSimId && animSimId !== activeSimId) {
      useAnimationStore.getState().stopAnimation();
    }
    const cmd = new RunSimulationCommand(activeSim.id, activeSim.type, activeSim.params);
    useHistoryStore.getState().execute(cmd);

    // Auto-start animation for all animatable sims
    if (anyAnimatable) {
      const total = getResultTotal(activeSimId);
      if (total != null && total > 0) {
        useAnimationStore.getState().startAnimation(activeSimId, total);
      }
    }
  }, [activeSim, activeSimId, animSimId, anyAnimatable, getResultTotal]);

  const handleReset = useCallback(() => {
    if (!activeSimId) return;
    if (animSimId === activeSimId) {
      useAnimationStore.getState().stopAnimation();
    }
    useSimulationStore.getState().resetResult(activeSimId);
  }, [activeSimId, animSimId]);

  const handleStartAnim = useCallback(() => {
    if (!activeSimId) return;
    // Stop any other sim's animation first
    if (animSimId && animSimId !== activeSimId && status !== 'idle') {
      useAnimationStore.getState().stopAnimation();
    }
    const total = getResultTotal(activeSimId);
    if (total != null && total > 0) {
      useAnimationStore.getState().startAnimation(activeSimId, total);
    }
  }, [activeSimId, animSimId, status, getResultTotal]);

  const handleReplay = useCallback(() => {
    useAnimationStore.getState().replayAnimation();
  }, []);

  const handlePause = useCallback(() => {
    useAnimationStore.getState().pauseAnimation();
  }, []);

  const handleResume = useCallback(() => {
    useAnimationStore.getState().resumeAnimation();
  }, []);

  const handleStop = useCallback(() => {
    useAnimationStore.getState().stopAnimation();
  }, []);

  // ── Single-mode handlers ────────────────────────────────────────────
  const handleSingleStep = useCallback(() => {
    if (!activeSim || !activeSimId || !isAnimatable(activeSim.type)) return;
    const animStore = useAnimationStore.getState();
    animStore.initSingle(activeSimId, activeSim.type);

    const trial = runOneTrial(activeSim.type as AnimatableType, activeSim.params);

    // All animatable types: start visual animation, defer chart update
    animStore.startSingleAnim(trial);
    // SimulationCanvas will call onComplete → pushTrial + setResult
  }, [activeSim, activeSimId]);

  const handleSingleReset = useCallback(() => {
    if (!activeSimId) return;
    useAnimationStore.getState().resetSingle();
    useSimulationStore.getState().resetResult(activeSimId);
  }, [activeSimId]);

  // ── Mode toggle ─────────────────────────────────────────────────────
  const handleSetMode = useCallback((m: 'single' | 'multi') => {
    if (animSimId === activeSimId) {
      useAnimationStore.getState().stopAnimation();
    }
    useAnimationStore.getState().resetSingle();
    if (activeSimId) useSimulationStore.getState().resetResult(activeSimId);
    useAnimationStore.getState().setMode(m);
  }, [activeSimId, animSimId]);

  const hasResult = !!activeSim?.result;

  // Scoped to this sim only
  const canStartAnim = anyAnimatable && hasResult && !isAnimatingThis;
  const canReplay = anyAnimatable && isDoneThis;

  // Dice count for diceRoll / twoDiceSum
  const diceCount = activeSim && (activeSim.type === 'diceRoll' || activeSim.type === 'twoDiceSum')
    ? (activeSim.params as DiceRollParams | TwoDiceSumParams).diceCount
    : null;

  return (
    <div className="flex flex-col gap-3">

      {/* Dice count badge */}
      {animatable && diceCount !== null && (
        <div
          className="flex items-center justify-between px-2 py-1 rounded-lg"
          style={{ backgroundColor: COLORS.bgMuted, fontSize: 14 }}
        >
          <span style={{ color: COLORS.textSecondary }}>骰子数量</span>
          <span style={{ fontWeight: 700, color: COLORS.primary }}>{diceCount} 个</span>
        </div>
      )}

      {/* Mode tabs — only for animatable (classical) simulations */}
      {animatable && (
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: `1px solid ${COLORS.border}`, fontSize: 14 }}
        >
          {(['single', 'multi'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleSetMode(m)}
              className="flex-1 py-1.5 font-medium transition-colors"
              style={{
                backgroundColor: mode === m ? COLORS.primary : 'transparent',
                color: mode === m ? COLORS.white : COLORS.textSecondary,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {m === 'single' ? '单次模拟' : '多次模拟'}
            </button>
          ))}
        </div>
      )}

      {/* ── Single mode ── */}
      {mode === 'single' && animatable && (
        <>
          <Button
            variant="primary"
            size="default"
            className="w-full"
            onClick={handleSingleStep}
            disabled={!activeSim || singleAnimating}
          >
            <StepForward size={14} />
            运行一次
          </Button>

          <Button variant="secondary" size="sm" className="w-full" onClick={handleSingleReset} disabled={!activeSim || singleAnimating}>
            <RotateCcw size={14} />
            重置
          </Button>

          {/* Last trial result badge */}
          {singleLastDisplay && (
            <div
              className="text-center py-2 px-2 rounded-lg"
              style={{
                backgroundColor: COLORS.bgMuted,
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.primary,
                border: `1px solid ${COLORS.primaryLight}`,
              }}
            >
              {singleLastDisplay}
            </div>
          )}

          {singleTrials.length > 0 && (
            <div
              className="text-center py-1 px-2 rounded-lg"
              style={{ backgroundColor: COLORS.bgMuted, fontSize: 14, color: COLORS.textMuted }}
            >
              已模拟 {singleTrials.length} 次
            </div>
          )}
        </>
      )}

      {/* ── Multi mode (or multi-only animatable) ── */}
      {(mode === 'multi' || multiAnimatable || !anyAnimatable) && (
        <>
          {/* Run button — only disabled if THIS sim is animating */}
          <Button
            variant="primary"
            size="default"
            className="w-full"
            onClick={handleRun}
            disabled={!activeSim || isPlayingThis || isPausedThis}
          >
            <Play size={14} />
            运行模拟
          </Button>

          {/* Animation controls — for any animatable sim */}
          {anyAnimatable && (
            <>
              {/* Start animation */}
              {canStartAnim && !isPlayingThis && !isPausedThis && (
                <Button variant="secondary" size="sm" className="w-full" onClick={handleStartAnim}>
                  <Play size={14} />
                  动画播放
                </Button>
              )}

              {/* Replay */}
              {canReplay && (
                <Button variant="secondary" size="sm" className="w-full" onClick={handleReplay}>
                  <RefreshCw size={14} />
                  重播
                </Button>
              )}

              {/* Pause/Resume + Stop during animation */}
              {(isPlayingThis || isPausedThis) && (
                <div className="flex gap-2">
                  {isPlayingThis ? (
                    <Button variant="secondary" size="sm" className="flex-1" onClick={handlePause}>
                      <Pause size={14} />
                      暂停
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" className="flex-1" onClick={handleResume}>
                      <Play size={14} />
                      继续
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="flex-1" onClick={handleStop}>
                    <Square size={14} />
                    停止
                  </Button>
                </div>
              )}

              {/* Speed selector */}
              {(hasResult || isAnimatingThis) && (
                <div>
                  <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>播放速度</div>
                  <div className="flex gap-1">
                    {SPEED_LABELS.map((label, i) => (
                      <button
                        key={i}
                        onClick={() => useAnimationStore.getState().setSpeed(i + 1)}
                        className="flex-1 py-1.5 rounded font-medium transition-colors"
                        style={{
                          backgroundColor: speed === i + 1 ? COLORS.primary : COLORS.bgMuted,
                          color: speed === i + 1 ? COLORS.white : COLORS.textSecondary,
                          border: `1px solid ${speed === i + 1 ? COLORS.primary : COLORS.border}`,
                          cursor: 'pointer',
                          fontSize: 14,
                          minHeight: 32,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Reset — only disabled if THIS sim is animating */}
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={handleReset}
            disabled={!activeSim || isPlayingThis || isPausedThis}
          >
            <RotateCcw size={14} />
            重置
          </Button>

          {/* Undo / Redo */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => useHistoryStore.getState().undo()}
              disabled={!canUndo || isPlayingThis || isPausedThis}
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 size={14} />
              撤销
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => useHistoryStore.getState().redo()}
              disabled={!canRedo || isPlayingThis || isPausedThis}
              title="重做 (Ctrl+Y)"
            >
              <Redo2 size={14} />
              重做
            </Button>
          </div>

          {activeSim && (
            <div
              className="text-center py-1 px-2 rounded-lg"
              style={{ backgroundColor: COLORS.bgMuted, fontSize: 14, color: COLORS.textMuted }}
            >
              {isPlayingThis
                ? '▶ 播放中...'
                : isPausedThis
                  ? '⏸ 已暂停'
                  : isDoneThis
                    ? '✓ 播放完毕'
                    : activeSim.result
                      ? '✓ 模拟已完成'
                      : '等待运行...'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
