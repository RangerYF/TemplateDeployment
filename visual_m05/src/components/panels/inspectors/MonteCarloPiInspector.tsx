import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { useSimulationStore } from '@/editor/store';
import type { MonteCarloPiParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: MonteCarloPiParams;
}

export function MonteCarloPiInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);

  return (
    <div className="flex flex-col gap-4">
      <ScaleNSlider label="投点总数 (n)" value={params.n} min={100}
        onChange={v => updateParams(simId, { n: v } as Partial<MonteCarloPiParams>)} />
    </div>
  );
}
