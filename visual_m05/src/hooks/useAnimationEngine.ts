import { useEffect } from 'react';
import { useAnimationStore } from '@/editor/store/animationStore';

// trials per tick and ms per tick at each speed level (5 levels)
const SPEED_CONFIG: Array<{ batch: number; interval: number }> = [
  { batch: 1,   interval: 500 }, // speed 1 — 极慢: ~2 trials/s
  { batch: 1,   interval: 120 }, // speed 2 — 慢:  ~8 trials/s
  { batch: 5,   interval: 60  }, // speed 3 — 中:  ~83 trials/s
  { batch: 20,  interval: 30  }, // speed 4 — 快:  ~667 trials/s
  { batch: 100, interval: 16  }, // speed 5 — 极快: ~6250 trials/s
];

export function useAnimationEngine() {
  const status = useAnimationStore(s => s.status);
  const speed = useAnimationStore(s => s.speed);

  useEffect(() => {
    if (status !== 'playing') return;

    const cfg = SPEED_CONFIG[Math.min(speed, 5) - 1] ?? SPEED_CONFIG[2];

    const id = setInterval(() => {
      const store = useAnimationStore.getState();
      if (store.status !== 'playing') return;

      const next = Math.min(store.animStep + cfg.batch, store.targetStep);
      store.setAnimStep(next);
      if (next >= store.targetStep) {
        store.doneAnimation();
      }
    }, cfg.interval);

    return () => clearInterval(id);
  }, [status, speed]);
}
