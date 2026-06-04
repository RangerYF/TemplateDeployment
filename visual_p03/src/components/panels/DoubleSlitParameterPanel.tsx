/**
 * DoubleSlitParameterPanel.tsx
 * Controls panel for the double-slit interference module.
 *
 * Controls:
 *   - Slit spacing d  (50 – 1000 μm)
 *   - Slit width a    (5 – 80 μm)
 *   - Screen distance L (0.1 – 5.0 m)
 *   - Wavelength λ    (380 – 780 nm)
 *   - White light mode toggle
 *   - Show intensity curve toggle
 *   - Show formula toggle
 */

import type { DoubleSlitSettings } from '@/data/doubleSlitData';
import { SectionTitle, ParamSlider, ToggleRow, WavelengthSlider } from './shared';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DoubleSlitParameterPanel({
  settings,
  onUpdateSettings,
}: {
  settings: DoubleSlitSettings;
  onUpdateSettings: (partial: Partial<DoubleSlitSettings>) => void;
}) {
  return (
    <div className="space-y-1">
      {/* ── Physics parameters ──────────────────────────────────────── */}
      <SectionTitle aside="PARAMS">参数调节</SectionTitle>

      <ParamSlider
        label="缝间距 d"
        value={settings.slitSpacing}
        onChange={(v) => onUpdateSettings({ slitSpacing: v })}
        min={50}
        max={1000}
        step={10}
        unit="μm"
      />

      <ParamSlider
        label="缝宽 a"
        value={settings.slitWidth}
        onChange={(v) => onUpdateSettings({ slitWidth: v })}
        min={5}
        max={80}
        step={1}
        unit="μm"
        hint="包络（单缝衍射）"
      />

      <ParamSlider
        label="屏距 L"
        value={settings.screenDistance}
        onChange={(v) =>
          onUpdateSettings({
            screenDistance: v,
            screenX: settings.slitX + v * 110,
          })
        }
        min={0.1}
        max={5.0}
        step={0.1}
        unit="m"
      />

      {/* ── Wavelength ──────────────────────────────────────────────── */}
      <SectionTitle aside="WAVELENGTH">波长</SectionTitle>

      <WavelengthSlider
        value={settings.wavelength}
        onChange={(v) => onUpdateSettings({ wavelength: v })}
      />

      {/* ── Display toggles ─────────────────────────────────────────── */}
      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>

      <ToggleRow
        label="白光干涉"
        checked={settings.whiteLight}
        onChange={(v) => onUpdateSettings({ whiteLight: v })}
      />

      <ToggleRow
        label="颜色显示"
        checked={settings.showColor}
        onChange={(v) => onUpdateSettings({ showColor: v })}
      />

      <ToggleRow
        label="强度曲线"
        checked={settings.showIntensity}
        onChange={(v) => onUpdateSettings({ showIntensity: v })}
      />


      {/* ── Layout positions ────────────────────────────────────────── */}
      <SectionTitle aside="LAYOUT">布局</SectionTitle>

      <ParamSlider
        label="光源位置 x"
        value={settings.sourceX}
        onChange={(v) => onUpdateSettings({ sourceX: v })}
        min={50}
        max={180}
        step={1}
      />

      <ParamSlider
        label="双缝位置 x"
        value={settings.slitX}
        onChange={(v) =>
          onUpdateSettings({
            slitX: v,
            screenDistance: Number(((settings.screenX - v) / 110).toFixed(2)),
          })
        }
        min={220}
        max={420}
        step={1}
      />

      <ParamSlider
        label="屏幕位置 x"
        value={settings.screenX}
        onChange={(v) =>
          onUpdateSettings({
            screenX: v,
            screenDistance: Number(((v - settings.slitX) / 110).toFixed(2)),
          })
        }
        min={settings.slitX + 60}
        max={760}
        step={1}
      />
    </div>
  );
}
