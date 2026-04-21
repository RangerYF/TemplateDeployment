import { Pause, Play, RotateCcw, SkipForward, Type } from 'lucide-react';
import { PanelCard } from '@/components/panels/PanelCard';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS } from '@/styles/tokens';
import { getCurrentModel, getCurrentScenario, type SpeedOption, useElectrochemStore } from '@/store/electrochemStore';

const SPEEDS: SpeedOption[] = [0.5, 1, 2];

export function ControlPanel() {
  const selectedModelId = useElectrochemStore((state) => state.selectedModelId);
  const selectedScenarioId = useElectrochemStore((state) => state.selectedScenarioId);
  const playing = useElectrochemStore((state) => state.playing);
  const speed = useElectrochemStore((state) => state.speed);
  const progress = useElectrochemStore((state) => state.progress);
  const showIonLabels = useElectrochemStore((state) => state.showIonLabels);
  const ionLabelFontSize = useElectrochemStore((state) => state.ionLabelFontSize);
  const togglePlaying = useElectrochemStore((state) => state.togglePlaying);
  const reset = useElectrochemStore((state) => state.reset);
  const stepForward = useElectrochemStore((state) => state.stepForward);
  const setScenario = useElectrochemStore((state) => state.setScenario);
  const setSpeed = useElectrochemStore((state) => state.setSpeed);
  const setProgress = useElectrochemStore((state) => state.setProgress);
  const setShowIonLabels = useElectrochemStore((state) => state.setShowIonLabels);
  const setIonLabelFontSize = useElectrochemStore((state) => state.setIonLabelFontSize);

  const model = getCurrentModel({ selectedModelId });
  const scenario = getCurrentScenario({ selectedModelId, selectedScenarioId });

  return (
    <div className="space-y-4">
      <PanelCard title="演示控制" subtitle="播放、逐步、调速与模式切换">
        <div className="space-y-4">
          {model.scenarios.length > 1 ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.textMuted }}>工作模式</div>
              <div className="flex flex-wrap gap-2">
                {model.scenarios.map((item) => {
                  const active = item.id === scenario.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="rounded-full px-3 py-1.5 text-sm font-medium"
                      style={{ background: active ? COLORS.primary : COLORS.bgMuted, color: active ? COLORS.white : COLORS.textSecondary }}
                      onClick={() => setScenario(item.id)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: COLORS.border, background: COLORS.bgPage }}>
              <div className="text-xs" style={{ color: COLORS.textMuted }}>外电路</div>
              <div className="mt-1 text-sm font-medium" style={{ color: COLORS.text }}>{scenario.electronDirection}</div>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: COLORS.border, background: COLORS.bgPage }}>
              <div className="text-xs" style={{ color: COLORS.textMuted }}>电流标注</div>
              <div className="mt-1 text-sm font-medium" style={{ color: COLORS.text }}>{scenario.currentDirection}</div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs" style={{ color: COLORS.textMuted }}>
              <span>时间轴进度</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <Slider value={[progress * 100]} min={0} max={100} step={1} onValueChange={(value) => setProgress(value[0] / 100)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={togglePlaying} className="rounded-2xl px-4 py-2.5">
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? '暂停' : '播放'}
            </Button>
            <Button variant="outline" onClick={stepForward} className="rounded-2xl px-4 py-2.5">
              <SkipForward size={16} />
              逐步前进
            </Button>
            <Button variant="secondary" onClick={reset} className="rounded-2xl px-4 py-2.5">
              <RotateCcw size={16} />
              重置
            </Button>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.textMuted }}>速度</div>
            <div className="flex gap-2">
              {SPEEDS.map((item) => {
                const active = item === speed;
                return (
                  <button
                    key={item}
                    type="button"
                    className="rounded-full px-3 py-1.5 text-sm font-medium"
                    style={{ background: active ? COLORS.primary : COLORS.bgMuted, color: active ? COLORS.white : COLORS.textSecondary }}
                    onClick={() => setSpeed(item)}
                  >
                    {item}x
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border px-4 py-4" style={{ borderColor: COLORS.border, background: COLORS.bgPage }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.textMuted }}>粒子标签</div>
                <div className="mt-1 text-sm" style={{ color: COLORS.textSecondary }}>显示离子和 e⁻ 名称</div>
              </div>
              <Switch checked={showIonLabels} onCheckedChange={setShowIonLabels} />
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs" style={{ color: COLORS.textMuted }}>
                <span className="inline-flex items-center gap-1"><Type size={12} /> 字体大小</span>
                <span>{ionLabelFontSize}px</span>
              </div>
              <Slider value={[ionLabelFontSize]} min={10} max={18} step={1} disabled={!showIonLabels} onValueChange={(value) => setIonLabelFontSize(value[0])} />
              <div className="mt-3 inline-flex items-center rounded-full border px-3 py-1.5" style={{ borderColor: COLORS.border, background: showIonLabels ? COLORS.bg : COLORS.bgMuted, color: showIonLabels ? COLORS.primary : COLORS.textMuted, fontSize: ionLabelFontSize }}>
                H⁺
              </div>
            </div>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="当前关键帧" subtitle="关键帧需有文字标注说明当前发生的化学过程">
        <div className="rounded-2xl px-4 py-4" style={{ background: COLORS.primaryLight }}>
          <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.primary }}>{scenario.caption}</div>
        </div>
      </PanelCard>
    </div>
  );
}

