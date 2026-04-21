import { useRef, useState, useEffect } from 'react';
import type { RefObject } from 'react';
import { Viewport } from '@/canvas/Viewport';
import { EditorInjectable } from '@/editor/core/EditorInjectable';
import type { ToolEvent } from '@/editor/tools/types';
import type { ViewportState } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseDualCanvasOptions {
  initialViewport: ViewportState;
  setViewportFn: (vp: ViewportState) => void;
  onInit?: (editor: EditorInjectable) => void;
}

export interface UseDualCanvasReturn {
  containerRef:   RefObject<HTMLDivElement>;
  staticRef:      RefObject<HTMLCanvasElement>;
  dynamicRef:     RefObject<HTMLCanvasElement>;
  canvasSize:     { width: number; height: number };
  editorRef:      RefObject<EditorInjectable | null>;
  buildToolEvent: (e: MouseEvent | WheelEvent) => ToolEvent;
  scheduleRaf: (draw: () => void) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages dual-layer Canvas with HiDPI (Retina) support.
 *
 * The canvas buffer is sized at `CSS pixels × devicePixelRatio` for
 * pixel-perfect text and line rendering on high-density displays.
 * A CSS `width/height` style keeps the element at the correct display size,
 * while `ctx.scale(dpr, dpr)` is applied before every draw so all
 * rendering code operates in CSS-pixel coordinates as before.
 */
export function useDualCanvas({
  initialViewport,
  setViewportFn,
  onInit,
}: UseDualCanvasOptions): UseDualCanvasReturn {
  const staticRef      = useRef<HTMLCanvasElement>(null);
  const dynamicRef     = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const editorRef     = useRef<EditorInjectable | null>(null);
  const rafPendingRef = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const initialViewportRef = useRef(initialViewport);
  const setViewportFnRef   = useRef(setViewportFn);
  const onInitRef          = useRef(onInit);

  // ── Editor initialisation (runs once per mount) ───────────────────────────
  useEffect(() => {
    const iv = initialViewportRef.current;
    const vp = new Viewport(iv.xMin, iv.xMax, iv.yMin, iv.yMax, 800, 600);
    const editor = new EditorInjectable(vp, setViewportFnRef.current);
    editorRef.current = editor;
    onInitRef.current?.(editor);
  }, []);

  // ── ResizeObserver — HiDPI-aware canvas sizing ────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const cssW = Math.floor(width);
      const cssH = Math.floor(height);
      const dpr  = window.devicePixelRatio || 1;

      // Buffer = CSS size × dpr for pixel-perfect rendering
      const bufW = Math.floor(cssW * dpr);
      const bufH = Math.floor(cssH * dpr);

      for (const ref of [staticRef, dynamicRef]) {
        const c = ref.current;
        if (!c) continue;
        // Set the actual pixel buffer size
        c.width  = bufW;
        c.height = bufH;
        // CSS size stays at layout size — browser maps bufW→cssW
        c.style.width  = `${cssW}px`;
        c.style.height = `${cssH}px`;
      }

      // Viewport uses CSS-pixel dimensions (all math↔canvas transforms
      // operate in CSS coords; the dpr scaling is handled by ctx.scale)
      const editor = editorRef.current;
      if (editor) {
        editor.setViewport(editor.getViewport().withSize(cssW, cssH));
      }

      setCanvasSize({ width: cssW, height: cssH });
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── ToolEvent builder (CSS coords, not buffer coords) ─────────────────────

  const buildToolEvent = (e: MouseEvent | WheelEvent): ToolEvent => {
    const canvas = dynamicRef.current;
    if (!canvas) {
      return { canvasX: 0, canvasY: 0, mathX: 0, mathY: 0, nativeEvent: e };
    }
    const rect    = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const vp = editorRef.current?.getViewport() ?? new Viewport(
      initialViewport.xMin, initialViewport.xMax,
      initialViewport.yMin, initialViewport.yMax,
      canvas.width, canvas.height,
    );
    const [mathX, mathY] = vp.toMath(canvasX, canvasY);

    return { canvasX, canvasY, mathX, mathY, nativeEvent: e };
  };

  // ── RAF scheduler ─────────────────────────────────────────────────────────

  const scheduleRaf = (draw: () => void): void => {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      draw();
    });
  };

  return {
    containerRef,
    staticRef,
    dynamicRef,
    canvasSize,
    editorRef,
    buildToolEvent,
    scheduleRaf,
  };
}
