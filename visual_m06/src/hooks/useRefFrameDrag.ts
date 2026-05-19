import { useCallback, useRef } from 'react';
import { useVectorStore } from '@/editor/store/vectorStore';

function screenToSphere(x: number, y: number, w: number, h: number): [number, number, number] {
  const nx = (2 * x - w) / Math.min(w, h);
  const ny = (h - 2 * y) / Math.min(w, h);
  const r2 = nx * nx + ny * ny;
  if (r2 > 1) {
    const s = 1 / Math.sqrt(r2);
    return [nx * s, ny * s, 0];
  }
  return [nx, ny, Math.sqrt(1 - r2)];
}

function quatFromVecs(a: [number, number, number], b: [number, number, number]): [number, number, number, number] {
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return [cx, cy, cz, 1 + dot];
}

function quatNormalize(q: [number, number, number, number]): [number, number, number, number] {
  const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (len < 1e-10) return [0, 0, 0, 1];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function quatMul(a: [number, number, number, number], b: [number, number, number, number]): [number, number, number, number] {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function useRefFrameDrag() {
  const dragging = useRef(false);
  const startSphere = useRef<[number, number, number]>([0, 0, 1]);
  const startQuat = useRef<[number, number, number, number]>([0, 0, 0, 1]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 2) return;
    dragging.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    startSphere.current = screenToSphere(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
    startQuat.current = useVectorStore.getState().sceneRotation;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cur = screenToSphere(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
    const delta = quatNormalize(quatFromVecs(startSphere.current, cur));
    const result = quatNormalize(quatMul(delta, startQuat.current));
    useVectorStore.getState().setSceneRotation(result);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 2) return;
    dragging.current = false;
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onContextMenu };
}
