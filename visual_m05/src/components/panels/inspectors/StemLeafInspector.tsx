import { COLORS } from '@/styles/tokens';
import { Switch } from '@/components/ui/switch';
import { DataSourceEditor } from '@/components/ui/data-source-editor';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import type { StemLeafParams, DataSpec } from '@/types/simulation';

interface Props {
  simId: string;
  params: StemLeafParams;
}

export function StemLeafInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const sim = useSimulationStore(s => s.simulations[simId]);

  const handleChange = (newParams: Partial<StemLeafParams>) => {
    updateParams(simId, newParams as Partial<StemLeafParams>);
    if (sim) {
      const merged = { ...sim.params, ...newParams } as StemLeafParams;
      const cmd = new RunSimulationCommand(simId, 'stemLeaf', merged);
      useHistoryStore.getState().execute(cmd);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DataSourceEditor spec={params.dataSpec} onChange={(dataSpec: DataSpec) => handleChange({ dataSpec })} />

      <div className="flex items-center justify-between">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>拆分茎（高低各半）</span>
        <Switch checked={params.splitStems}
          onCheckedChange={v => handleChange({ splitStems: v })} />
      </div>
    </div>
  );
}
