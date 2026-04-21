import { useRef, useCallback } from 'react';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { useSimulationStore, useHistoryStore, useAnimationStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import { isAnimatable, isMultiAnimatable, getTrialDisplay, buildPartialResult } from '@/engine/singleStep';
import type { AnimatableType } from '@/engine/singleStep';
import { SIMULATION_LIST, HISTOGRAM_DATASETS, REGRESSION_DATASETS } from '@/types/simulation';
import { SIM_DETAILS } from '@/data/simDetails';
import type { SimulationEntity } from '@/editor/entities/types';
import type {
  CoinFlipResult,
  DiceRollResult,
  TwoDiceSumResult,
  BallDrawResult,
  MonteCarloPiResult,
  MeetingProblemResult,
  BuffonsNeedleResult,
  HistogramResult,
  BinomialDistResult,
  HypergeometricDistResult,
  NormalDistResult,
  LinearRegressionResult,
  LawOfLargeNumbersResult,
  StemLeafResult,
} from '@/engine/simulations';
import type {
  BallDrawParams,
  MeetingProblemParams,
  HistogramParams,
  StemLeafParams,
  HypergeometricDistParams,
  NormalDistParams,
  LinearRegressionParams,
  LawOfLargeNumbersParams,
} from '@/types/simulation';
import {
  CoinFlipRenderer,
  DiceRollRenderer,
  TwoDiceSumRenderer,
  BallDrawRenderer,
  MonteCarloPiRenderer,
  MeetingProblemRenderer,
  BuffonsNeedleRenderer,
  HistogramRenderer,
  BinomialDistRenderer,
  HypergeometricDistRenderer,
  NormalDistRenderer,
  LinearRegressionRenderer,
  LawOfLargeNumbersRenderer,
  StemLeafRenderer,
} from './renderers';
import { SingleStepAnimation } from './SingleStepAnimation';
import { useAnimationEngine } from '@/hooks/useAnimationEngine';

const META_MAP = Object.fromEntries(SIMULATION_LIST.map(s => [s.type, s]));

function Placeholder({ sim, onRun }: { sim: SimulationEntity; onRun: () => void }) {
  const meta = META_MAP[sim.type];
  const details = SIM_DETAILS[sim.type];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
        backgroundColor: COLORS.bgPage,
        padding: '24px 32px',
      }}
    >
      <div style={{ fontSize: 56 }}>📊</div>
      <div style={{ fontSize: 20, color: COLORS.text, fontWeight: 700 }}>{meta?.label ?? sim.type}</div>

      {/* Detailed description from SIM_DETAILS */}
      <div
        style={{
          fontSize: 15,
          color: COLORS.textSecondary,
          maxWidth: 480,
          textAlign: 'center',
          lineHeight: 1.7,
        }}
      >
        {details?.detail ?? meta?.description ?? ''}
      </div>
      {details?.realWorld && (
        <div
          style={{
            fontSize: 14,
            color: COLORS.info,
            maxWidth: 480,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          {details.realWorld}
        </div>
      )}

      <button
        onClick={onRun}
        style={{
          marginTop: 8,
          padding: '10px 28px',
          backgroundColor: COLORS.primary,
          color: COLORS.white,
          borderRadius: 9999,
          border: 'none',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: SHADOWS.md,
          transition: 'all 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = COLORS.primaryHover)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = COLORS.primary)}
      >
        ▶ 开始模拟
      </button>
    </div>
  );
}

function renderSimulation(sim: SimulationEntity, displayN?: number) {
  const result = sim.result;
  if (!result) return null;

  switch (sim.type) {
    case 'coinFlip':
      return <CoinFlipRenderer result={result.data as CoinFlipResult} displayN={displayN} />;
    case 'diceRoll':
      return <DiceRollRenderer result={result.data as DiceRollResult} displayN={displayN} />;
    case 'twoDiceSum':
      return <TwoDiceSumRenderer result={result.data as TwoDiceSumResult} displayN={displayN} />;
    case 'ballDraw': {
      const params = sim.params as BallDrawParams;
      return <BallDrawRenderer result={result.data as BallDrawResult} replace={params.replace} displayN={displayN} />;
    }
    case 'monteCarloPi':
      return <MonteCarloPiRenderer result={result.data as MonteCarloPiResult} displayN={displayN} />;
    case 'meetingProblem':
      return <MeetingProblemRenderer result={result.data as MeetingProblemResult} displayN={displayN} />;
    case 'buffonsNeedle':
      return <BuffonsNeedleRenderer result={result.data as BuffonsNeedleResult} displayN={displayN} />;
    case 'histogram': {
      const p = sim.params as HistogramParams;
      const sourceName = p.dataSpec.mode === 'manual'
        ? '自定义数据'
        : (HISTOGRAM_DATASETS.find(d => d.id === p.dataSpec.presetId)?.name ?? '数据集');
      return <HistogramRenderer result={result.data as HistogramResult} datasetName={sourceName} />;
    }
    case 'stemLeaf': {
      const _p = sim.params as StemLeafParams;
      void _p;
      return <StemLeafRenderer result={result.data as StemLeafResult} />;
    }
    case 'binomialDist':
      return <BinomialDistRenderer result={result.data as BinomialDistResult} />;
    case 'hypergeometricDist': {
      const p = sim.params as HypergeometricDistParams;
      return <HypergeometricDistRenderer result={result.data as HypergeometricDistResult} showCdf={p.showCdf} />;
    }
    case 'normalDist': {
      const p = sim.params as NormalDistParams;
      return <NormalDistRenderer result={result.data as NormalDistResult} showSigmaRegions={p.showSigmaRegions} />;
    }
    case 'linearRegression': {
      const p = sim.params as LinearRegressionParams;
      const ds = REGRESSION_DATASETS.find(d => d.id === p.datasetId) ?? REGRESSION_DATASETS[0];
      return (
        <LinearRegressionRenderer
          result={result.data as LinearRegressionResult}
          xLabel={ds.xLabel}
          yLabel={ds.yLabel}
          showResiduals={p.showResiduals}
        />
      );
    }
    case 'lawOfLargeNumbers': {
      const p = sim.params as LawOfLargeNumbersParams;
      return <LawOfLargeNumbersRenderer result={result.data as LawOfLargeNumbersResult} scenario={p.scenario} />;
    }
    default:
      return null;
  }
}

export function SimulationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSimId = useSimulationStore(s => s.activeSimId);
  const simulations = useSimulationStore(s => s.simulations);
  const activeSim = activeSimId ? simulations[activeSimId] : undefined;

  const animStatus = useAnimationStore(s => s.status);
  const animStep = useAnimationStore(s => s.animStep);
  const animSimId = useAnimationStore(s => s.animSimId);
  const animMode = useAnimationStore(s => s.mode);
  const singleLastDisplay = useAnimationStore(s => s.singleLastDisplay);

  // Single-step animation state
  const singleAnimating = useAnimationStore(s => s.singleAnimating);
  const singleAnimResult = useAnimationStore(s => s.singleAnimResult);
  const singleType = useAnimationStore(s => s.singleType);

  // Run the animation engine (advances animStep via setInterval)
  useAnimationEngine();

  const handleRun = useCallback(() => {
    if (!activeSim || !activeSimId) return;
    const cmd = new RunSimulationCommand(activeSim.id, activeSim.type, activeSim.params);
    useHistoryStore.getState().execute(cmd);

    // Auto-start animation after run
    const anyAnim = isAnimatable(activeSim.type) || isMultiAnimatable(activeSim.type);
    if (anyAnim) {
      const sim = useSimulationStore.getState().simulations[activeSimId];
      if (sim?.result) {
        let total: number | undefined;
        const data = sim.result.data as Record<string, unknown>;
        if (Array.isArray(data.points)) total = data.points.length;
        else if (Array.isArray(data.needles)) total = (data.needles as unknown[]).length;
        else if (Array.isArray(data.trials)) total = (data.trials as unknown[]).length;
        if (total && total > 0) {
          useAnimationStore.getState().startAnimation(activeSimId, total);
        }
      }
    }
  }, [activeSim, activeSimId]);

  // Called when single-step animation (coin flip / dice roll) completes
  const handleAnimComplete = useCallback(() => {
    if (!activeSim || !activeSimId) return;
    const animStore = useAnimationStore.getState();
    const trial = animStore.singleAnimResult;
    if (trial == null) return;

    const display = getTrialDisplay(activeSim.type as AnimatableType, trial);
    const newTrials = [...animStore.singleTrials, trial];
    animStore.pushSingleTrial(trial, display);
    animStore.endSingleAnim();

    const result = buildPartialResult(activeSim.type as AnimatableType, activeSim.params, newTrials);
    useSimulationStore.getState().setResult(activeSimId, result);
  }, [activeSim, activeSimId]);

  if (!activeSim) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: COLORS.bgPage,
          color: COLORS.textMuted,
          fontSize: 15,
        }}
      >
        请选择一个模拟类型
      </div>
    );
  }

  // Determine displayN for multi-mode animation of classical sims
  let displayN: number | undefined;
  if (
    animMode === 'multi' &&
    animSimId === activeSimId &&
    (animStatus === 'playing' || animStatus === 'paused') &&
    animStep > 0
  ) {
    displayN = animStep;
  }

  const rendered = renderSimulation(activeSim, displayN);
  const details = SIM_DETAILS[activeSim.type];

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      {rendered ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Title bar over chart */}
          {details && (
            <div
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(240, 251, 246, 0.85)',
                borderBottom: `1px solid ${COLORS.primaryDisabled}`,
                fontSize: 14,
                color: COLORS.text,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {details.title}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0 }}>{rendered}</div>
        </div>
      ) : (
        <Placeholder sim={activeSim} onRun={handleRun} />
      )}

      {/* Single-step visual animation overlay */}
      {singleAnimating && singleAnimResult != null && singleType && isAnimatable(singleType) && (
        <div
          style={{
            position: 'absolute',
            top: details && rendered ? 52 : 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            padding: '16px 24px',
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: 16,
            boxShadow: SHADOWS.lg,
          }}
        >
          <SingleStepAnimation
            type={singleType as 'coinFlip' | 'diceRoll' | 'twoDiceSum' | 'ballDraw' | 'meetingProblem'}
            result={singleAnimResult}
            onComplete={handleAnimComplete}
            ballDrawContext={activeSim?.type === 'ballDraw' ? {
              redCount: (activeSim.params as BallDrawParams).redCount,
              whiteCount: (activeSim.params as BallDrawParams).whiteCount,
            } : undefined}
            meetingContext={activeSim?.type === 'meetingProblem' ? {
              T: (activeSim.params as MeetingProblemParams).T,
              t: (activeSim.params as MeetingProblemParams).t,
            } : undefined}
          />
        </div>
      )}

      {/* Single-mode last result overlay (green pill) */}
      {animMode === 'single' && singleLastDisplay && !singleAnimating && (
        <div
          style={{
            position: 'absolute',
            top: details && rendered ? 52 : 12,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: COLORS.primary,
            color: COLORS.white,
            borderRadius: 999,
            padding: '6px 20px',
            fontSize: 15,
            fontWeight: 700,
            boxShadow: SHADOWS.md,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {singleLastDisplay}
        </div>
      )}
    </div>
  );
}
