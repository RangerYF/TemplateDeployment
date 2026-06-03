import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useSimulationStore } from '@/store/simulationStore';

export function ControlPanel() {
  const {
    speedMultiplier, setSpeedMultiplier,
    showVectors, setShowVectors,
    showAreaSectors, setShowAreaSectors,
    currentModelId, hohmannPhase, fireHohmann,
  } = useSimulationStore();

  const phaseLabels: Record<string, string> = {
    low: '第一次点火加速',
    transfer: '第二次点火入轨',
    high: '高轨减速降轨',
    transferDown: '低轨再点火入轨',
  };

  return (
    <div className="space-y-4">
      {/* Fine speed control */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
            精细速度
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--theme-primary)' }}>
            {speedMultiplier.toFixed(1)}x
          </span>
        </div>
        <Slider
          value={[speedMultiplier]}
          onValueChange={([v]) => setSpeedMultiplier(v)}
          min={0.2}
          max={20}
          step={0.2}
        />
      </div>

      {/* Hohmann fire button — only for CEL-011 */}
      {currentModelId === 'CEL-011' && (
        <Button variant="danger" size="sm" className="w-full" onClick={fireHohmann}>
          {phaseLabels[hohmannPhase] || '点火'}
        </Button>
      )}

      {/* Toggles */}
      <div className="space-y-3">
        <label className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>速度/加速度箭头</span>
          <Switch checked={showVectors} onCheckedChange={setShowVectors} />
        </label>
        {currentModelId === 'CEL-002' && (
          <label className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>面积定律扇形</span>
            <Switch checked={showAreaSectors} onCheckedChange={setShowAreaSectors} />
          </label>
        )}
      </div>
    </div>
  );
}
