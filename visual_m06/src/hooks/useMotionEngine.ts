import { useEffect, useRef } from 'react';
import { useAnimationStore } from '@/editor/demo/animationStore';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import { useTraceStore } from '@/editor/demo/traceStore';
import type { DemoPoint, MotionPath } from '@/editor/demo/demoTypes';

function computePosition(motion: MotionPath, t: number): { x: number; y: number } {
  if (motion.kind === 'circular') {
    const angle = motion.startAngle + t * motion.speed * motion.direction;
    return {
      x: motion.cx + motion.radius * Math.cos(angle),
      y: motion.cy + motion.radius * Math.sin(angle),
    };
  }
  const period = 1 / Math.max(motion.speed, 0.001);
  let phase = (t % period) / period;
  if (motion.bounce) {
    phase = phase <= 0.5 ? phase * 2 : 2 - phase * 2;
  }
  return {
    x: motion.x1 + (motion.x2 - motion.x1) * phase,
    y: motion.y1 + (motion.y2 - motion.y1) * phase,
  };
}

export function useMotionEngine() {
  const rafRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);

  useEffect(() => {
    function tick(timestamp: number) {
      const { status, speed, elapsedTime, setElapsedTime } = useAnimationStore.getState();
      if (status !== 'playing') {
        prevTimeRef.current = 0;
        return;
      }
      if (prevTimeRef.current === 0) {
        prevTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = (timestamp - prevTimeRef.current) / 1000;
      prevTimeRef.current = timestamp;
      const newTime = elapsedTime + dt * speed;
      setElapsedTime(newTime);

      const store = useDemoEntityStore.getState();
      const trace = useTraceStore.getState();
      const ents = store.entities;
      for (const en of Object.values(ents)) {
        if (en.type !== 'demoPoint') continue;
        const pt = en as DemoPoint;
        if (!pt.motion) continue;
        const pos = computePosition(pt.motion, newTime);
        if (Math.abs(pos.x - pt.x) > 1e-6 || Math.abs(pos.y - pt.y) > 1e-6) {
          store.updateEntity(pt.id, { x: pos.x, y: pos.y, xExpr: undefined, yExpr: undefined });
          if (trace.traceEnabled[pt.id]) {
            trace.addTracePoint(pt.id, pos.x, pos.y);
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    const unsub = useAnimationStore.subscribe((state, prev) => {
      if (state.status === 'playing' && prev.status !== 'playing') {
        prevTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(tick);
      }
      if (state.status === 'stopped' && prev.status !== 'stopped') {
        useTraceStore.getState().clearAllTraces();
        const store = useDemoEntityStore.getState();
        const ents = store.entities;
        for (const en of Object.values(ents)) {
          if (en.type !== 'demoPoint') continue;
          const pt = en as DemoPoint;
          if (!pt.motion) continue;
          const pos = computePosition(pt.motion, 0);
          store.updateEntity(pt.id, { x: pos.x, y: pos.y, xExpr: undefined, yExpr: undefined });
        }
      }
    });

    return () => {
      unsub();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
