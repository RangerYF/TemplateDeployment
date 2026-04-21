import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useSimulationStore, useAnimationStore } from '@/editor/store';
import { isAnimatable } from '@/engine/singleStep';
import { COLORS } from '@/styles/tokens';
import { SIM_DETAILS, PARAM_DESCRIPTIONS } from '@/data/simDetails';
import { CoinFlipInspector } from './CoinFlipInspector';
import { DiceRollInspector } from './DiceRollInspector';
import { TwoDiceSumInspector } from './TwoDiceSumInspector';
import { BallDrawInspector } from './BallDrawInspector';
import { MonteCarloPiInspector } from './MonteCarloPiInspector';
import { MeetingProblemInspector } from './MeetingProblemInspector';
import { BuffonsNeedleInspector } from './BuffonsNeedleInspector';
import { HistogramInspector } from './HistogramInspector';
import { StemLeafInspector } from './StemLeafInspector';
import { BinomialDistInspector } from './BinomialDistInspector';
import { HypergeometricDistInspector } from './HypergeometricDistInspector';
import { NormalDistInspector } from './NormalDistInspector';
import { LinearRegressionInspector } from './LinearRegressionInspector';
import { LawOfLargeNumbersInspector } from './LawOfLargeNumbersInspector';
import type {
  SimulationType,
  CoinFlipParams,
  DiceRollParams,
  TwoDiceSumParams,
  BallDrawParams,
  MonteCarloPiParams,
  MeetingProblemParams,
  BuffonsNeedleParams,
  HistogramParams,
  StemLeafParams,
  BinomialDistParams,
  HypergeometricDistParams,
  NormalDistParams,
  LinearRegressionParams,
  LawOfLargeNumbersParams,
} from '@/types/simulation';

/** Collapsible parameter meaning descriptions (replaces old SimDescription) */
function ParamDescription({ type }: { type: SimulationType }) {
  const [expanded, setExpanded] = useState(false);
  const info = SIM_DETAILS[type];
  const params = PARAM_DESCRIPTIONS[type];
  if (!info || !params?.length) return null;

  return (
    <div
      className="rounded-lg mb-3"
      style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-left"
        style={{ fontSize: 14, fontWeight: 600, color: COLORS.primary }}
      >
        <Info size={14} />
        <span className="flex-1">参数说明</span>
        {expanded
          ? <ChevronDown size={14} color={COLORS.primary} />
          : <ChevronRight size={14} color={COLORS.primary} />
        }
      </button>
      {expanded && (
        <div className="px-3 pb-3" style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.textSecondary }}>
          {params.map((desc, i) => (
            <div key={i} style={{ marginBottom: i < params.length - 1 ? 4 : 0 }}>
              • {desc}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InspectorPanel() {
  const activeSimId = useSimulationStore(s => s.activeSimId);
  const simulations = useSimulationStore(s => s.simulations);
  const sim = activeSimId ? simulations[activeSimId] : undefined;
  const animMode = useAnimationStore(s => s.mode);

  if (!sim) {
    return (
      <div style={{ fontSize: 14, color: COLORS.textMuted, textAlign: 'center', padding: '8px 0' }}>
        未选择模拟
      </div>
    );
  }

  // In single mode, hide the n (trial count) slider for classical simulations
  const hideN = animMode === 'single' && isAnimatable(sim.type);

  const renderInspector = () => {
    switch (sim.type) {
      case 'coinFlip':
        return <CoinFlipInspector simId={sim.id} params={sim.params as CoinFlipParams} hideN={hideN} />;
      case 'diceRoll':
        return <DiceRollInspector simId={sim.id} params={sim.params as DiceRollParams} hideN={hideN} />;
      case 'twoDiceSum':
        return <TwoDiceSumInspector simId={sim.id} params={sim.params as TwoDiceSumParams} hideN={hideN} />;
      case 'ballDraw':
        return <BallDrawInspector simId={sim.id} params={sim.params as BallDrawParams} hideN={hideN} />;
      case 'monteCarloPi':
        return <MonteCarloPiInspector simId={sim.id} params={sim.params as MonteCarloPiParams} />;
      case 'meetingProblem':
        return <MeetingProblemInspector simId={sim.id} params={sim.params as MeetingProblemParams} />;
      case 'buffonsNeedle':
        return <BuffonsNeedleInspector simId={sim.id} params={sim.params as BuffonsNeedleParams} />;
      case 'histogram':
        return <HistogramInspector simId={sim.id} params={sim.params as HistogramParams} />;
      case 'stemLeaf':
        return <StemLeafInspector simId={sim.id} params={sim.params as StemLeafParams} />;
      case 'binomialDist':
        return <BinomialDistInspector simId={sim.id} params={sim.params as BinomialDistParams} />;
      case 'hypergeometricDist':
        return <HypergeometricDistInspector simId={sim.id} params={sim.params as HypergeometricDistParams} />;
      case 'normalDist':
        return <NormalDistInspector simId={sim.id} params={sim.params as NormalDistParams} />;
      case 'linearRegression':
        return <LinearRegressionInspector simId={sim.id} params={sim.params as LinearRegressionParams} />;
      case 'lawOfLargeNumbers':
        return <LawOfLargeNumbersInspector simId={sim.id} params={sim.params as LawOfLargeNumbersParams} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <ParamDescription type={sim.type} />
      {renderInspector()}
    </div>
  );
}
