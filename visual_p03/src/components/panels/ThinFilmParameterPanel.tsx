/**
 * ThinFilmParameterPanel.tsx
 * Controls panel for the thin-film interference module.
 *
 * Controls:
 *   - Film type selector (newton / wedge / soap)
 *   - Per-type parameters (R, angle, profile, thickness)
 *   - Wavelength λ (newton & wedge only)
 *   - Film refractive index n
 *   - Classroom presets
 *   - Display toggles (intensity curve, formula)
 */

import type { ThinFilmSettings, FilmKind, WedgeProfile } from '@/data/thinFilmData';
import { SectionTitle, ParamSlider, ToggleRow, WavelengthSlider } from './shared';

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        background: 'var(--theme-bg-muted, #f5f5f7)',
        color: 'var(--theme-text)',
        border: '1px solid var(--theme-border, #e0e0e0)',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Film type selector buttons
// ---------------------------------------------------------------------------

const FILM_TYPE_OPTIONS: { value: FilmKind; label: string }[] = [
  { value: 'newton', label: '牛顿环（同心圆）' },
  { value: 'wedge', label: '楔形薄膜（平行条纹）' },
  { value: 'soap', label: '肥皂泡（彩色条纹）' },
];

const WEDGE_PROFILE_OPTIONS: { value: WedgeProfile; label: string }[] = [
  { value: 'linear', label: '平面' },
  { value: 'convex', label: '上凸' },
  { value: 'concave', label: '下凹' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThinFilmParameterPanel({
  settings,
  onUpdateSettings,
}: {
  settings: ThinFilmSettings;
  onUpdateSettings: (partial: Partial<ThinFilmSettings>) => void;
}) {
  const { filmType } = settings;

  return (
    <div className="space-y-1">
      {/* ---- Film type selector ---- */}
      <SectionTitle aside="MODEL">模型</SectionTitle>
      <div className="flex flex-col gap-1">
        {FILM_TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
            style={
              filmType === o.value
                ? { background: 'var(--theme-primary, #00C06B)', color: '#fff' }
                : {
                    background: 'var(--theme-bg-muted, #f5f5f7)',
                    color: 'var(--theme-text)',
                    border: '1px solid var(--theme-border, #e0e0e0)',
                  }
            }
            onClick={() =>
              onUpdateSettings({
                filmType: o.value,
                experimentId: o.value === 'soap' ? 'opt-041' : o.value === 'wedge' ? 'opt-042' : 'opt-043',
              })
            }
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* ---- Per-type parameters ---- */}
      <SectionTitle aside="PARAMS">参数调节</SectionTitle>

      {filmType === 'newton' && (
        <ParamSlider
          label="透镜曲率半径 R"
          value={settings.lensR}
          onChange={(v) => onUpdateSettings({ lensR: v })}
          min={0.1}
          max={10.0}
          step={0.1}
          unit="m"
        />
      )}

      {filmType === 'wedge' && (
        <>
          <div className="mb-2">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs" style={{ color: 'var(--theme-text)' }}>
                楔形轮廓
              </span>
            </div>
            <div className="flex gap-1">
              {WEDGE_PROFILE_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  className="flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                  style={
                    settings.wedgeProfile === p.value
                      ? { background: 'var(--theme-primary, #00C06B)', color: '#fff' }
                      : {
                          background: 'var(--theme-bg-muted, #f5f5f7)',
                          color: 'var(--theme-text-muted)',
                          border: '1px solid var(--theme-border, #e0e0e0)',
                        }
                  }
                  onClick={() => onUpdateSettings({ wedgeProfile: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <ParamSlider
            label="楔角 α"
            value={settings.wedgeAngle}
            onChange={(v) => onUpdateSettings({ wedgeAngle: v })}
            min={0.1}
            max={10}
            step={0.1}
            unit="′"
            hint="楔角越小，条纹越稀疏"
          />
        </>
      )}

      {filmType === 'soap' && (
        <ParamSlider
          label="薄膜厚度 t"
          value={settings.thickness}
          onChange={(v) => onUpdateSettings({ thickness: v })}
          min={200}
          max={1800}
          step={20}
          unit="nm"
        />
      )}

      {/* Wavelength (newton & wedge only) */}
      {filmType !== 'soap' && (
        <WavelengthSlider
          value={settings.wavelength}
          onChange={(v) => onUpdateSettings({ wavelength: v })}
        />
      )}

      {/* Film refractive index */}
      <ParamSlider
        label="薄膜折射率 n"
        value={settings.filmN}
        onChange={(v) => onUpdateSettings({ filmN: v })}
        min={1.0}
        max={filmType === 'soap' ? 1.6 : 2.0}
        step={0.01}
        unit=""
      />

      {/* ---- Classroom presets ---- */}
      <SectionTitle aside="SCENE">课堂预设</SectionTitle>

      {filmType === 'soap' && (
        <>
          <div className="flex gap-1.5 mb-1.5">
            <PresetButton label="更薄泡膜" onClick={() => onUpdateSettings({ thickness: 400, filmN: 1.33 })} />
            <PresetButton label="更厚泡膜" onClick={() => onUpdateSettings({ thickness: 1200, filmN: 1.33 })} />
          </div>
          <div className="flex gap-1.5 mb-1.5">
            <PresetButton label="较低折射率" onClick={() => onUpdateSettings({ thickness: 700, filmN: 1.20 })} />
            <PresetButton label="较高折射率" onClick={() => onUpdateSettings({ thickness: 700, filmN: 1.50 })} />
          </div>
        </>
      )}

      {filmType === 'wedge' && (
        <>
          <div className="flex gap-1.5 mb-1.5">
            <PresetButton label="更小楔角" onClick={() => onUpdateSettings({ wedgeAngle: 0.4 })} />
            <PresetButton label="更大楔角" onClick={() => onUpdateSettings({ wedgeAngle: 2.4 })} />
          </div>
          <div className="flex gap-1.5 mb-1.5">
            <PresetButton label="更长波长" onClick={() => onUpdateSettings({ wavelength: 700 })} />
            <PresetButton label="更短波长" onClick={() => onUpdateSettings({ wavelength: 450 })} />
          </div>
        </>
      )}

      {filmType === 'newton' && (
        <>
          <div className="flex gap-1.5 mb-1.5">
            <PresetButton label="更小曲率半径" onClick={() => onUpdateSettings({ lensR: 0.5 })} />
            <PresetButton label="更大曲率半径" onClick={() => onUpdateSettings({ lensR: 3.0 })} />
          </div>
          <div className="flex gap-1.5 mb-1.5">
            <PresetButton label="更长波长" onClick={() => onUpdateSettings({ wavelength: 700 })} />
            <PresetButton label="更短波长" onClick={() => onUpdateSettings({ wavelength: 450 })} />
          </div>
        </>
      )}

      {/* ---- Display toggles ---- */}
      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>

      <ToggleRow
        label="关系曲线"
        checked={settings.showIntensity}
        onChange={(v) => onUpdateSettings({ showIntensity: v })}
      />

    </div>
  );
}
