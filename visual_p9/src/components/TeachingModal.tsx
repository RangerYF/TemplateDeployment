import { useState, useEffect, lazy, Suspense } from 'react';
import { useActiveModel } from '@/store/simulationStore';
import { DATA_SOURCES } from '@/data/celestialData';

const LazyFormulaPanel = lazy(() =>
  import('./panels/FormulaPanel').then((mod) => ({ default: mod.FormulaPanel }))
);

interface TeachingModalProps {
  onClose: () => void;
}

type Tab = 'formulas' | 'teaching' | 'sources';

export function TeachingModal({ onClose }: TeachingModalProps) {
  const model = useActiveModel();
  const [tab, setTab] = useState<Tab>('formulas');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'formulas', label: '公式与关系' },
    { key: 'teaching', label: '教学要点' },
    { key: 'sources', label: '数据来源' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[600px] max-w-[90vw] max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--theme-surface)',
          border: '1px solid var(--theme-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--theme-text)' }}>
              教学要点
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
              {model.name_cn}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:opacity-70"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-0 border-b px-6"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-3 text-sm font-medium transition-colors border-b-2"
              style={{
                borderColor: tab === t.key ? 'var(--theme-primary)' : 'transparent',
                color: tab === t.key ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'formulas' && (
            <Suspense
              fallback={
                <p style={{ color: 'var(--theme-text-muted)' }}>加载公式组件...</p>
              }
            >
              <LazyFormulaPanel />
            </Suspense>
          )}

          {tab === 'teaching' && (
            <div className="space-y-3">
              {model.teaching_points.map((point, i) => (
                <div
                  key={i}
                  className="flex gap-2 text-sm"
                  style={{ color: 'var(--theme-text-secondary)' }}
                >
                  <span style={{ color: 'var(--theme-primary)' }}>•</span>
                  <span>{point}</span>
                </div>
              ))}
              {model.animations?.highlight && model.animations.highlight.length > 0 && (
                <div
                  className="mt-4 rounded-lg p-3 text-sm"
                  style={{
                    background: 'var(--theme-primary-light)',
                    color: 'var(--theme-primary)',
                  }}
                >
                  <span className="font-semibold">动画重点：</span>
                  {model.animations.highlight.join(' / ')}
                </div>
              )}
            </div>
          )}

          {tab === 'sources' && (
            <div className="space-y-3">
              {DATA_SOURCES.map((src) => (
                <div
                  key={src.id}
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <div className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                    {src.item}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                    {src.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                    来源：{src.source}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
