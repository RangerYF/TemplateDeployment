import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { useFunctionStore } from '@/editor/store/functionStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { useParamAnimationStore } from '@/editor/store/paramAnimationStore';
import type { AnimParam } from '@/editor/store/paramAnimationStore';
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
import { COLORS } from '@/styles/colors';
import { focusRing, btnHover } from '@/styles/interactionStyles';
import { Switch } from '@/components/ui/switch';

// ─── Zero-skip helper (matches TransformPanel) ──────────────────────────────

function skipZero(v: number, prev: number): number {
  if (v === 0 || Math.abs(v) < 0.05) return prev > 0 ? -0.1 : 0.1;
  return v;
}

// ─── Build param list from the active function ──────────────────────────────

function buildParamList(fn: FunctionEntry): AnimParam[] {
  const params: AnimParam[] = [];

  // Transform params (a, b, h, k)
  const transformKeys: (keyof Transform)[] = ['a', 'b', 'h', 'k'];
  for (const key of transformKeys) {
    const value = fn.transform[key];
    params.push({
      key: `transform.${key}`,
      label: key,
      enabled: false,
      from: value,
      to: key === 'a' || key === 'b' ? 2 : 3,
    });
  }

  // Named params
  for (const p of fn.namedParams) {
    params.push({
      key: `named.${p.name}`,
      label: p.label,
      enabled: false,
      from: p.value,
      to: (p.max ?? 10),
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

  const {
    params, duration, easing, loop, recordEnabled, playState,
    setParams, updateParam, setDuration, setEasing, setLoop,
    setRecordEnabled,
  } = useParamAnimationStore();

  const controlRef = useRef<AnimationControl | null>(null);
  const beforeSnapshotRef = useRef<{ transform: Transform; namedParams: FunctionParam[] } | null>(null);
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
          useFunctionStore.getState().updateFunction(fnId, { namedParams: newParams });
        }
      },
    }));

    const easingFn = EASING_MAP[easingName];

    controlRef.current = startMultiAnimationControlled(
      configs,
      easingFn,
      dur,
      () => { finalize(true); },
    );
  }, [finalize]);

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

  if (!activeFunction || activeFunction.mode !== 'standard') return null;

  const enabledCount = params.filter((p) => p.enabled).length;
  const canPlay = enabledCount > 0 && playState !== 'playing';

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Header */}
      <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, margin: '0 0 8px' }}>
        参数动画
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
          <span style={{ fontSize: 13, fontWeight: 500, color: recordEnabled ? COLORS.textPrimary : COLORS.textSecondary }}>录制</span>
          <Switch checked={recordEnabled} onCheckedChange={setRecordEnabled} disabled={playState !== 'idle'} />
        </div>
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
