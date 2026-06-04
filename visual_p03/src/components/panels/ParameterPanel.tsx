import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import { SHAPES, BASE_SHAPE_PRESETS } from '@/data/refractionData';
import type { HemisphereMode, FiberModel, SnellSourceShape } from '@/data/refractionData';
import { SectionTitle, ParamSlider, SegSelect, ToggleRow, WavelengthSlider } from './shared';

function SceneSelector() {
  const shape = useSimulationStore((s) => s.settings.shape);
  const selectExperiment = useSimulationStore((s) => s.selectExperiment);

  return (
    <div className="mb-3 space-y-1">
      {SHAPES.map((s) => (
        <button
          key={s.id}
          onClick={() => selectExperiment(s.experimentId)}
          className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
          style={
            s.id === shape
              ? { background: 'var(--theme-primary, #00C06B)', color: '#fff' }
              : { background: 'var(--theme-bg-muted, #F5F5F7)', color: 'var(--theme-text-muted)' }
          }
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ParameterPanel() {
  const settings = useSimulationStore((s) => s.settings);
  const updateSettings = useSimulationStore((s) => s.updateSettings);
  const resetSettings = useSimulationStore((s) => s.resetSettings);
  const setViewport = useUIStore((s) => s.setViewport);

  const shape = settings.shape;
  const hideSource = shape === 'apparent' || shape === 'snellwindow';

  return (
    <div className="space-y-1">
      {/* ── Scene selector ─────────────────────────────────────────── */}
      <SceneSelector />

      {/* ── Source controls ─────────────────────────────────────────── */}
      {!hideSource && (
        <>
          <SectionTitle aside="SOURCE">主光源</SectionTitle>
          <ParamSlider
            label="光线角 α"
            value={settings.sourceAngleDeg ?? 56}
            onChange={(v) => updateSettings({ sourceAngleDeg: v })}
            min={-85}
            max={175}
            step={0.5}
            unit="°"
          />
          <ToggleRow
            label="对比光源"
            checked={settings.showSource2 === true}
            onChange={(v) => updateSettings({ showSource2: v })}
          />
          {settings.showSource2 && (
            <ParamSlider
              label="对比角 β"
              value={settings.source2AngleDeg ?? 35}
              onChange={(v) => updateSettings({ source2AngleDeg: v })}
              min={-85}
              max={175}
              step={0.5}
              unit="°"
            />
          )}
        </>
      )}

      {/* ── Medium parameters (shape-dependent) ────────────────────── */}
      <SectionTitle aside="MEDIUM">介质参数</SectionTitle>

      {shape === 'interface' && (
        <>
          <ParamSlider
            label="n₁"
            value={settings.medium1N}
            onChange={(v) => updateSettings({ medium1N: v })}
            min={1.0}
            max={2.5}
            step={0.01}
          />
          <ParamSlider
            label="n₂"
            value={settings.medium2N}
            onChange={(v) => updateSettings({ medium2N: v })}
            min={1.0}
            max={2.5}
            step={0.01}
          />
        </>
      )}

      {shape === 'slab' && (
        <>
          <ParamSlider
            label="玻璃折射率 n"
            value={settings.slabIndex}
            onChange={(v) => updateSettings({ slabIndex: v })}
            min={1.0}
            max={2.5}
            step={0.01}
          />
          <ParamSlider
            label="厚度 d"
            value={settings.slabThicknessCm}
            onChange={(v) => updateSettings({ slabThicknessCm: v })}
            min={2}
            max={15}
            step={0.5}
            unit="cm"
          />
        </>
      )}

      {shape === 'half' && (
        <>
          <ParamSlider
            label="折射率 n"
            value={settings.hemisphereIndex}
            onChange={(v) => updateSettings({ hemisphereIndex: v })}
            min={1.0}
            max={2.5}
            step={0.01}
          />
          <ParamSlider
            label="半径 R"
            value={settings.hemisphereRadiusCm}
            onChange={(v) => updateSettings({ hemisphereRadiusCm: v })}
            min={3}
            max={10}
            step={0.5}
            unit="cm"
          />
          <SegSelect<HemisphereMode>
            value={settings.hemisphereMode}
            onChange={(v) => updateSettings({ hemisphereMode: v })}
            options={[
              { value: 'center', label: '球心入射' },
              { value: 'plane', label: '平面入射' },
            ]}
          />
        </>
      )}

      {shape === 'fiber' && (
        <>
          <ParamSlider
            label="纤芯 n₁"
            value={settings.fiberCoreN}
            onChange={(v) =>
              updateSettings({ fiberCoreN: Math.max(v, settings.fiberCladdingN + 0.01) })
            }
            min={1.3}
            max={1.8}
            step={0.01}
          />
          <ParamSlider
            label="包层 n₂"
            value={settings.fiberCladdingN}
            onChange={(v) =>
              updateSettings({ fiberCladdingN: Math.min(v, settings.fiberCoreN - 0.01) })
            }
            min={1.0}
            max={1.6}
            step={0.01}
          />
          <SegSelect<FiberModel>
            value={settings.fiberModel ?? 'straight'}
            onChange={(v) => updateSettings({ fiberModel: v })}
            options={[
              { value: 'straight', label: '直光纤' },
              { value: 'bent', label: '弯曲光纤' },
            ]}
          />
          {(settings.fiberModel ?? 'straight') === 'bent' && (
            <ParamSlider
              label="弯曲半径 R"
              value={settings.fiberBendRadiusCm}
              onChange={(v) => updateSettings({ fiberBendRadiusCm: v })}
              min={6}
              max={30}
              step={1}
              unit="cm"
            />
          )}
        </>
      )}

      {shape === 'apparent' && (
        <>
          <SegSelect<'depth' | 'height'>
            value={settings.apparentMode ?? 'depth'}
            onChange={(v) => updateSettings({ apparentMode: v })}
            options={[
              { value: 'depth', label: '视深（俯视）' },
              { value: 'height', label: '视高（仰视）' },
            ]}
          />
          <ParamSlider
            label="物体深度 h"
            value={settings.apparentObjectDepthCm ?? 5}
            onChange={(v) => updateSettings({ apparentObjectDepthCm: v })}
            min={2}
            max={15}
            step={0.5}
            unit="cm"
          />
          <ParamSlider
            label="水折射率 n"
            value={settings.apparentWaterN ?? 1.333}
            onChange={(v) => updateSettings({ apparentWaterN: v })}
            min={1.0}
            max={2.0}
            step={0.01}
          />
          <ParamSlider
            label="光线张角"
            value={settings.apparentRayAngleDeg ?? 20}
            onChange={(v) => updateSettings({ apparentRayAngleDeg: v })}
            min={5}
            max={60}
            step={1}
            unit="°"
            hint="超过临界角时可观察全反射"
          />
        </>
      )}

      {shape === 'snellwindow' && (
        <>
          <SegSelect<SnellSourceShape>
            value={settings.snellSourceShape ?? 'point'}
            onChange={(v) => updateSettings({ snellSourceShape: v })}
            options={[
              { value: 'point', label: '点光源' },
              { value: 'line', label: '线光源' },
              { value: 'polygon', label: '多边形' },
            ]}
          />
          <ParamSlider
            label="水深 h"
            value={settings.snellSourceDepthCm ?? 8}
            onChange={(v) => updateSettings({ snellSourceDepthCm: v })}
            min={3}
            max={20}
            step={0.5}
            unit="cm"
          />
          <ParamSlider
            label="水折射率 n"
            value={settings.snellWaterN ?? 1.333}
            onChange={(v) => updateSettings({ snellWaterN: v })}
            min={1.0}
            max={2.0}
            step={0.01}
          />
          <ParamSlider
            label="入射角 θ₁"
            value={settings.snellIncidentAngleDeg ?? 30}
            onChange={(v) => updateSettings({ snellIncidentAngleDeg: v })}
            min={0}
            max={85}
            step={1}
            unit="°"
            hint={`临界角 ${(Math.asin(Math.min(1, 1 / (settings.snellWaterN ?? 1.333))) * 180 / Math.PI).toFixed(1)}°`}
          />
          <SegSelect<'3d' | '2d' | 'topview'>
            value={settings.snellViewMode ?? '3d'}
            onChange={(v) => updateSettings({ snellViewMode: v })}
            options={[
              { value: '3d', label: '3D' },
              { value: '2d', label: '2D 截面' },
              { value: 'topview', label: '俯视' },
            ]}
          />
        </>
      )}

      {/* ── Wavelength ─────────────────────────────────────────────── */}
      <SectionTitle aside="WAVELENGTH">波长</SectionTitle>
      <WavelengthSlider
        value={settings.wavelength}
        onChange={(v) => updateSettings({ wavelength: v })}
      />

      {/* ── Display toggles ────────────────────────────────────────── */}
      <SectionTitle aside="DISPLAY">显示</SectionTitle>
      <ToggleRow
        label="角度标注"
        checked={settings.showAngles}
        onChange={(v) => updateSettings({ showAngles: v })}
      />
      <ToggleRow
        label="法线显示"
        checked={settings.showNormals}
        onChange={(v) => updateSettings({ showNormals: v })}
      />
      <ToggleRow
        label="颜色显示"
        checked={settings.showColor}
        onChange={(v) => updateSettings({ showColor: v })}
      />

      {/* ── Canvas controls ────────────────────────────────────────── */}
      {shape !== 'snellwindow' && (
        <>
          <SectionTitle aside="CANVAS">画布</SectionTitle>
          <ParamSlider
            label="缩放"
            value={settings.canvasZoom ?? 1}
            onChange={(v) => updateSettings({ canvasZoom: v })}
            min={0.3}
            max={5.0}
            step={0.05}
            unit="x"
          />
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setViewport({ offsetX: 0, offsetY: 0, zoom: settings.canvasZoom ?? 1 })}
            >
              居中画布
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                const preset = BASE_SHAPE_PRESETS[shape] ?? {};
                updateSettings(preset);
              }}
            >
              重置对象
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
