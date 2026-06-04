/**
 * LensMetricsPanel.tsx
 * Live readouts for the lens imaging module: image distance v, magnification,
 * image type (real/virtual), image orientation, on-screen status.
 * Follows the same patterns as MetricsPanel.tsx (refraction).
 */

import { useMemo } from 'react';
import { useLensStore } from '@/store/lensStore';
import { solveLens, fmt } from '@/engine/lensSolver';
import { Readout, SectionTitle } from './shared';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LensMetricsPanel() {
  const settings = useLensStore((s) => s.settings);
  const result = useMemo(() => solveLens(settings), [settings]);

  const screenHitLabel = settings.showScreen
    ? result.screenHit
      ? '成像落在屏上'
      : result.virtualImage
        ? '虚像不能落屏'
        : '像未落在屏上'
    : '屏幕关闭';

  return (
    <div className="space-y-0.5">
      {/* Hero cards */}
      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <div
          className="rounded-lg px-3 py-2"
          style={{
            background: 'var(--theme-primary, #00C06B)',
            color: '#fff',
          }}
        >
          <div className="text-[10px] opacity-80">像的性质</div>
          <div className="text-xs font-semibold">{result.imageNature}</div>
        </div>
        <div
          className="rounded-lg px-3 py-2"
          style={{
            background: result.screenHit
              ? 'oklch(0.45 0.15 150)'
              : result.virtualImage
                ? 'oklch(0.50 0.15 70)'
                : 'var(--theme-bg-muted, #F5F5F7)',
            color: result.screenHit || result.virtualImage ? '#fff' : 'var(--theme-text)',
          }}
        >
          <div className="text-[10px] opacity-80">屏幕判定</div>
          <div className="text-xs font-semibold">{screenHitLabel}</div>
        </div>
      </div>

      {/* Path mode */}
      <div
        className="mb-2 rounded-md px-3 py-1.5"
        style={{ background: 'var(--theme-bg-muted, #F5F5F7)' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>路径模式</span>
        <span className="ml-2 text-xs font-medium" style={{ color: 'var(--theme-text)' }}>{result.pathMode}</span>
      </div>

      {/* Readout grid */}
      <Readout
        label="透镜类型"
        value={settings.lensType === 'convex' ? '凸透镜' : '凹透镜'}
      />
      <Readout
        label="光源类型"
        value={
          settings.sourceType === 'object'
            ? '物体光源'
            : settings.sourceType === 'point'
              ? '点光源'
              : '平行光'
        }
      />
      <Readout
        label="焦距 f"
        value={fmt(result.f, 1)}
        unit="cm"
      />
      <Readout
        label="物距 u"
        value={settings.sourceType === 'parallel' ? '∞' : fmt(result.u, 1)}
        unit={settings.sourceType === 'parallel' ? '' : 'cm'}
      />
      <Readout
        label="像距 v"
        value={Number.isFinite(result.v) ? fmt(result.v, 1) : '∞'}
        unit="cm"
        highlight
      />
      {result.m !== null && (
        <Readout
          label="放大率 m"
          value={Number.isFinite(result.m) ? fmt(result.m, 3) : '∞'}
        />
      )}
      {result.imageHeight !== null && (
        <Readout
          label="像高 h'"
          value={fmt(result.imageHeight, 1)}
          unit="cm"
        />
      )}
      {settings.sourceType !== 'parallel' && (
        <Readout
          label="实像"
          value={result.realImage ? '是' : '否'}
          highlight={result.realImage}
        />
      )}
      {settings.sourceType !== 'parallel' && (
        <Readout
          label="虚像"
          value={result.virtualImage ? '是' : '否'}
          highlight={result.virtualImage}
        />
      )}
      {settings.sourceType !== 'parallel' && (
        <Readout
          label="落屏"
          value={settings.showScreen ? (result.screenHit ? '是' : '否') : '屏幕关闭'}
          highlight={result.screenHit}
        />
      )}

    </div>
  );
}
