import { useRef, useCallback } from 'react';

interface RecorderState {
  offscreen: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  recorder: MediaRecorder;
  chunks: Blob[];
  rafId: number;
}

export function useCanvasRecorder() {
  const stateRef = useRef<RecorderState | null>(null);

  const startRecording = useCallback(
    (staticCanvas: HTMLCanvasElement, dynamicCanvas: HTMLCanvasElement) => {
      // Check browser support
      if (typeof staticCanvas.captureStream !== 'function') {
        console.warn('[useCanvasRecorder] captureStream not supported');
        return false;
      }

      const w = staticCanvas.width;
      const h = staticCanvas.height;

      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d')!;

      // Composite both layers into offscreen canvas via RAF loop
      let rafId = 0;
      const compositeLoop = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(staticCanvas, 0, 0);
        ctx.drawImage(dynamicCanvas, 0, 0);
        rafId = requestAnimationFrame(compositeLoop);
      };
      rafId = requestAnimationFrame(compositeLoop);

      const stream = offscreen.captureStream(30);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm; codecs=vp9',
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start();

      stateRef.current = { offscreen, ctx, recorder, chunks, rafId };
      return true;
    },
    [],
  );

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const state = stateRef.current;
      if (!state) {
        resolve(new Blob());
        return;
      }
      cancelAnimationFrame(state.rafId);
      state.recorder.onstop = () => {
        const blob = new Blob(state.chunks, { type: 'video/webm' });
        stateRef.current = null;
        resolve(blob);
      };
      state.recorder.stop();
    });
  }, []);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const forceCleanup = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    cancelAnimationFrame(state.rafId);
    if (state.recorder.state === 'recording' || state.recorder.state === 'paused') {
      state.recorder.onstop = null;
      state.recorder.stop();
    }
    stateRef.current = null;
  }, []);

  return { startRecording, stopRecording, downloadBlob, forceCleanup };
}
