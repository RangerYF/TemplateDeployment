import { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useModuleStore, type ModuleId } from '@/store/moduleStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore, type RenderMode } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import { TeachingModal } from '@/components/TeachingModal';

const MODULES: { id: ModuleId; label: string }[] = [
  { id: 'refraction', label: '折射/全反射' },
  { id: 'lens', label: '透镜成像' },
  { id: 'doubleslit', label: '双缝干涉' },
  { id: 'diffraction', label: '单缝/圆孔衍射' },
  { id: 'thinfilm', label: '薄膜干涉' },
];

const SHAPES_WITH_3D = new Set(['interface', 'snellwindow']);

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const [showTeaching, setShowTeaching] = useState(false);
  const activeModule = useModuleStore((s) => s.activeModule);
  const setActiveModule = useModuleStore((s) => s.setActiveModule);
  const shape = useSimulationStore((s) => s.settings.shape);
  const renderMode = useUIStore((s) => s.renderMode);
  const setRenderMode = useUIStore((s) => s.setRenderMode);

  const show3DToggle = activeModule === 'refraction' && SHAPES_WITH_3D.has(shape);

  return (
    <header
      className="flex h-12 shrink-0 items-center border-b px-4 gap-3"
      style={{
        background: 'var(--theme-topbar-bg)',
        borderColor: 'var(--theme-border)',
        boxShadow: 'var(--theme-shadow-sm)',
      }}
    >
      <span
        className="text-sm font-bold whitespace-nowrap"
        style={{ color: 'var(--theme-text)' }}
      >
        光学实验台
      </span>

      <nav
        className="hidden md:flex items-center gap-0.5 rounded-lg p-0.5"
        style={{ background: 'var(--theme-surface-hover)' }}
      >
        {MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveModule(m.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              m.id === activeModule ? 'shadow-sm' : 'hover:opacity-80',
            )}
            style={
              m.id === activeModule
                ? { background: 'var(--theme-primary)', color: '#fff' }
                : { color: 'var(--theme-text-muted)' }
            }
          >
            {m.label}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      {/* 2D/3D toggle — same position as P09 */}
      {show3DToggle && (
        <div
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
        </div>
      )}

      <button
        onClick={toggleTheme}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all hover:opacity-80"
        style={{
          background: 'var(--theme-surface-hover)',
          color: 'var(--theme-text-secondary)',
        }}
        title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <button
        onClick={() => setShowTeaching(true)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all hover:opacity-80"
        style={{
          background: 'var(--theme-surface-hover)',
          color: 'var(--theme-text-secondary)',
        }}
        title="教学要点"
      >
        📖
      </button>

      {showTeaching && <TeachingModal onClose={() => setShowTeaching(false)} />}
    </header>
  );
}
