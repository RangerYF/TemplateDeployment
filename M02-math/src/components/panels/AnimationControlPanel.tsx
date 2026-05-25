import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { useFunctionStore } from '@/editor/store/functionStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { useParamAnimationStore } from '@/editor/store/paramAnimationStore';
import type { AnimParam } from '@/editor/store/paramAnimationStore';
import { useAnimationTrajectoryStore } from '@/editor/store/animationTrajectoryStore';
import { editorInstance } from '@/editor/core/Editor';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import {
  startMultiAnimationControlled,
  EASING_MAP,
  EASING_LABELS,
} from '@/engine/animationEngine';
import type { AnimationControl, EasingName, MultiAnimConfig } from '@/engine/animationEngine';
import { useCanvasRecorder } from '@/hooks/useCanvasRecorder';
import type { FunctionCanvasHandle } from '@/components/FunctionCanvas';
import type { Transform, FunctionParam, FunctionEntry } from '@/types';
import { compileExpression, isParseError } from '@/engine/expressionEngine';
import { buildFunctionScope, getKnownFunctionNames } from '@/engine/compositionEngine';
import { sampleWithTransform } from '@/engine/sampler';
import { Viewport } from '@/canvas/Viewport';
import { COLORS } from '@/styles/colors';
import { focusRing, btnHover } from '@/styles/interactionStyles';
import { Switch } from '@/components/ui/switch';
import { buildTemplateExpr } from '@/engine/functionTemplates';

// ─── Zero-skip helper (matches TransformPanel) ──────────────────────────────

function skipZero(v: number, prev: number): number {
  if (v === 0 || Math.abs(v) < 0.05) return prev > 0 ? -0.1 : 0.1;
  return v;
}

// ─── Build param list from the active function ──────────────────────────────

function buildParamList(fn: FunctionEntry): AnimParam[] {
  const params: AnimParam[] = [];

  // Named params
  for (const p of fn.namedParams) {
    let toValue = p.max ?? 10;
    let label = p.label;
    if (fn.templateId === 'linear') {
      if (p.name === 'a') toValue = 2;
      if (p.name === 'b') {
        toValue = 3;
        label = 'b(截距)';
      }
    }
    params.push({
      key: `named.${p.name}`,
      label,
      enabled: false,
      from: p.value,
      to: toValue,
    });
  }

  // Transform params (a, b, h, k) — keep after named params to avoid
  // confusing template coefficient b with transform.b.
  const transformKeys: Array<{ key: keyof Transform; label: string; to: number }> = [
    { key: 'a', label: 'A(纵缩)', to: 2 },
    { key: 'b', label: 'B(横缩)', to: 2 },
    { key: 'h', label: 'H(平移)', to: 3 },
    { key: 'k', label: 'K(平移)', to: 3 },
  ];
  for (const spec of transformKeys) {
    const value = fn.transform[spec.key];
    params.push({
      key: `transform.${spec.key}`,
      label: spec.label,
      enabled: false,
      from: value,
      to: spec.to,
    });
  }

  return params;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  canvasRef: RefObject<FunctionCanvasHandle | null>;
}

