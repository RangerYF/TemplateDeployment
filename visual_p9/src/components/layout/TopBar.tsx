import { CELESTIAL_MODELS } from '@/data/celestialData';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import type { RenderMode } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils/cn';
import { useState, useMemo } from 'react';
import { detectGPU } from '@/lib/utils/detectGPU';
import { TeachingModal } from '../TeachingModal';

export function TopBar() {
  const store = useSimulationStore();
  const renderMode = useUIStore((s) => s.renderMode);
  const setRenderMode = useUIStore((s) => s.setRenderMode);
  const { theme, toggleTheme } = useTheme();
  const [showTeaching, setShowTeaching] = useState(false);
  const gpuTier = useMemo(() => detectGPU(), []);

  const speeds = [0.5, 1, 2, 5, 10];

  return (
    <>
      <header
        className="flex h-12 shrink-0 items-center border-b px-4 gap-3"
        style={{
          background: 'var(--theme-topbar-bg)',
          borderColor: 'var(--theme-border)',
          boxShadow: 'var(--theme-shadow-sm)',
        }}
      >
        {/* Title */}
        <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--theme-text)' }}>
          天体运动与引力
        </span>

        {/* Model tabs — keep existing tab switching */}
        <nav className="hidden md:flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--theme-surface-hover)' }}>
          {CELESTIAL_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => store.selectModel(m.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                m.id === store.currentModelId ? 'shadow-sm' : 'hover:opacity-80'
              )}
              style={
                m.id === store.currentModelId
                  ? { background: 'var(--theme-primary)', color: '#fff' }
                  : { color: 'var(--theme-text-muted)' }
              }
            >
              {m.shortName}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* 2D/3D toggle — hidden on low-tier GPU */}
        {gpuTier === 'high' && <div
          className="flex items-center rounded-lg p-0.5"
          style={{ background: 'var(--theme-surface-hover)' }}
        >
          {(['2d', '3d'] as RenderMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setRenderMode(mode)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-bold transition-colors uppercase',
                mode === renderMode ? 'shadow-sm' : 'hover:opacity-80',
              )}
              style={
                mode === renderMode
                  ? { background: 'var(--theme-primary)', color: '#fff' }
                  : { color: 'var(--theme-text-muted)' }
              }
            >
              {mode}
            </button>
          ))}
        </div>}

        {/* Status badge */}
        <span
          className="hidden sm:inline rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: store.isPlaying ? 'var(--theme-success-light)' : 'var(--theme-primary-light)',
            color: store.isPlaying ? 'var(--theme-success)' : 'var(--theme-primary)',
          }}
        >
          {store.isPlaying ? '运行中' : '已就绪'}
        </span>

        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => store.setPlaying(!store.isPlaying)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all hover:opacity-90"
            style={{ background: 'var(--theme-primary)', color: '#fff' }}
            title={store.isPlaying ? '暂停' : '播放'}
          >
            {store.isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => { store.resetTime(); store.resetActiveParams(); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all hover:opacity-80"
            style={{ background: 'var(--theme-surface-hover)', color: 'var(--theme-text-secondary)' }}
            title="重置"
          >
            ↺
          </button>
        </div>

        {/* Speed selector */}
        <select
          value={speeds.includes(store.speedMultiplier) ? store.speedMultiplier : 1}
          onChange={(e) => store.setSpeedMultiplier(Number(e.target.value))}
          className="h-8 rounded-lg border px-2 text-xs font-semibold outline-none"
          style={{
            borderColor: 'var(--theme-border)',
            background: 'var(--theme-surface)',
            color: 'var(--theme-text-secondary)',
          }}
        >
          {speeds.map((s) => (
            <option key={s} value={s}>{s}x</option>
          ))}
        </select>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all hover:opacity-80"
          style={{ background: 'var(--theme-surface-hover)', color: 'var(--theme-text-secondary)' }}
          title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Teaching modal trigger */}
        <button
          onClick={() => setShowTeaching(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all hover:opacity-80"
          style={{ background: 'var(--theme-surface-hover)', color: 'var(--theme-text-secondary)' }}
          title="教学要点"
        >
          📖
        </button>
      </header>

      {showTeaching && <TeachingModal onClose={() => setShowTeaching(false)} />}
    </>
  );
}
