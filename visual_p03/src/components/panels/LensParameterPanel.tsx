/**
 * LensParameterPanel.tsx
 * Controls for the lens imaging module.
 * Follows the same patterns as ParameterPanel.tsx (refraction).
 */

import { useLensStore } from '@/store/lensStore';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import { resolveObjectDistance, clampLensX, clampScreenX, clamp } from '@/engine/lensSolver';
import { LENS_TYPES, SOURCE_TYPES, LENS_STAGE } from '@/data/lensData';
import type { LensKind, LensSourceType } from '@/data/lensData';
import { SectionTitle, ParamSlider, SegSelect, ToggleRow } from './shared';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LensParameterPanel() {
  const settings = useLensStore((s) => s.settings);
  const updateSettings = useLensStore((s) => s.updateSettings);
  const resetSettings = useLensStore((s) => s.resetSettings);
  const setViewport = useUIStore((s) => s.setViewport);

  const maxObjectDistance = Math.max(
    1,
    Math.round((clampLensX(settings.lensCenterX) - LENS_STAGE.sourceMinX) * 10) / 10,
  );
  const maxScreenDistance = Math.max(
    LENS_STAGE.screenGapMin,
    Math.round((LENS_STAGE.screenMaxX - clampLensX(settings.lensCenterX)) * 10) / 10,
  );

  return (
    <div className="space-y-1">
      {/* Lens type selector */}
      <SectionTitle aside="LENS">透镜对象</SectionTitle>
      <div className="mb-2 flex flex-col gap-1">
        {LENS_TYPES.map((item) => (
          <button
            key={item.value}
            className="w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors"
            style={{
              background:
                settings.lensType === item.value
                  ? 'var(--theme-primary, #00C06B)'
                  : 'var(--theme-bg-muted, #F5F5F7)',
              color:
                settings.lensType === item.value
                  ? '#fff'
                  : 'var(--theme-text-muted)',
            }}
            onClick={() =>
              updateSettings({
                lensType: item.value,
                experimentId: item.value === 'convex' ? 'opt-011' : 'opt-012',
              })
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Source type selector */}
      <SectionTitle aside="SOURCE">主光源</SectionTitle>
      <SegSelect<LensSourceType>
        value={settings.sourceType}
        onChange={(v) => updateSettings({ sourceType: v })}
        options={SOURCE_TYPES}
      />

      {/* Key parameters */}
      <SectionTitle aside="PARAMS">关键参数</SectionTitle>
      <div className="mb-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs" style={{ color: 'var(--theme-text)' }}>
            焦距 f
          </span>
          <span className="tabular-nums text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
            {settings.focalLength} cm
          </span>
        </div>
        <input
          type="number"
          min={LENS_STAGE.focalMin}
          step="any"
          value={settings.focalLength}
          onChange={(event) => {
            const next = parseFloat(event.target.value);
            if (Number.isFinite(next) && next > 0) updateSettings({ focalLength: next });
          }}
          onBlur={(event) => {
            const next = parseFloat(event.target.value);
            if (!Number.isFinite(next) || next <= 0) updateSettings({ focalLength: LENS_STAGE.focalMin });
          }}
          className="w-full rounded-md border px-2 py-1 text-xs tabular-nums"
          style={{
            background: 'var(--theme-bg, #fff)',
            borderColor: 'var(--theme-border, #e5e5e5)',
            color: 'var(--theme-text)',
          }}
        />
      </div>

      {settings.sourceType !== 'parallel' && (
        <>
          <ParamSlider
            label="物距 u"
            value={settings.objectDistance}
            onChange={(v) => updateSettings(resolveObjectDistance(settings, v))}
            min={1}
            max={maxObjectDistance}
            step={1}
            unit="cm"
          />
          <ParamSlider
            label={settings.sourceType === 'point' ? '光源高度 h' : '物高 h'}
            value={settings.objectHeight}
            onChange={(v) => updateSettings({ objectHeight: v })}
            min={20}
            max={80}
            step={1}
            unit="cm"
          />
        </>
      )}

      {/* Typical object distance presets (convex only) */}
      {settings.sourceType !== 'parallel' && settings.lensType === 'convex' && (
        <>
          <SectionTitle aside="SCENE">典型物距</SectionTitle>
          <div className="mb-1 flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                updateSettings(resolveObjectDistance(settings, Math.round(settings.focalLength * 2.5)))
              }
            >
              u &gt; 2f
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                updateSettings(resolveObjectDistance(settings, Math.round(settings.focalLength * 2)))
              }
            >
              u = 2f
            </Button>
          </div>
          <div className="mb-1 flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                updateSettings(resolveObjectDistance(settings, Math.round(settings.focalLength * 1.5)))
              }
            >
              f &lt; u &lt; 2f
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                updateSettings(resolveObjectDistance(settings, Math.round(settings.focalLength)))
              }
            >
              u = f
            </Button>
          </div>
          <div className="mb-1 flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                updateSettings(resolveObjectDistance(settings, Math.round(settings.focalLength * 0.5)))
              }
            >
              u &lt; f
            </Button>
          </div>
        </>
      )}

      {/* Screen position */}
      {settings.showScreen && (
        <>
          <SectionTitle aside="SCREEN">屏幕位置</SectionTitle>
          <ParamSlider
            label="屏距"
            value={
              Math.round(
                (clampScreenX(settings.screenX, clampLensX(settings.lensCenterX)) -
                  clampLensX(settings.lensCenterX)) *
                  10,
              ) / 10
            }
            onChange={(v) =>
              updateSettings({ screenX: clampLensX(settings.lensCenterX) + v })
            }
            min={LENS_STAGE.screenGapMin}
            max={maxScreenDistance}
            step={1}
            unit="cm"
          />
        </>
      )}

      {/* Canvas controls */}
      <SectionTitle aside="CANVAS">画布</SectionTitle>
      <ParamSlider
        label="缩放"
        value={settings.canvasZoom ?? 1}
        onChange={(v) => updateSettings({ canvasZoom: v })}
        min={0.7}
        max={1.9}
        step={0.05}
        unit="x"
      />
      <div className="flex gap-2 pt-1">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 text-xs"
          onClick={() =>
            setViewport({ offsetX: 0, offsetY: 0, zoom: settings.canvasZoom ?? 1 })
          }
        >
          居中画布
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => {
            updateSettings({
              lensCenterX: 560,
              objectX: 440,
              objectDistance: 120,
              screenX: 900,
              canvasPanX: 0,
              canvasPanY: 0,
              canvasZoom: 1,
            });
            setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
          }}
        >
          重置对象
        </Button>
      </div>

      {/* Display toggles */}
      <SectionTitle aside="DISPLAY">显示</SectionTitle>
      <ToggleRow
        label="显示屏幕"
        checked={settings.showScreen}
        onChange={(v) => updateSettings({ showScreen: v })}
      />
      <ToggleRow
        label="三条特殊光线"
        checked={settings.showRays}
        onChange={(v) => updateSettings({ showRays: v })}
      />
    </div>
  );
}
