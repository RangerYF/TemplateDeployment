import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useSimulationStore } from '@/store/simulationStore';
import { COLORS } from '@/styles/tokens';

export function ControlPanel() {
  const currentModelId = useSimulationStore((state) => state.currentModelId);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const speedMultiplier = useSimulationStore((state) => state.speedMultiplier);
  const showVectors = useSimulationStore((state) => state.showVectors);
  const showAreaSectors = useSimulationStore((state) => state.showAreaSectors);
  const hohmannPhase = useSimulationStore((state) => state.hohmannPhase);
  const setPlaying = useSimulationStore((state) => state.setPlaying);
  const setSpeedMultiplier = useSimulationStore((state) => state.setSpeedMultiplier);
  const resetTime = useSimulationStore((state) => state.resetTime);
  const fireHohmann = useSimulationStore((state) => state.fireHohmann);
  const setShowVectors = useSimulationStore((state) => state.setShowVectors);
  const setShowAreaSectors = useSimulationStore((state) => state.setShowAreaSectors);

  const fireLabel = hohmannPhase === 'low'
    ? '第一次点火加速'
    : hohmannPhase === 'transfer'
      ? '第二次点火入轨'
      : hohmannPhase === 'high'
        ? '高轨减速降轨'
        : '低轨再点火入轨';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button variant={isPlaying ? 'secondary' : 'primary'} size="sm" onClick={() => setPlaying(!isPlaying)}>
          {isPlaying ? '暂停' : '播放'}
        </Button>
        <Button variant="secondary" size="sm" onClick={resetTime}>
          回到起点
        </Button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>动画倍率</span>
          <span className="text-xs font-medium" style={{ color: COLORS.text }}>{speedMultiplier.toFixed(1)}x</span>
        </div>
        <Slider
          value={[speedMultiplier]}
          min={0.2}
          max={4}
          step={0.2}
          onValueChange={([value]) => setSpeedMultiplier(value)}
        />
      </div>

      {currentModelId === 'CEL-011' && (
        <Button variant="danger" size="sm" className="w-full" onClick={fireHohmann}>
          {fireLabel}
        </Button>
      )}

      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: COLORS.border, background: COLORS.bgMuted }}>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.text }}>速度/加速度箭头</span>
          <Switch checked={showVectors} onCheckedChange={setShowVectors} />
        </div>
        {currentModelId === 'CEL-002' && (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: COLORS.text }}>面积定律扇形</span>
            <Switch checked={showAreaSectors} onCheckedChange={setShowAreaSectors} />
          </div>
        )}
      </div>
    </div>
  );
}
