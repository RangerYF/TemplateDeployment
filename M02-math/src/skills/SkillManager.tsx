/**
 * SkillManager — Global Skill Orchestrator
 *
 * Handles:
 *   - Switching: Only the active skill module is loaded and rendered
 *   - Lazy Loading: Each skill is code-split via React.lazy() for fast initial load
 *   - UI Injection: Dynamically renders the correct layout based on the active skill
 *
 * Route mapping:
 *   /m02 → M02-FunctionLab (Expression Parsing, Transforms, Five-Point)
 *   /m03 → M03-ConicGeometry (Eccentricity Sweep, Focal Chords, Optical Reflection)
 *   /m04 → M04-TrigAndCalculus (Unit Circle, Trig Functions, Triangle Solver)
 *   /    → HomeScreen (landing page)
 */

import { lazy, Suspense, useState, useEffect } from 'react';
import { HomeScreen } from '@/components/HomeScreen';
import { resolveSkill } from './skillMeta';
import type { SkillId } from './skillMeta';

// ─── Lazy-loaded skill modules ──────────────────────────────────────────────

const M02Layout = lazy(() =>
  import('@/skills/M02-FunctionLab').then((m) => ({ default: m.M02Layout })),
);

const M03Layout = lazy(() =>
  import('@/skills/M03-ConicGeometry').then((m) => ({ default: m.M03Layout })),
);

const M04Layout = lazy(() =>
  import('@/skills/M04-TrigAndCalculus').then((m) => ({ default: m.M04Layout })),
);

// ─── Loading fallback ───────────────────────────────────────────────────────

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#F9FAFB',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #E5E7EB',
          borderTopColor: '#32D583', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p style={{ fontSize: 14, color: '#6B7280' }}>加载模块中...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── SkillManager Component ─────────────────────────────────────────────────

export function SkillManager() {
  const [activeSkill, setActiveSkill] = useState<SkillId>(resolveSkill);

  useEffect(() => {
    const handler = () => setActiveSkill(resolveSkill());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  if (activeSkill === '') {
    return <HomeScreen />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      {activeSkill === 'm02' && <M02Layout />}
      {activeSkill === 'm03' && <M03Layout />}
      {activeSkill === 'm04' && <M04Layout />}
    </Suspense>
  );
}