export function AnimationControlPanel({ canvasRef }: Props) {
  const activeFunctionId = useFunctionStore((s) => s.activeFunctionId);
  const activeFunction   = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId) ?? null,
  );
  const trajectoryCount = useAnimationTrajectoryStore((s) => s.frames.length);

  const {
    params, duration, easing, loop, recordEnabled, playState,
    showTrajectory, setParams, updateParam, setDuration, setEasing, setLoop, setShowTrajectory,
    setRecordEnabled,
  } = useParamAnimationStore();

  const controlRef = useRef<AnimationControl | null>(null);
  const beforeSnapshotRef = useRef<{ transform: Transform; namedParams: FunctionParam[] } | null>(null);
  const trajectoryCapturePendingRef = useRef(false);
  const { startRecording, stopRecording, downloadBlob, forceCleanup } = useCanvasRecorder();

  // Rebuild param list when active function changes
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;
  useEffect(() => {
    const fn = useFunctionStore.getState().functions.find((f) => f.id === activeFunctionId);
    if (!fn || fn.mode !== 'standard') {
      setParamsRef.current([]);
      return;
    }
    const newParams = buildParamList(fn);
    const oldParams = useParamAnimationStore.getState().params;
    const oldMap = new Map(oldParams.map((p) => [p.key, p]));
    const merged = newParams.map((np) => {
      const old = oldMap.get(np.key);
      if (old) return { ...np, enabled: old.enabled, from: old.from, to: old.to };
      return np;
    });
    setParamsRef.current(merged);
  }, [activeFunctionId]);

  // ── Finalize: write one command + cleanup ──────────────────────────────
  // Use refs to avoid stale closures and keep dep array complete
  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;
  const downloadBlobRef = useRef(downloadBlob);
  downloadBlobRef.current = downloadBlob;
  const startPlaybackRef = useRef<() => void>(() => {});

  const finalize = useCallback(async (isNaturalEnd: boolean) => {
    const fnId = useFunctionStore.getState().activeFunctionId;
    const fn   = fnId ? useFunctionStore.getState().functions.find((f) => f.id === fnId) : null;
    const snap = beforeSnapshotRef.current;

    // Stop recording
    if (useParamAnimationStore.getState().recordEnabled) {
      const blob = await stopRecordingRef.current();
      if (blob.size > 0) {
        downloadBlobRef.current(blob, `M02-animation-${Date.now()}.webm`);
      }
    }

    // Write undo command
    if (fn && snap && fnId) {
      editorInstance?.execute(
        new UpdateFunctionParamCommand(
          fnId,
          { transform: { ...snap.transform }, namedParams: snap.namedParams.map((p) => ({ ...p })) },
          { transform: { ...fn.transform }, namedParams: fn.namedParams.map((p) => ({ ...p })) },
          '参数动画',
        ),
      );
    }

    controlRef.current = null;
    useAnimationStore.getState().setIsAnimating(false);

    // Handle loop: restart from "from" values
    if (isNaturalEnd && useParamAnimationStore.getState().loop) {
      if (fn && fnId) {
        const storeParams = useParamAnimationStore.getState().params.filter((p) => p.enabled);
        const resetTransform = { ...fn.transform };
        const resetNamed     = fn.namedParams.map((p) => ({ ...p }));
        for (const sp of storeParams) {
          if (sp.key.startsWith('transform.')) {
            const tk = sp.key.split('.')[1] as keyof Transform;
            resetTransform[tk] = sp.from;
          } else if (sp.key.startsWith('named.')) {
            const pn = sp.key.split('.')[1];
            const idx = resetNamed.findIndex((p) => p.name === pn);
            if (idx >= 0) resetNamed[idx] = { ...resetNamed[idx], value: sp.from };
          }
        }
        useFunctionStore.getState().updateFunction(fnId, {
          transform: resetTransform,
          namedParams: resetNamed,
        });
      }

      requestAnimationFrame(() => {
        startPlaybackRef.current();
      });
      return;
    }

    useParamAnimationStore.getState().setPlayState('idle');
    beforeSnapshotRef.current = null;
  }, []);

  // ── Start playback ────────────────────────────────────────────────────
  const canvasRefStable = useRef(canvasRef);
  canvasRefStable.current = canvasRef;
  const startRecordingRef = useRef(startRecording);
  startRecordingRef.current = startRecording;

  const queueTrajectoryCapture = useCallback((fnId: string) => {
    if (trajectoryCapturePendingRef.current) return;
    trajectoryCapturePendingRef.current = true;

    requestAnimationFrame(() => {
      trajectoryCapturePendingRef.current = false;
      if (!useParamAnimationStore.getState().showTrajectory) return;

      const currentFn = useFunctionStore.getState().functions.find((f) => f.id === fnId);
      const viewportState = useFunctionStore.getState().viewport;
      if (!currentFn) return;

      const canvas = canvasRefStable.current.current?.getStaticCanvas();
      const dpr = window.devicePixelRatio || 1;
      const width = canvas ? canvas.width / dpr : 800;
      const height = canvas ? canvas.height / dpr : 600;

      const knownFns = getKnownFunctionNames(useFunctionStore.getState().functions, currentFn.id);
      const compiled = compileExpression(currentFn.exprStr, knownFns);
      if (isParseError(compiled)) return;

      const paramScope: Record<string, unknown> =
        currentFn.templateId === null && currentFn.namedParams.length > 0
          ? Object.fromEntries(currentFn.namedParams.map((param) => [param.name, param.value]))
          : {};
      const fnScope = buildFunctionScope(useFunctionStore.getState().functions, currentFn.id);
      const scope = { ...paramScope, ...fnScope };

      const vp = new Viewport(
        viewportState.xMin,
        viewportState.xMax,
        viewportState.yMin,
        viewportState.yMax,
        width,
        height,
      );

      const points = sampleWithTransform(
        compiled,
        vp,
        currentFn.transform,
        180,
        Object.keys(scope).length > 0 ? scope : undefined,
        currentFn.displayDomain,
      );

      useAnimationTrajectoryStore.getState().appendFrame({
        functionId: currentFn.id,
        points,
        color: currentFn.color,
        lineStyle: currentFn.lineStyle,
      });
    });
  }, []);

  const startPlayback = useCallback(() => {
    const fnId = useFunctionStore.getState().activeFunctionId;
    const fn   = fnId ? useFunctionStore.getState().functions.find((f) => f.id === fnId) : null;
    if (!fn || !fnId) return;

    const enabledParams = useParamAnimationStore.getState().params.filter((p) => p.enabled);
    if (enabledParams.length === 0) return;

    const { duration: dur, easing: easingName } = useParamAnimationStore.getState();

    // Capture "before" snapshot (only on first start, not on loop restart)
    if (!beforeSnapshotRef.current) {
      beforeSnapshotRef.current = {
        transform: { ...fn.transform },
        namedParams: fn.namedParams.map((p) => ({ ...p })),
      };
    }

    // Start recording if enabled
    if (useParamAnimationStore.getState().recordEnabled && canvasRefStable.current.current) {
      const staticCanvas  = canvasRefStable.current.current.getStaticCanvas();
      const dynamicCanvas = canvasRefStable.current.current.getDynamicCanvas();
      if (staticCanvas && dynamicCanvas) {
        startRecordingRef.current(staticCanvas, dynamicCanvas);
      }
    }

    useParamAnimationStore.getState().setPlayState('playing');
    useAnimationStore.getState().setIsAnimating(true);
    useAnimationTrajectoryStore.getState().clear();

    // Build multi-anim configs
    const configs: MultiAnimConfig[] = enabledParams.map((p) => ({
      from: p.from,
      to: p.to,
      onFrame: (value: number) => {
        const latest = useFunctionStore.getState().functions.find((f) => f.id === fnId);
        if (!latest) return;

        if (p.key.startsWith('transform.')) {
          const tk = p.key.split('.')[1] as keyof Transform;
          const adjusted = (tk === 'a' || tk === 'b')
            ? skipZero(value, latest.transform[tk])
            : value;
          useFunctionStore.getState().updateFunction(fnId, {
            transform: { ...latest.transform, [tk]: adjusted },
          });
        } else if (p.key.startsWith('named.')) {
          const paramName = p.key.split('.')[1];
          const newParams = latest.namedParams.map((np) =>
            np.name === paramName ? { ...np, value } : np,
          );
          const exprPatch = latest.templateId
            ? buildTemplateExpr(latest.templateId, newParams)
            : null;
          useFunctionStore.getState().updateFunction(fnId, {
            namedParams: newParams,
            ...(exprPatch ? { exprStr: exprPatch } : {}),
          });
        }

        queueTrajectoryCapture(fnId);
      },
    }));

    const easingFn = EASING_MAP[easingName];

    controlRef.current = startMultiAnimationControlled(
      configs,
      easingFn,
      dur,
      () => { finalize(true); },
    );
  }, [finalize, queueTrajectoryCapture]);

  // Keep startPlaybackRef in sync for finalize's loop restart
  startPlaybackRef.current = startPlayback;

  // ── Playback controls ─────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (useParamAnimationStore.getState().playState === 'paused') {
      controlRef.current?.resume();
      useParamAnimationStore.getState().setPlayState('playing');
      return;
    }
    startPlayback();
  }, [startPlayback]);

  const handlePause = useCallback(() => {
    controlRef.current?.pause();
    useParamAnimationStore.getState().setPlayState('paused');
  }, []);

  const handleStop = useCallback(() => {
    controlRef.current?.cancel();
    finalize(false);
  }, [finalize]);

  const handleClearTrajectory = useCallback(() => {
    useAnimationTrajectoryStore.getState().clear();
  }, []);

  // Cleanup on unmount or function change — also force-stop any active recording
  const forceCleanupRef = useRef(forceCleanup);
  forceCleanupRef.current = forceCleanup;
  useEffect(() => {
    return () => {
      if (controlRef.current) {
        controlRef.current.cancel();
        controlRef.current = null;
        useAnimationStore.getState().setIsAnimating(false);
      }
      forceCleanupRef.current();
    };
  }, [activeFunctionId]);

  // When recordEnabled is toggled OFF while recording is active, force-stop recording
  useEffect(() => {
    if (!recordEnabled && playState !== 'idle') {
      forceCleanupRef.current();
    }
  }, [recordEnabled, playState]);

  useEffect(() => {
    if (!showTrajectory) {
      useAnimationTrajectoryStore.getState().clear();
    }
  }, [showTrajectory]);

  if (!activeFunction || activeFunction.mode !== 'standard') return null;

  const enabledCount = params.filter((p) => p.enabled).length;
  const canPlay = enabledCount > 0 && playState !== 'playing';

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Header */}
      <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, margin: '0 0 8px' }}>
        参数动画
      </p>
      <p style={{ fontSize: '11px', color: COLORS.textSecondary, margin: '0 0 8px', lineHeight: 1.5 }}>
        先勾选要演示的参数，再设置起始值和结束值
      </p>

      {/* Parameter grid */}
      {params.length === 0 && (
        <p style={{ fontSize: '11px', color: COLORS.textSecondary, margin: '0 0 8px' }}>
          无可用参数
        </p>
      )}
      {params.map((p) => (
        <div
          key={p.key}
          style={{
            display: 'grid',
            gridTemplateColumns: '20px 28px 1fr 8px 1fr',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '6px',
          }}
        >
          <input
            type="checkbox"
            checked={p.enabled}
            disabled={playState !== 'idle'}
            onChange={(e) => updateParam(p.key, { enabled: e.target.checked })}
            style={{ width: 14, height: 14, accentColor: COLORS.primary }}
          />
          <span style={{
            fontSize: '12px', fontWeight: 600, color: COLORS.primary,
            fontFamily: 'monospace',
          }}>
            {p.label}
          </span>
          <input
            type="number"
            value={p.from}
            disabled={playState !== 'idle'}
            onChange={(e) => updateParam(p.key, { from: parseFloat(e.target.value) || 0 })}
            step={0.1}
            style={{ ...numInputStyle, transition: 'border-color 0.15s, box-shadow 0.15s' }}
            title="起始值"
            {...focusRing()}
          />
          <span style={{ fontSize: '10px', color: COLORS.textSecondary, textAlign: 'center' }}>→</span>
          <input
            type="number"
            value={p.to}
            disabled={playState !== 'idle'}
            onChange={(e) => updateParam(p.key, { to: parseFloat(e.target.value) || 0 })}
            step={0.1}
            style={{ ...numInputStyle, transition: 'border-color 0.15s, box-shadow 0.15s' }}
            title="结束值"
            {...focusRing()}
          />
        </div>
      ))}

      {/* Settings row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px',
        margin: '10px 0 8px',
      }}>
        {/* Duration */}
        <div>
          <label style={labelStyle}>时长 (ms)</label>
          <input
            type="number"
            value={duration}
            min={200}
            max={30000}
            step={100}
            disabled={playState !== 'idle'}
            onChange={(e) => setDuration(Math.max(200, parseInt(e.target.value) || 2000))}
            style={{ ...numInputStyle, width: '100%', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            {...focusRing()}
          />
        </div>

        {/* Easing */}
        <div>
          <label style={labelStyle}>缓动</label>
          <select
            value={easing}
            disabled={playState !== 'idle'}
            onChange={(e) => setEasing(e.target.value as EasingName)}
            style={{
              width: '100%',
              padding: '3px 4px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: COLORS.textPrimary,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            {...focusRing()}
          >
            {(Object.keys(EASING_LABELS) as EasingName[]).map((name) => (
              <option key={name} value={name}>{EASING_LABELS[name]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loop + Record toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: loop ? COLORS.textPrimary : COLORS.textSecondary }}>循环</span>
          <Switch checked={loop} onCheckedChange={setLoop} disabled={playState !== 'idle'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: recordEnabled ? COLORS.textPrimary : COLORS.textSecondary }}>录制动画</span>
          <Switch checked={recordEnabled} onCheckedChange={setRecordEnabled} disabled={playState !== 'idle'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: showTrajectory ? COLORS.textPrimary : COLORS.textSecondary }}>显示轨迹</span>
          <Switch checked={showTrajectory} onCheckedChange={setShowTrajectory} disabled={playState !== 'idle'} />
        </div>
        {showTrajectory && playState === 'idle' && trajectoryCount > 0 && (
          <button
            onClick={handleClearTrajectory}
            style={{
              marginTop: 2,
              padding: '5px 8px',
              fontSize: '11px',
              borderRadius: '8px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              color: COLORS.textSecondary,
              cursor: 'pointer',
            }}
            {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
          >
            清除轨迹
          </button>
        )}
      </div>

      {/* Playback controls */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {/* Play / Resume */}
        <button
          onClick={handlePlay}
          disabled={!canPlay}
          style={ctrlBtnStyle(!canPlay, playState === 'idle')}
          title={playState === 'paused' ? '继续' : '播放'}
          {...(canPlay ? btnHover(COLORS.surfaceAlt, ctrlBtnStyle(false, playState === 'idle').background as string) : {})}
        >
          ▶ {playState === 'paused' ? '继续' : '播放'}
        </button>

        {/* Pause */}
        <button
          onClick={handlePause}
          disabled={playState !== 'playing'}
          style={ctrlBtnStyle(playState !== 'playing', false)}
          title="暂停"
          {...(playState === 'playing' ? btnHover(COLORS.surfaceAlt, COLORS.surface) : {})}
        >
          ⏸ 暂停
        </button>

        {/* Stop */}
        <button
          onClick={handleStop}
          disabled={playState === 'idle'}
          style={ctrlBtnStyle(playState === 'idle', false)}
          title="停止"
          {...(playState !== 'idle' ? btnHover(COLORS.surfaceAlt, COLORS.surface) : {})}
        >
          ■ 停止
        </button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const numInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  padding: '3px 5px',
  fontSize: '12px',
  fontFamily: 'monospace',
  color: COLORS.textPrimary,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '8px',
  textAlign: 'right',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: COLORS.textSecondary,
  marginBottom: '2px',
};

function ctrlBtnStyle(disabled: boolean, isPrimary: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '5px 6px',
    fontSize: '12px',
    borderRadius: '8px',
    border: `1px solid ${isPrimary && !disabled ? COLORS.primary : COLORS.border}`,
    background: isPrimary && !disabled ? `${COLORS.primary}22` : COLORS.surface,
    color: disabled ? COLORS.neutral : (isPrimary ? COLORS.primary : COLORS.textPrimary),
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontWeight: isPrimary ? 600 : 400,
  };
}
