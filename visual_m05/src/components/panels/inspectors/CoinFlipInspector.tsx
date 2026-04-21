import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { useSimulationStore } from '@/editor/store';
import type { CoinFlipParams } from '@/types/simulation';

interface Props { simId: string; params: CoinFlipParams; hideN?: boolean; }

export function CoinFlipInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const set = (p: Partial<CoinFlipParams>) => updateParams(simId, p as Partial<CoinFlipParams>);

  return (
    <div className="flex flex-col gap-4">
      {!hideN && (
        <ScaleNSlider label="投掷次数 (n)" value={params.n} min={10} onChange={v => set({ n: v })} />
      )}
    </div>
  );
}
