import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaybackControls } from '@/shell/timeline/TimelineBar';

export interface TopBarTab {
  id: string;
  label: string;
}

export interface TopBarModeSwitch {
  mode: 'preset' | 'builder';
  onModeChange: (mode: 'preset' | 'builder') => void;
}

export interface TopBarModuleSelector {
  modules: { key: string; label: string }[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export interface TopBarProps {
  title: string;
  tabs?: TopBarTab[];
  activeTabId?: string;
  onSelectTab?: (id: string) => void;
  onBack?: () => void;
  modeSwitch?: TopBarModeSwitch;
  moduleSelector?: TopBarModuleSelector;
}

export function TopBar({ title, tabs, activeTabId, onSelectTab, onBack, modeSwitch, moduleSelector }: TopBarProps) {
  const pb = usePlaybackControls();
  const showNav = !modeSwitch || modeSwitch.mode === 'preset';

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b px-4"
      style={{
        background: 'var(--theme-topbar-bg)',
        borderColor: 'var(--theme-border)',
        boxShadow: 'var(--theme-shadow-sm)',
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="flex shrink-0 items-center text-xs font-medium transition-colors hover:opacity-70"
          style={{ color: 'var(--theme-text-secondary)' }}
        >
          ← 返回
        </button>
      )}

      <span
        className="shrink-0 text-sm font-bold"
        style={{
          color: 'var(--theme-text)',
          maxWidth: '20vw',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={title}
      >
        {title}
      </span>

      {modeSwitch && (
        <div
          className="flex shrink-0 items-center gap-0 rounded-lg p-0.5"
          style={{ background: 'var(--theme-surface-hover)' }}
        >
          {(['preset', 'builder'] as const).map((m) => (
            <button
              key={m}
              onClick={() => modeSwitch.onModeChange(m)}
              className="shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition-colors"
              style={
                modeSwitch.mode === m
                  ? { background: 'var(--theme-primary)', color: '#fff', boxShadow: 'var(--theme-shadow-sm)' }
                  : { color: 'var(--theme-text-muted)' }
              }
            >
              {m === 'preset' ? '预设场景' : '自由搭建'}
            </button>
          ))}
        </div>
      )}

      {showNav && moduleSelector && (
        <ModuleDropdown
          modules={moduleSelector.modules}
          activeKey={moduleSelector.activeKey}
          onSelect={moduleSelector.onSelect}
        />
      )}

      {showNav && tabs && tabs.length > 0 && (
        <ScrollableTabs tabs={tabs} activeTabId={activeTabId} onSelectTab={onSelectTab} />
      )}

      {!(showNav && tabs && tabs.length > 0) && <div className="flex-1" />}

      {!pb.isStatic && (
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="hidden rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline"
            style={{
              background: pb.isRunning ? 'var(--theme-success-light)' : 'var(--theme-primary-light)',
              color: pb.isRunning ? 'var(--theme-success)' : 'var(--theme-primary)',
            }}
          >
            {pb.isRunning ? '运行中' : '已就绪'}
          </span>
          <button
            onClick={pb.isRunning ? pb.handlePause : pb.handlePlay}
            disabled={pb.status === 'finished'}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--theme-primary)', color: '#fff' }}
            title={pb.isRunning ? '暂停' : '播放'}
          >
            {pb.isRunning ? '⏸' : '▶'}
          </button>
          <button
            onClick={pb.handleReset}
            disabled={pb.isIdle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--theme-surface-hover)', color: 'var(--theme-text-secondary)' }}
            title="重置"
          >
            ↺
          </button>
        </div>
      )}
    </header>
  );
}

const SCROLL_STEP = 120;

function ScrollableTabs({
  tabs,
  activeTabId,
  onSelectTab,
}: {
  tabs: TopBarTab[];
  activeTabId?: string;
  onSelectTab?: (id: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [updateArrows, tabs]);

  const scroll = useCallback((dir: -1 | 1) => {
    navRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const el = navRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY || e.deltaX;
  }, []);

  const overflows = canScrollLeft || canScrollRight;

  return (
    <div className="flex min-w-0 flex-1 items-center">
      {overflows && (
        <button
          onClick={() => scroll(-1)}
          disabled={!canScrollLeft}
          className="flex h-7 w-6 shrink-0 items-center justify-center text-sm transition-opacity disabled:opacity-20"
          style={{ color: 'var(--theme-text-muted)' }}
          aria-label="向左滚动"
        >
          ‹
        </button>
      )}
      <nav
        ref={navRef}
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg p-0.5"
        style={{ background: 'var(--theme-surface-hover)', scrollbarWidth: 'none' }}
        onWheel={handleWheel}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab?.(tab.id)}
              className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
              style={
                active
                  ? { background: 'var(--theme-primary)', color: '#fff', boxShadow: 'var(--theme-shadow-sm)' }
                  : { color: 'var(--theme-text-muted)' }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
      {overflows && (
        <button
          onClick={() => scroll(1)}
          disabled={!canScrollRight}
          className="flex h-7 w-6 shrink-0 items-center justify-center text-sm transition-opacity disabled:opacity-20"
          style={{ color: 'var(--theme-text-muted)' }}
          aria-label="向右滚动"
        >
          ›
        </button>
      )}
    </div>
  );
}

function ModuleDropdown({
  modules,
  activeKey,
  onSelect,
}: {
  modules: { key: string; label: string }[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeLabel = modules.find((m) => m.key === activeKey)?.label ?? '选择模块';

  const handleSelect = useCallback((key: string) => {
    onSelect(key);
    setOpen(false);
  }, [onSelect]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold transition-colors"
        style={{
          background: 'var(--theme-surface-hover)',
          color: 'var(--theme-text)',
        }}
        title="切换模块"
      >
        {activeLabel}
        <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border py-1"
          style={{
            background: 'var(--theme-panel-bg)',
            borderColor: 'var(--theme-border)',
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          }}
        >
          {modules.map((mod) => {
            const active = mod.key === activeKey;
            return (
              <button
                key={mod.key}
                onClick={() => handleSelect(mod.key)}
                className="flex w-full items-center px-3 py-2 text-xs transition-colors"
                style={
                  active
                    ? { color: 'var(--accent-green)', fontWeight: 600 }
                    : { color: 'var(--theme-text)' }
                }
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--theme-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {active && <span className="mr-2">✓</span>}
                {mod.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
