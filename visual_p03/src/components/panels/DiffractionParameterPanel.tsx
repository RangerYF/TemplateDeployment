/**
 * DiffractionParameterPanel.tsx
 * Controls panel for the diffraction module.
 *
 * Controls:
 *   - Aperture type selector (slit / circle / disk)
 *   - Slit width a  (10 – 500 μm)  or  Diameter D (20 – 1000 μm)
 *   - Wavelength λ  (380 – 780 nm)
 *   - Screen distance L (0.5 – 3.0 m)
 *   - Classroom presets
 *   - Layout position sliders
 *   - Display toggles
 */

import type { DiffractionSettings, ApertureType } from '@/data/diffractionData';
import { SectionTitle, ParamSlider, ToggleRow, WavelengthSlider } from './shared';

// ---------------------------------------------------------------------------
// Aperture type selector
// ---------------------------------------------------------------------------

const APERTURE_OPTIONS: { value: ApertureType; label: string }[] = [
  { value: 'slit', label: '单缝' },
  { value: 'circle', label: '圆孔' },
  { value: 'disk', label: '圆板' },
];

function ApertureSelector({
  value,
  onChange,
}: {
  value: ApertureType;
  onChange: (v: ApertureType) => void;
}) {
  return (
    <div
      className="mb-3 flex rounded-lg p-0.5"
      style={{
        background: 'var(--theme-bg-muted, #f0f0f2)',
        border: '1px solid var(--theme-border, #e0e0e0)',
      }}
    >
      {APERTURE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
          style={
            opt.value === value
              ? {
                  background: 'var(--theme-primary, #00C06B)',
                  color: '#fff',
                }
              : {
                  color: 'var(--theme-text-muted)',
                }
          }
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiffractionParameterPanel({
  settings,
  onUpdateSettings,
}: {
  settings: DiffractionSettings;
  onUpdateSettings: (partial: Partial<DiffractionSettings>) => void;
}) {
  const isSlit = settings.aperture === 'slit';

  return (
    <div className="space-y-1">
      {/* ── Aperture type ───────────────────────────────────────────── */}
      <SectionTitle aside="APERTURE">孔径类型</SectionTitle>

      <ApertureSelector
        value={settings.aperture}
        onChange={(v) =>
          onUpdateSettings({
            aperture: v,
            experimentId: v === 'slit' ? 'opt-031' : 'opt-032',
          })
        }
      />

      {/* ── Physics parameters ──────────────────────────────────────── */}
      <SectionTitle aside="PARAMS">参数调节</SectionTitle>

      {isSlit ? (
        <ParamSlider
          label="缝宽 a"
          value={settings.slitWidth}
          onChange={(v) => onUpdateSettings({ slitWidth: v })}
          min={10}
          max={500}
          step={5}
          unit="μm"
          hint="缝越窄，中央亮纹越宽"
        />
      ) : (
        <ParamSlider
          label={settings.aperture === 'disk' ? '圆板直径 D' : '孔径 D'}
          value={settings.diameter}
          onChange={(v) => onUpdateSettings({ diameter: v })}
          min={20}
          max={1000}
          step={10}
          unit="μm"
        />
      )}

      {/* ── Wavelength ──────────────────────────────────────────────── */}
      <SectionTitle aside="WAVELENGTH">波长</SectionTitle>

      <WavelengthSlider
        value={settings.wavelength}
        onChange={(v) => onUpdateSettings({ wavelength: v })}
      />

      <ParamSlider
        label="屏距 L"
        value={settings.screenDistance}
        onChange={(v) =>
          onUpdateSettings({
            screenDistance: v,
            screenX: settings.apertureX + v * 110,
          })
        }
        min={0.5}
        max={3.0}
        step={0.05}
        unit="m"
      />

      {/* ── Classroom presets ───────────────────────────────────────── */}
      <SectionTitle aside="SCENE">课堂预设</SectionTitle>

      {isSlit ? (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: 'var(--theme-bg-muted, #f0f0f2)',
                border: '1px solid var(--theme-border, #e0e0e0)',
                color: 'var(--theme-text)',
              }}
              onClick={() => onUpdateSettings({ slitWidth: 60 })}
            >
              更窄单缝
            </button>
            <button
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: 'var(--theme-bg-muted, #f0f0f2)',
                border: '1px solid var(--theme-border, #e0e0e0)',
                color: 'var(--theme-text)',
              }}
              onClick={() => onUpdateSettings({ wavelength: 700 })}
            >
              更长波长
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: 'var(--theme-bg-muted, #f0f0f2)',
                border: '1px solid var(--theme-border, #e0e0e0)',
                color: 'var(--theme-text)',
              }}
              onClick={() =>
                onUpdateSettings({
                  screenDistance: 2.2,
                  screenX: settings.apertureX + 2.2 * 110,
                })
              }
            >
              更远屏幕
            </button>
            <button
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: 'var(--theme-bg-muted, #f0f0f2)',
                border: '1px solid var(--theme-border, #e0e0e0)',
                color: 'var(--theme-text)',
              }}
              onClick={() =>
                onUpdateSettings({ slitWidth: 140, wavelength: 450 })
              }
            >
              更宽缝对比
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: 'var(--theme-bg-muted, #f0f0f2)',
                border: '1px solid var(--theme-border, #e0e0e0)',
                color: 'var(--theme-text)',
              }}
              onClick={() => onUpdateSettings({ diameter: 90 })}
            >
              更小圆孔
            </button>
            <button
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: 'var(--theme-bg-muted, #f0f0f2)',
                border: '1px solid var(--theme-border, #e0e0e0)',
                color: 'var(--theme-text)',
              }}
              onClick={() => onUpdateSettings({ wavelength: 700 })}
            >
              更长波长
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: 'var(--theme-bg-muted, #f0f0f2)',
                border: '1px solid var(--theme-border, #e0e0e0)',
                color: 'var(--theme-text)',
              }}
              onClick={() =>
                onUpdateSettings({
                  screenDistance: 2.2,
                  screenX: settings.apertureX + 2.2 * 110,
                })
              }
            >
              更远屏幕
            </button>
            <button
              className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: 'var(--theme-bg-muted, #f0f0f2)',
                border: '1px solid var(--theme-border, #e0e0e0)',
                color: 'var(--theme-text)',
              }}
              onClick={() =>
                onUpdateSettings({ diameter: 300, wavelength: 450 })
              }
            >
              更大孔对比
            </button>
          </div>
        </div>
      )}

      {/* ── Display toggles ─────────────────────────────────────────── */}
      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>

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

      <ToggleRow
        label="多波长对比 (RGB)"
        checked={settings.compareMode}
        onChange={(v) => onUpdateSettings({ compareMode: v })}
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
        label={`${isSlit ? '单缝' : settings.aperture === 'disk' ? '圆板' : '圆孔'}位置 x`}
        value={settings.apertureX}
        onChange={(v) =>
          onUpdateSettings({
            apertureX: v,
            screenDistance: Number(
              ((settings.screenX - v) / 110).toFixed(2),
            ),
          })
        }
        min={220}
        max={430}
        step={1}
      />

      <ParamSlider
        label="屏幕位置 x"
        value={settings.screenX}
        onChange={(v) =>
          onUpdateSettings({
            screenX: v,
            screenDistance: Number(
              ((v - settings.apertureX) / 110).toFixed(2),
            ),
          })
        }
        min={settings.apertureX + 70}
        max={760}
        step={1}
      />
    </div>
  );
}
