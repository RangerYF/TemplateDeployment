import type { ReactNode } from 'react';
import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import { COLORS } from '@/styles/tokens';
import { FORCE_COLORS, FORCE_TYPE_NAMES } from '@/core/visual-constants';
import type { Entity, Force, ForceAnalysis, MotionState, ParamValues } from '@/core/types';
import {
  computeElectricFieldMagnitudeAtPoint,
  computePotentialAtPoint,
  type PointChargeSample,
} from '@/domains/em/logic/electric-field-observables';
import { isDetectorScreen } from '@/domains/em/logic/detector-screen';
import {
  getEFieldPlateSpan,
  getUniformEFieldDerivedState,
  getUniformEFieldModelLabel,
  isParallelPlateCapacitorField,
} from '@/domains/em/logic/electric-force';
import { sampleMagneticFieldAtPoint } from '@/domains/em/logic/lorentz-force';
import { analyzeParallelPlateDeflection } from '@/domains/em/logic/parallel-plate-deflection';
import { getPointChargeLaunchState } from '@/domains/em/logic/point-charge-kinematics';
import {
  analyzeTwoStageEField,
  resolveTwoStageEFieldPair,
} from '@/domains/em/logic/two-stage-efield';
import { isDynamicPointCharge, isSourcePointCharge } from '@/domains/em/logic/point-charge-role';
import {
  getP08SceneSummary,
  type P08SceneSummary,
  type PotentialMeasurementSummary,
} from './p08SceneSummary';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-2 text-xs font-semibold"
      style={{ color: COLORS.textSecondary }}
    >
      {children}
    </div>
  );
}

/**
 * 右侧信息面板 — 读取 PhysicsResult 展示物理数据
 */
export function InfoPanel({ presetId }: { presetId?: string }) {
  const storeResult = useSimulationStore((s) => s.simulationState.currentResult);
  const duration = useSimulationStore((s) => s.simulationState.timeline.duration);
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const potentialProbeA = useSimulationStore((s) => s.potentialProbeA);
  const potentialProbeB = useSimulationStore((s) => s.potentialProbeB);
  const result = storeResult ?? simulator.getCurrentResult();
  const isDynamic = duration > 0;
  const entityList = Array.from(entities.values());
  const pointChargeEntities = entityList.filter(isSourcePointCharge);
  const hasTrackBoundCircle = entityList.some(
    (entity) =>
      entity.type === 'point-charge' &&
      typeof entity.properties.trackRadius === 'number',
  );
  const hasUniformField = entityList.some(
    (entity) => entity.type === 'uniform-efield' || entity.type === 'uniform-bfield',
  );
  const hasPointChargeField = pointChargeEntities.length > 0 && !hasUniformField;
  const p08Summary = getP08SceneSummary({
    presetId,
    entities,
    result,
    paramValues,
    potentialProbeA,
    potentialProbeB,
  });

  // 查找电场实体（平行板电容器）
  let efieldEntity: Entity | undefined;
  for (const entity of entityList) {
    if (
      entity.type === 'uniform-efield' &&
      (((entity.properties.showPlates as boolean) ?? false) || isParallelPlateCapacitorField(entity)) &&
      !entityList.some(isDynamicPointCharge)
    ) {
      efieldEntity = entity;
      break;
    }
  }

  // 查找电场粒子场景（带电粒子 + 匀强电场）
  let accelParticle: Entity | undefined;
  let accelEfield: Entity | undefined;
  const electricFields: Entity[] = [];
  const magneticFields: Entity[] = [];
  for (const entity of entityList) {
    if (isDynamicPointCharge(entity)) accelParticle = entity;
    if (entity.type === 'uniform-efield') {
      accelEfield = entity;
      electricFields.push(entity);
    }
    if (entity.type === 'uniform-bfield') magneticFields.push(entity);
  }
  const twoStageEFieldPair = electricFields.length > 1 ? resolveTwoStageEFieldPair(electricFields) : null;
  const magneticParticle = accelEfield ? undefined : accelParticle;
  const accelMotion = accelParticle && result ? result.motionStates.get(accelParticle.id) : undefined;
  const magneticMotion = magneticParticle && result ? result.motionStates.get(magneticParticle.id) : undefined;
  const magneticForceAnalysis = magneticParticle && result
    ? result.forceAnalyses.get(magneticParticle.id)
    : undefined;
  const hasMagneticModule = Boolean(magneticParticle && magneticFields.length > 0 && magneticMotion);

  const hasForceOrMotion = result && (result.forceAnalyses.size > 0 || (isDynamic && result.motionStates.size > 0));
  const hasAccelDiagram =
    accelParticle &&
    electricFields.length > 0 &&
    magneticFields.length === 0 &&
    !hasTrackBoundCircle;
  const hasContent =
    p08Summary.isP08 ||
    hasForceOrMotion ||
    efieldEntity ||
    hasAccelDiagram ||
    hasMagneticModule ||
    hasPointChargeField;

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 300,
        minWidth: 280,
        maxWidth: 320,
        borderLeft: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      <div
        className="px-4 py-3 text-sm font-semibold"
        style={{ color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}
      >
        物理信息
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!hasContent ? (
          <div
            className="flex h-full items-center justify-center text-xs"
            style={{ color: COLORS.textMuted }}
          >
            加载预设后显示物理信息
          </div>
        ) : (
          <div className="space-y-4">
            {p08Summary.isP08 && (
              <section>
                <SectionTitle>课堂速览</SectionTitle>
                <P08TeachingSummary summary={p08Summary} />
              </section>
            )}

            {p08Summary.supportsPotentialDifference && p08Summary.potentialMeasurement && (
              <section>
                <SectionTitle>两点电势差</SectionTitle>
                <PotentialMeasurementInfo summary={p08Summary.potentialMeasurement} />
              </section>
            )}

            {hasPointChargeField && (
              <section>
                <SectionTitle>点电荷场</SectionTitle>
                <PointChargeFieldInfo charges={pointChargeEntities} paramValues={paramValues} />
              </section>
            )}

            {hasMagneticModule && magneticParticle && magneticMotion && (
              <section>
                <SectionTitle>磁场实验</SectionTitle>
                <ParticleInBFieldInfo
                  particle={magneticParticle}
                  fields={magneticFields}
                  motion={magneticMotion}
                  analysis={magneticForceAnalysis}
                />
              </section>
            )}

            {efieldEntity && !hasTrackBoundCircle && (
              <section>
                <SectionTitle>电场参数</SectionTitle>
                <EFieldInfo entity={efieldEntity} />
              </section>
            )}

            {accelParticle && electricFields.length > 0 && (
              <section>
                <SectionTitle>电场与粒子</SectionTitle>
                {twoStageEFieldPair ? (
                  <TwoStageEFieldInfo
                    particle={accelParticle}
                    fields={electricFields}
                    motion={accelMotion}
                    accelerationField={twoStageEFieldPair.accelerationField}
                    deflectionField={twoStageEFieldPair.deflectionField}
                  />
                ) : accelEfield ? (
                  <ParticleInEFieldInfo
                    particle={accelParticle}
                    efield={accelEfield}
                    motion={accelMotion}
                  />
                ) : null}
              </section>
            )}

            {result && result.forceAnalyses.size > 0 && (
              <section>
                <SectionTitle>受力分析</SectionTitle>
                <ForceInfo analyses={Array.from(result.forceAnalyses.values())} />
              </section>
            )}

            {isDynamic && result && result.motionStates.size > 0 && !hasMagneticModule && (
              <section>
                <SectionTitle>运动状态</SectionTitle>
                <MotionInfo states={Array.from(result.motionStates.values())} />
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
const TWO_CHARGE_PRESET_LABELS: Record<string, string> = {
  dipole: '等量异号',
  'same-positive': '等量同号（正）',
  'same-negative': '等量同号（负）',
  'unequal-dipole': '不等量异号',
  custom: '自定义',
};

function formatSignedMicroC(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} μC`;
}

function formatCompactNumber(value: number, unit: string): string {
  const abs = Math.abs(value);
  const text =
    abs >= 1e4 || (abs > 0 && abs < 1e-2)
      ? value.toExponential(2)
      : value.toFixed(abs >= 100 ? 1 : 2);
  return `${text} ${unit}`;
}

function toChargeSamples(charges: Entity[]): PointChargeSample[] {
  return charges.map((charge) => ({
    position: { ...charge.transform.position },
    charge: (((charge.properties.charge as number) ?? 0) * 1e-6),
  }));
}

function P08TeachingSummary({ summary }: { summary: P08SceneSummary }) {
  return (
    <div className="space-y-2 text-xs" style={{ color: COLORS.text }}>
      <div
        className="rounded px-2.5 py-2"
        style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.primary }}>
          {summary.moduleTitle ?? 'P-08'}
        </div>
        <div className="mt-1" style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
          {summary.modelTitle}
        </div>
        {summary.formula && (
          <div className="mt-2" style={{ fontFamily: '"Courier New", monospace', fontSize: 12, color: COLORS.primary }}>
            {summary.formula}
          </div>
        )}
      </div>

      {summary.keyParameters.length > 0 && (
        <div className="space-y-1">
          {summary.keyParameters.map((row) => (
            <InfoRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      )}

      {summary.metrics.length > 0 && (
        <div
          className="rounded px-2 py-1.5"
          style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }}
        >
          <div className="mb-1 font-medium" style={{ color: COLORS.text }}>
            核心结果
          </div>
          <div className="space-y-1">
            {summary.metrics.slice(0, 6).map((row) => (
              <InfoRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>
      )}

      {summary.explanation && (
        <div
          className="rounded px-2 py-1.5"
          style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }}
        >
          <div className="font-medium" style={{ color: COLORS.text }}>结果解读</div>
          <div className="mt-1">{summary.explanation}</div>
        </div>
      )}
    </div>
  );
}

function PotentialMeasurementInfo({ summary }: { summary: PotentialMeasurementSummary }) {
  return (
    <div className="space-y-2 text-xs" style={{ color: COLORS.text }}>
      <div
        className="rounded px-2.5 py-2"
        style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
      >
        <div style={{ fontWeight: 600, color: COLORS.primary }}>ΔV = V<sub>A</sub> - V<sub>B</sub></div>
        <div className="mt-1" style={{ color: COLORS.textSecondary }}>{summary.prompt}</div>
      </div>

      {summary.rows.length > 0 && (
        <div className="space-y-1">
          {summary.rows.map((row) => (
            <InfoRow key={row.label} label={row.label} value={row.value} />
          ))}
          {summary.deltaV && <InfoRow label="两点电势差 ΔV" value={summary.deltaV} />}
        </div>
      )}
    </div>
  );
}


function PointChargeFieldInfo({
  charges,
  paramValues,
}: {
  charges: Entity[];
  paramValues: ParamValues;
}) {
  if (charges.length === 1) {
    const charge = charges[0]!;
    const qMicroC = (charge.properties.charge as number) ?? 0;
    const chargeSamples = toChargeSamples(charges);
    const eAtOneMeter = computeElectricFieldMagnitudeAtPoint(
      { x: charge.transform.position.x + 1, y: charge.transform.position.y },
      chargeSamples,
    );
    const vAtOneMeter = computePotentialAtPoint(
      { x: charge.transform.position.x + 1, y: charge.transform.position.y },
      chargeSamples,
    );

    return (
      <div className="space-y-2 text-xs" style={{ color: COLORS.text }}>
        <div
          className="rounded px-2.5 py-2"
          style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
        >
          <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
            E = kQ / r²
          </div>
          <div className="mt-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, color: COLORS.textSecondary }}>
            V = kQ / r
          </div>
        </div>

        <div className="space-y-1">
          <InfoRow label="电荷量 Q" value={formatSignedMicroC(qMicroC)} />
          <InfoRow
            label="位置 (x, y)"
            value={`(${charge.transform.position.x.toFixed(2)}, ${charge.transform.position.y.toFixed(2)}) m`}
          />
          <InfoRow label="1 m 处场强 |E|" value={formatCompactNumber(eAtOneMeter, 'N/C')} />
          <InfoRow label="1 m 处电势 V" value={formatCompactNumber(vAtOneMeter, 'V')} />
          <InfoRow label="电场线" value="看方向，箭头指向正试探电荷受力方向" />
          <InfoRow label="等势线" value="同心圆（2D 投影）" />
          <InfoRow label="电势分布" value="热力图：红/橙为正电势高区，蓝为负电势低区" />
        </div>
      </div>
    );
  }

  const sortedCharges = [...charges]
    .slice(0, 2)
    .sort((a, b) => a.transform.position.x - b.transform.position.x);
  const q1 = (sortedCharges[0]!.properties.charge as number) ?? 0;
  const q2 = (sortedCharges[1]!.properties.charge as number) ?? 0;
  const midpoint = {
    x: (sortedCharges[0]!.transform.position.x + sortedCharges[1]!.transform.position.x) / 2,
    y: (sortedCharges[0]!.transform.position.y + sortedCharges[1]!.transform.position.y) / 2,
  };
  const chargeSamples = toChargeSamples(sortedCharges);
  const midpointField = computeElectricFieldMagnitudeAtPoint(midpoint, chargeSamples);
  const midpointPotential = computePotentialAtPoint(midpoint, chargeSamples);
  const presetKey = typeof paramValues.chargePreset === 'string' ? paramValues.chargePreset : 'custom';
  const presetLabel = TWO_CHARGE_PRESET_LABELS[presetKey] ?? '自定义';
  const distanceCm =
    typeof paramValues.distanceCm === 'number'
      ? paramValues.distanceCm
      : Math.hypot(
          sortedCharges[0]!.transform.position.x - sortedCharges[1]!.transform.position.x,
          sortedCharges[0]!.transform.position.y - sortedCharges[1]!.transform.position.y,
        ) * 100;

  let featureText = '场线、等势线和电势热力图都会按叠加原理实时变化';
  if (presetKey === 'dipole') featureText = '电偶极子，中点电势为零';
  if (presetKey === 'same-positive' || presetKey === 'same-negative') featureText = '中点场强为零';
  if (presetKey === 'unequal-dipole') featureText = '场线不对称，部分场线向无穷远延伸';

  return (
    <div className="space-y-2 text-xs" style={{ color: COLORS.text }}>
      <div
        className="rounded px-2.5 py-2"
        style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
      >
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
          E = E₁ + E₂
        </div>
        <div className="mt-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, color: COLORS.textSecondary }}>
          V = kQ₁/r₁ + kQ₂/r₂
        </div>
      </div>

      <div className="space-y-1">
        <InfoRow label="预设配置" value={presetLabel} />
        <InfoRow label="Q1" value={formatSignedMicroC(q1)} />
        <InfoRow label="Q2" value={formatSignedMicroC(q2)} />
        <InfoRow label="间距 d" value={`${distanceCm.toFixed(0)} cm`} />
        <InfoRow label="中点场强 |E|" value={formatCompactNumber(midpointField, 'N/C')} />
        <InfoRow label="中点电势 V" value={formatCompactNumber(midpointPotential, 'V')} />
        <InfoRow label="电势分布" value="红/橙更靠近正电势高区，蓝更靠近负电势低区" />
      </div>

      <div
        className="rounded px-2 py-1.5 text-center"
        style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }}
      >
        {featureText}
      </div>
    </div>
  );
}

// 力类型颜色和中文名统一从 @/core/visual-constants 导入

const DIRECTION_LABELS: Record<string, string> = {
  '0,-1': '↓',
  '0,1': '↑',
  '1,0': '→',
  '-1,0': '←',
};

function directionLabel(dx: number, dy: number): string {
  const key = `${dx},${dy}`;
  return DIRECTION_LABELS[key] ?? `(${dx.toFixed(1)}, ${dy.toFixed(1)})`;
}

/** 检查合力是否与某个独立力完全一致 */
function findRedundantForce(resultant: Force, forces: Force[]): Force | null {
  if (resultant.magnitude < 0.01) return null;
  for (const f of forces) {
    if (
      Math.abs(f.magnitude - resultant.magnitude) < 0.01 &&
      Math.abs(f.direction.x - resultant.direction.x) < 0.01 &&
      Math.abs(f.direction.y - resultant.direction.y) < 0.01
    ) {
      return f;
    }
  }
  return null;
}

function ForceInfo({ analyses }: { analyses: ForceAnalysis[] }) {
  if (analyses.length === 0) {
    return (
      <div className="text-xs" style={{ color: COLORS.textMuted }}>
        无受力数据
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {analyses.map((analysis) => {
        const redundant = findRedundantForce(analysis.resultant, analysis.forces);

        return (
          <div key={analysis.entityId}>
            <table className="w-full text-xs" style={{ color: COLORS.text }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="py-1.5 text-left font-medium" style={{ color: COLORS.textSecondary }}>力</th>
                  <th className="py-1.5 text-right font-medium" style={{ color: COLORS.textSecondary }}>大小</th>
                  <th className="py-1.5 text-center font-medium" style={{ color: COLORS.textSecondary }}>方向</th>
                </tr>
              </thead>
              <tbody>
                {analysis.forces.map((force, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.bgMuted}` }}>
                    <td className="py-1.5">
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: FORCE_COLORS[force.type] ?? COLORS.textMuted }}
                      />
                      <span className="font-medium">{force.label}</span>
                      <span className="ml-1" style={{ color: COLORS.textMuted }}>
                        {FORCE_TYPE_NAMES[force.type] ?? ''}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {force.magnitude.toFixed(2)} N
                    </td>
                    <td className="py-1.5 text-center">
                      {directionLabel(force.direction.x, force.direction.y)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 合力 */}
            <div
              className="mt-2 rounded px-2 py-1.5 text-xs"
              style={{ backgroundColor: COLORS.bgMuted, color: COLORS.text }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">合力</span>
                <span className="tabular-nums">
                  {analysis.resultant.magnitude < 0.01
                    ? '0 N'
                    : `${analysis.resultant.magnitude.toFixed(2)} N ${directionLabel(analysis.resultant.direction.x, analysis.resultant.direction.y)}`}
                </span>
              </div>
              {/* 合力结论 */}
              <div className="mt-0.5" style={{ color: COLORS.textMuted }}>
                {analysis.resultant.magnitude < 0.01
                  ? '合力为零，受力平衡'
                  : redundant
                    ? `= ${redundant.label}（${FORCE_TYPE_NAMES[redundant.type] ?? ''}），其余力平衡`
                    : `沿 ${directionLabel(analysis.resultant.direction.x, analysis.resultant.direction.y)} 方向`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 运动状态视图 ───

function vecMagnitude(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function MotionInfo({ states }: { states: MotionState[] }) {
  if (states.length === 0) {
    return (
      <div className="text-xs" style={{ color: COLORS.textMuted }}>
        无运动数据
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {states.map((state) => {
        const speed = vecMagnitude(state.velocity.x, state.velocity.y);
        const accel = vecMagnitude(state.acceleration.x, state.acceleration.y);
        const isStopped = speed < 0.001 && accel < 0.001;

        return (
          <div key={state.entityId} className="space-y-1.5 text-xs" style={{ color: COLORS.text }}>
            <div className="flex justify-between">
              <span style={{ color: COLORS.textSecondary }}>位置</span>
              <span className="tabular-nums">
                ({state.position.x.toFixed(2)}, {state.position.y.toFixed(2)}) m
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: COLORS.textSecondary }}>速度</span>
              <span className="tabular-nums">
                {speed.toFixed(2)} m/s
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: COLORS.textSecondary }}>加速度</span>
              <span className="tabular-nums">
                {accel.toFixed(2)} m/s²
              </span>
            </div>
            {isStopped && (
              <div
                className="mt-1 rounded px-2 py-1 text-center"
                style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textMuted }}
              >
                物体已停止
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 磁场中带电粒子信息模块 ───

function ParticleInBFieldInfo({
  particle,
  fields,
  motion,
  analysis,
}: {
  particle: Entity;
  fields: Entity[];
  motion: MotionState;
  analysis?: ForceAnalysis;
}) {
  const q = (particle.properties.charge as number) ?? 0;
  const m = Math.max((particle.properties.mass as number) ?? 1, 1e-9);
  const launch = getPointChargeLaunchState(particle);
  const speed = Math.hypot(motion.velocity.x, motion.velocity.y);
  const accel = Math.hypot(motion.acceleration.x, motion.acceleration.y);
  const currentField = sampleMagneticFieldAtPoint(motion.position, fields);
  const configuredFieldMagnitude = Math.max((fields[0]?.properties.magnitude as number) ?? 0, 0);
  const configuredFieldDirection = ((fields[0]?.properties.direction as 'into' | 'out' | undefined) ?? 'into');
  const fieldDirectionLabel = configuredFieldDirection === 'out'
    ? '垂直纸面向外 ·'
    : '垂直纸面向里 ×';
  const lorentzForce = analysis?.forces.find((force) => force.type === 'lorentz');
  const forceMagnitude = lorentzForce?.magnitude ?? m * accel;
  const chargeMagnitude = Math.abs(q);
  const ratio = chargeMagnitude / m;
  const isStraightLine = chargeMagnitude < 1e-9 || !currentField.inField || currentField.magnitude < 1e-9;
  const theoreticalRadius = !isStraightLine && speed > 1e-9
    ? (m * speed) / (chargeMagnitude * currentField.magnitude)
    : null;
  const period = !isStraightLine
    ? (2 * Math.PI * m) / (chargeMagnitude * currentField.magnitude)
    : null;
  const frequency = period && Number.isFinite(period) && period > 0 ? 1 / period : null;
  const currentStateLabel = currentField.inField
    ? '粒子当前位于磁场区域内'
    : '粒子已离开磁场区域，转为匀速直线运动';
  const observation = getMagneticObservation({
    charge: q,
    fieldDirection: configuredFieldDirection,
    inField: currentField.inField,
    magneticField: configuredFieldMagnitude,
  });

  return (
    <div className="space-y-3 text-xs" style={{ color: COLORS.text }}>
      <div
        className="rounded px-2.5 py-2"
        style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
      >
        {isStraightLine ? (
          <>
            <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
              F = qvB = <Val>0 N</Val>
            </div>
            <div className="mt-1" style={{ color: COLORS.textSecondary }}>
              q = 0 或当前不在磁场区域内，粒子做匀速直线运动。
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
              F = |q|vB = <Val>{formatNumber(forceMagnitude)} N</Val>
            </div>
            <div className="mt-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, color: COLORS.textSecondary }}>
              r = mv / (|q|B) = <Val>{formatNumber(theoreticalRadius ?? 0)} m</Val>
            </div>
          </>
        )}
      </div>

      <div className="space-y-1">
        <InfoRow label="电荷量 q" value={`${q > 0 ? '+' : ''}${formatNumber(q)} C`} />
        <InfoRow label="质量 m" value={`${formatNumber(m)} kg`} />
        <InfoRow label="荷质比 |q|/m" value={`${formatNumber(ratio)} C/kg`} />
        <InfoRow label="初速度大小 v0" value={`${formatNumber(launch.speed)} m/s`} />
        <InfoRow label="初速度方向 θ" value={`${launch.angleDeg.toFixed(0)}°`} />
        <InfoRow label="磁感应强度 B" value={`${formatNumber(configuredFieldMagnitude)} T`} />
        <InfoRow label="磁场方向" value={fieldDirectionLabel} />
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: '4px 0' }} />

      <div className="space-y-1">
        <InfoRow label="当前位置" value={`(${formatNumber(motion.position.x)}, ${formatNumber(motion.position.y)}) m`} />
        <InfoRow label="当前速度 v" value={`${formatNumber(speed)} m/s`} />
        <InfoRow label="当前加速度 a" value={`${formatNumber(accel)} m/s²`} />
        <InfoRow label="当前洛伦兹力 F" value={`${formatNumber(forceMagnitude)} N`} />
        <InfoRow label="运动状态" value={currentStateLabel} />
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: '4px 0' }} />

      <div className="space-y-1">
        <InfoRow label="圆周半径 r" value={theoreticalRadius != null ? `${formatNumber(theoreticalRadius)} m` : '—'} />
        <InfoRow label="周期 T" value={period != null ? `${formatNumber(period)} s` : '—'} />
        <InfoRow label="频率 f" value={frequency != null ? `${formatNumber(frequency)} Hz` : '—'} />
      </div>

      <div
        className="rounded px-2 py-1.5"
        style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }}
      >
        <div className="font-medium" style={{ color: COLORS.text }}>观察提示</div>
        <div className="mt-1">{observation}</div>
        {period != null && (
          <div className="mt-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11 }}>
            T = 2πm / (|q|B)，与速度 v 无关。
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 电场中带电粒子公式模块（加速 + 偏转） ───

function TwoStageEFieldInfo({
  particle,
  fields,
  motion,
  accelerationField,
  deflectionField,
}: {
  particle: Entity;
  fields: Entity[];
  motion: MotionState | undefined;
  accelerationField: Entity;
  deflectionField: Entity;
}) {
  const screenEntities = useSimulationStore((s) =>
    Array.from(s.simulationState.scene.entities.values()).filter(isDetectorScreen));
  const analysis = analyzeTwoStageEField(particle, fields, screenEntities);
  const launch = getPointChargeLaunchState(particle);
  const q = (particle.properties.charge as number) ?? 0;
  const m = Math.max((particle.properties.mass as number) ?? 1, 1e-9);
  const speed = motion ? Math.hypot(motion.velocity.x, motion.velocity.y) : launch.speed;
  const angleDeg = motion ? (Math.atan2(motion.velocity.y, motion.velocity.x) * 180) / Math.PI : launch.angleDeg;
  const stoppedOnPlate = particle.properties.stoppedOnPlate === true;
  const stoppedOnScreen = particle.properties.stoppedOnScreen === true;
  const screenHitPoint = particle.properties.screenHitPoint as { x: number; y: number } | undefined;

  if (!analysis) {
    return (
      <div className="text-xs" style={{ color: COLORS.textMuted }}>
        当前两段式电场配置未形成有效的“先加速再偏转”链路。
      </div>
    );
  }

  const accelState = analysis.accelerationState;
  const deflectionState = analysis.deflectionState;
  const entrySpeed = analysis.accelerationExitVelocity
    ? Math.hypot(analysis.accelerationExitVelocity.x, analysis.accelerationExitVelocity.y)
    : null;
  const inAccelerationField = motion
    ? (
        motion.position.x >= accelerationField.transform.position.x &&
        motion.position.x <= accelerationField.transform.position.x + (((accelerationField.properties.width as number) ?? 0)) &&
        motion.position.y >= accelerationField.transform.position.y &&
        motion.position.y <= accelerationField.transform.position.y + (((accelerationField.properties.height as number) ?? 0))
      )
    : true;
  const inDeflectionField = motion
    ? (
        motion.position.x >= deflectionField.transform.position.x &&
        motion.position.x <= deflectionField.transform.position.x + (((deflectionField.properties.width as number) ?? 0)) &&
        motion.position.y >= deflectionField.transform.position.y &&
        motion.position.y <= deflectionField.transform.position.y + (((deflectionField.properties.height as number) ?? 0))
      )
    : false;
  const predictedOutcome = analysis.deflection?.plateCollision
    ? '预计撞板'
    : analysis.deflection?.screenImpact
      ? `预计命中${analysis.deflection.screenImpact.screenLabel ?? '接收屏'}`
      : analysis.accelerationExitBoundary === 'right'
        ? '预计穿出偏转区'
        : '无法进入偏转区';

  return (
    <div className="space-y-2 text-xs" style={{ color: COLORS.text }}>
      <div
        className="rounded px-2.5 py-2"
        style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
      >
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
          qU₁ = ΔEk
        </div>
        <div className="mt-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, color: COLORS.textSecondary }}>
          v₁ = √(v₀² + 2qU₁/m)，y = v₁y t + ½(qE₂/m)t²
        </div>
      </div>

      <div className="space-y-1">
        <InfoRow label="电荷量 q" value={`${q > 0 ? '+' : ''}${formatNumber(q)} C`} />
        <InfoRow label="质量 m" value={`${formatNumber(m)} kg`} />
        <InfoRow label="加速电压 U₁" value={accelState.voltage != null ? `${formatNumber(accelState.voltage)} V` : '—'} />
        <InfoRow label="加速区长度 L₁" value={`${formatNumber(accelState.gap)} m`} />
        <InfoRow label="加速场强 E₁" value={`${formatNumber(Math.abs(accelState.effectiveE))} V/m`} />
        <InfoRow label="偏转电压 U₂" value={deflectionState.voltage != null ? `${formatNumber(deflectionState.voltage)} V` : '—'} />
        <InfoRow label="板间距 d" value={`${formatNumber(deflectionState.gap)} m`} />
        <InfoRow label="极板长度 L₂" value={`${formatNumber(getEFieldPlateSpan(deflectionField))} m`} />
        <InfoRow label="偏转场强 E₂" value={`${formatNumber(Math.abs(deflectionState.effectiveE))} V/m`} />
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: '4px 0' }} />

      <div className="space-y-1">
        <InfoRow label="初速度 v₀" value={`${formatNumber(launch.speed)} m/s`} />
        <InfoRow label="进入偏转区速度 v₁" value={entrySpeed != null ? `${formatNumber(entrySpeed)} m/s` : '—'} />
        <InfoRow label="加速段飞行时间" value={analysis.accelerationExitTime != null ? `${formatNumber(analysis.accelerationExitTime)} s` : '—'} />
        <InfoRow label="预计结果" value={predictedOutcome} />
        <InfoRow
          label={inDeflectionField ? '当前偏角 θ' : '出口偏角 θ'}
          value={analysis.deflection?.exitAngleDeg != null
            ? `${formatNumber(stoppedOnScreen ? analysis.deflection.exitAngleDeg : (inDeflectionField ? angleDeg : analysis.deflection.exitAngleDeg))}°`
            : `${formatNumber(angleDeg)}°`}
        />
        {analysis.deflection?.exitDeflection != null && (
          <InfoRow label="预计出口偏移" value={`${formatNumber(analysis.deflection.exitDeflection)} m`} />
        )}
        {(stoppedOnScreen && screenHitPoint) && (
          <InfoRow label="屏上落点" value={`(${screenHitPoint.x.toFixed(2)}, ${screenHitPoint.y.toFixed(2)}) m`} />
        )}
        {(!stoppedOnScreen && analysis.deflection?.screenImpact) && (
          <InfoRow
            label="预计屏上落点"
            value={`(${analysis.deflection.screenImpact.position.x.toFixed(2)}, ${analysis.deflection.screenImpact.position.y.toFixed(2)}) m`}
          />
        )}
        <InfoRow
          label="当前状态"
          value={
            stoppedOnScreen
              ? '已命中接收屏'
              : stoppedOnPlate
                ? '已撞击偏转极板并停下'
                : inAccelerationField
                  ? '仍在加速段内'
                  : inDeflectionField
                    ? '仍在偏转段内'
                    : analysis.accelerationExitBoundary === 'right'
                      ? '已离开场区，保持离场速度'
                      : '未进入第二段'
          }
        />
      </div>

      <div
        className="rounded px-2 py-1.5"
        style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }}
      >
        <div className="font-medium" style={{ color: COLORS.text }}>分段解读</div>
        <div className="mt-1">
          {analysis.accelerationExitBoundary === 'right'
            ? '第一段只负责建立入口速度，第二段再把这份入口速度转成出口偏角和屏上落点。'
            : '当前参数下粒子没有从加速区右端出射，因此两段式链路会在第一段中断。'}
        </div>
      </div>

      <div
        className="rounded px-2 py-1.5"
        style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }}
      >
        <div className="flex justify-between">
          <span>当前速度</span>
          <span className="tabular-nums" style={{ fontWeight: 500, color: COLORS.text }}>{speed.toFixed(2)} m/s</span>
        </div>
        {motion && (
          <div className="mt-0.5 flex justify-between">
            <span>当前位置</span>
            <span className="tabular-nums" style={{ fontWeight: 500, color: COLORS.text }}>
              ({motion.position.x.toFixed(2)}, {motion.position.y.toFixed(2)}) m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ParticleInEFieldInfo({
  particle,
  efield,
  motion,
}: {
  particle: Entity;
  efield: Entity;
  motion: MotionState | undefined;
}) {
  const fieldState = getUniformEFieldDerivedState(efield);
  const q = (particle.properties.charge as number) ?? 0.005;
  const m = (particle.properties.mass as number) ?? 0.05;
  const voltage = fieldState.voltage ?? null;
  const E = fieldState.effectiveE;
  const gap = fieldState.gap;
  const fieldW = (efield.properties.width as number) ?? 6;
  const fieldH = (efield.properties.height as number) ?? 3;
  const dir = (efield.properties.direction as { x: number; y: number }) ?? { x: 1, y: 0 };
  const launch = getPointChargeLaunchState(particle);
  const initVel = launch.velocity;
  const screenEntities = useSimulationStore((s) =>
    Array.from(s.simulationState.scene.entities.values()).filter(isDetectorScreen));

  const absQ = Math.abs(q);
  const effectiveMagnitude = Math.abs(E);
  const F = absQ * effectiveMagnitude;
  const a = m > 0 ? F / m : 0;
  const speed = motion ? Math.hypot(motion.velocity.x, motion.velocity.y) : launch.speed;
  const stoppedOnPlate = particle.properties.stoppedOnPlate === true;
  const stoppedOnScreen = particle.properties.stoppedOnScreen === true;
  const currentAcceleration = stoppedOnPlate || stoppedOnScreen ? 0 : a;

  // 判断是加速还是偏转：有水平初速度且电场竖直 = 偏转
  const isDeflection = Math.abs(initVel.x) > 0.01 && Math.abs(dir.y) > 0.01;
  const deflectionAnalysis = isDeflection
    ? analyzeParallelPlateDeflection(particle, efield, screenEntities)
    : null;
  const plateLength = isDeflection ? getEFieldPlateSpan(efield) : gap;
  const inField = stoppedOnPlate || stoppedOnScreen
    ? false
    : motion
      ? (
          motion.position.x >= efield.transform.position.x &&
          motion.position.x <= efield.transform.position.x + fieldW &&
          motion.position.y >= efield.transform.position.y &&
          motion.position.y <= efield.transform.position.y + fieldH
        )
      : true;
  const currentAngle = motion ? (Math.atan2(motion.velocity.y, motion.velocity.x) * 180) / Math.PI : launch.angleDeg;
  const displayAngle = stoppedOnScreen && deflectionAnalysis?.exitAngleDeg != null
    ? deflectionAnalysis.exitAngleDeg
    : currentAngle;
  const screenHitPoint = particle.properties.screenHitPoint as { x: number; y: number } | undefined;
  const predictedOutcome = deflectionAnalysis?.plateCollision
    ? '预计撞板'
    : deflectionAnalysis?.screenImpact
      ? `预计命中${deflectionAnalysis.screenImpact.screenLabel ?? '接收屏'}`
      : deflectionAnalysis?.exitPosition
        ? '预计穿出极板'
        : '—';
  const inFieldTravelTime = deflectionAnalysis
    ? (
      deflectionAnalysis.plateCollision
        ? deflectionAnalysis.plateCollision.time - deflectionAnalysis.fieldEntryTime
        : (deflectionAnalysis.fieldExitTime ?? deflectionAnalysis.fieldEntryTime) - deflectionAnalysis.fieldEntryTime
    )
    : null;
  const theoreticalExitSpeed = voltage != null
    ? Math.sqrt(Math.max(launch.speed * launch.speed + (2 * absQ * Math.abs(voltage)) / m, 0))
    : Math.sqrt(Math.max(launch.speed * launch.speed + 2 * a * gap, 0));

  return (
    <div className="space-y-2 text-xs" style={{ color: COLORS.text }}>
      {/* 核心公式 */}
      <div
        className="rounded px-2.5 py-2"
        style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
      >
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
          F = |q|E = <Val>{F.toFixed(3)} N</Val>
        </div>
        <div className="mt-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, color: COLORS.textSecondary }}>
          = {absQ} × {effectiveMagnitude}
        </div>
        <div className="mt-1" style={{ fontSize: 11, color: COLORS.textSecondary }}>
          {getUniformEFieldModelLabel(fieldState.model)}
        </div>
      </div>

      {/* 参数值 */}
      <div className="space-y-1">
        <InfoRow label="电荷量 q" value={`${q > 0 ? '+' : ''}${q} C`} />
        <InfoRow label="质量 m" value={`${m} kg`} />
        <InfoRow label="电容器模型" value={getUniformEFieldModelLabel(fieldState.model)} />
        {voltage != null && <InfoRow label={isDeflection ? '板间电压 U' : '加速电压 U'} value={`${formatNumber(voltage)} V`} />}
        {fieldState.plateCharge != null && <InfoRow label="极板电荷 Q" value={formatCharge(fieldState.plateCharge)} />}
        {fieldState.model !== 'direct' && <InfoRow label="介电常数 εr" value={formatNumber(fieldState.dielectric)} />}
        {gap > 0 && <InfoRow label="场区距离 d" value={`${gap.toFixed(2)} m`} />}
        <InfoRow label="电场强度 E" value={`${formatNumber(effectiveMagnitude)} V/m`} />
        <InfoRow label="电场方向" value={dir.x > 0 ? '→ 水平向右' : dir.x < 0 ? '← 水平向左' : dir.y > 0 ? '↑ 竖直向上' : '↓ 竖直向下'} />
        <InfoRow label="初速度大小 v₀" value={`${launch.speed.toFixed(2)} m/s`} />
        <InfoRow label="初始角度 θ₀" value={`${launch.angleDeg.toFixed(1)}°`} />
        <InfoRow label="分速度 v₀x" value={`${initVel.x.toFixed(2)} m/s`} />
        <InfoRow label="分速度 v₀y" value={`${initVel.y.toFixed(2)} m/s`} />
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: '4px 0' }} />

      {/* 导出量 */}
      <div className="space-y-1">
        <InfoRow label="加速度 a = F/m" value={`${currentAcceleration.toFixed(2)} m/s²`} />
        {isDeflection ? (
          <>
            <InfoRow label="极板长度 L" value={`${fieldW.toFixed(2)} m`} />
            <InfoRow label="极板间距 d" value={`${gap.toFixed(2)} m`} />
            <InfoRow
              label={deflectionAnalysis?.plateCollision ? '预计撞板时间' : '预计穿越时间'}
              value={`${deflectionAnalysis
                ? (inFieldTravelTime ?? 0).toFixed(2)
                : (Math.abs(initVel.x) > 1e-6 ? (plateLength / Math.abs(initVel.x)).toFixed(2) : '—')} s`}
            />
            <InfoRow
              label={deflectionAnalysis?.plateCollision ? '预计撞板偏移' : '预计出口偏移'}
              value={deflectionAnalysis?.plateCollision
                ? `${(deflectionAnalysis.plateCollision.position.y - particle.transform.position.y).toFixed(2)} m`
                : deflectionAnalysis?.exitDeflection != null
                  ? `${deflectionAnalysis.exitDeflection.toFixed(2)} m`
                  : '—'}
            />
            <InfoRow label={inField ? '当前偏角 θ' : '出口偏角 θ'} value={`${displayAngle.toFixed(1)}°`} />
            <InfoRow label="预计结果" value={predictedOutcome} />
            {(stoppedOnScreen && screenHitPoint) && (
              <InfoRow label="屏上落点" value={`(${screenHitPoint.x.toFixed(2)}, ${screenHitPoint.y.toFixed(2)}) m`} />
            )}
            {(!stoppedOnScreen && deflectionAnalysis?.screenImpact) && (
              <InfoRow
                label="预计屏上落点"
                value={`(${deflectionAnalysis.screenImpact.position.x.toFixed(2)}, ${deflectionAnalysis.screenImpact.position.y.toFixed(2)}) m`}
              />
            )}
            <InfoRow
              label="离场后状态"
              value={
                stoppedOnScreen
                  ? '已命中接收屏'
                  : stoppedOnPlate
                    ? '已撞击极板并停下'
                    : inField
                      ? '仍在场内偏转'
                      : '保持离场速度匀速前进'
              }
            />
          </>
        ) : (
          <>
            <InfoRow label="加速距离 d" value={`${plateLength.toFixed(2)} m`} />
            <InfoRow label="理论出口速度 v" value={`${theoreticalExitSpeed.toFixed(2)} m/s`} />
            <InfoRow label="离场后状态" value={stoppedOnPlate ? '已到达极板并停下' : inField ? '仍在场内加速' : '保持离场速度匀速前进'} />
          </>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: '4px 0' }} />

      {/* 公式推导 */}
      {isDeflection ? (
        <DeflectionFormulas
          fieldState={fieldState}
          q={absQ}
          m={m}
          E={effectiveMagnitude}
          v0x={initVel.x}
          v0y={initVel.y}
          L={plateLength}
          a={a}
          travelTime={inFieldTravelTime}
          travelDistance={deflectionAnalysis?.horizontalTravelDistance ?? null}
          targetLabel={deflectionAnalysis?.plateCollision ? '撞板前' : '出场前'}
        />
      ) : (
        <AccelerationFormulas
          fieldState={fieldState}
          q={absQ}
          m={m}
          E={effectiveMagnitude}
          d={gap}
          v0={launch.speed}
          a={a}
        />
      )}

      {/* 运动实时状态 */}
      <div
        className="rounded px-2 py-1.5"
        style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }}
      >
        <div className="flex justify-between">
          <span>当前速度</span>
          <span className="tabular-nums" style={{ fontWeight: 500, color: COLORS.text }}>{speed.toFixed(2)} m/s</span>
        </div>
        {motion && (
          <div className="flex justify-between mt-0.5">
            <span>当前位置</span>
            <span className="tabular-nums" style={{ fontWeight: 500, color: COLORS.text }}>
              ({motion.position.x.toFixed(2)}, {motion.position.y.toFixed(2)}) m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** 高亮数值 */
function Val({ children }: { children: React.ReactNode }) {
  return <span style={{ color: COLORS.primary, fontWeight: 600 }}>{children}</span>;
}

type UniformEFieldState = ReturnType<typeof getUniformEFieldDerivedState>;

function FieldModelFormula({ state }: { state: UniformEFieldState }) {
  if (state.model === 'constant-charge') {
    return (
      <>
        <div style={{ color: COLORS.textSecondary }}>
          C = ε₀εrS/d = <Val>{formatNumber(state.capacitance ?? 0)} F</Val>
        </div>
        <div style={{ color: COLORS.textSecondary }}>
          E = Q/(ε₀εrS) = <Val>{formatNumber(Math.abs(state.effectiveE))} V/m</Val>
        </div>
        <div style={{ color: COLORS.textSecondary }}>
          U = Ed = Q/C = <Val>{formatNumber(state.voltage ?? 0)} V</Val>
        </div>
      </>
    );
  }

  if (state.model === 'constant-voltage') {
    return (
      <>
        <div style={{ color: COLORS.textSecondary }}>
          C = ε₀εrS/d = <Val>{formatNumber(state.capacitance ?? 0)} F</Val>
        </div>
        <div style={{ color: COLORS.textSecondary }}>
          E = U/d = {formatNumber(state.voltage ?? 0)}/{formatNumber(state.gap)} = <Val>{formatNumber(Math.abs(state.effectiveE))} V/m</Val>
        </div>
        <div style={{ color: COLORS.textSecondary }}>
          Q = CU = <Val>{formatCharge(state.plateCharge ?? 0)}</Val>
        </div>
      </>
    );
  }

  return (
    <div style={{ color: COLORS.textSecondary }}>
      E = magnitude = <Val>{formatNumber(Math.abs(state.effectiveE))} V/m</Val>
    </div>
  );
}

/** 加速公式推导 */
function AccelerationFormulas({
  fieldState,
  q,
  m,
  E,
  d,
  v0,
  a,
}: {
  fieldState: UniformEFieldState;
  q: number;
  m: number;
  E: number;
  d: number;
  v0: number;
  a: number;
}) {
  const voltage = fieldState.voltage ?? null;
  const v = voltage != null
    ? Math.sqrt(Math.max(v0 * v0 + (2 * q * Math.abs(voltage)) / m, 0))
    : Math.sqrt(Math.max(v0 * v0 + 2 * a * d, 0));
  return (
    <div className="space-y-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, lineHeight: 1.8 }}>
      <div style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: 500, marginBottom: 2 }}>公式推导</div>
      <div style={{ color: COLORS.textSecondary }}>
        F = qE = {q} × {E} = <Val>{(q * E).toFixed(3)} N</Val>
      </div>
      <div style={{ color: COLORS.textSecondary }}>
        a = F/m = {(q * E).toFixed(3)} / {m} = <Val>{a.toFixed(2)} m/s²</Val>
      </div>
      <FieldModelFormula state={fieldState} />
      <div style={{ color: COLORS.textSecondary }}>
        {voltage != null
          ? <>qU = ΔE<sub>k</sub>，v = √(v₀² + 2qU/m) = <Val>{v.toFixed(2)} m/s</Val></>
          : <>v = √(v₀² + 2ad) = <Val>{v.toFixed(2)} m/s</Val></>}
      </div>
      <div style={{ color: COLORS.textSecondary }}>
        W = qEd = {q}×{E}×{d} = <Val>{(q * E * d).toFixed(3)} J</Val>
      </div>
    </div>
  );
}

/** 偏转公式推导 */
function DeflectionFormulas({
  fieldState,
  q,
  m,
  E,
  v0x,
  v0y,
  L,
  a,
  travelTime,
  travelDistance,
  targetLabel,
}: {
  fieldState: UniformEFieldState;
  q: number;
  m: number;
  E: number;
  v0x: number;
  v0y: number;
  L: number;
  a: number;
  travelTime?: number | null;
  travelDistance?: number | null;
  targetLabel?: string;
}) {
  const absV0x = Math.abs(v0x);
  const horizontalDistance = travelDistance ?? L;
  const t = travelTime ?? (absV0x > 1e-6 ? horizontalDistance / absV0x : 0);
  const yDeflect = v0y * t + 0.5 * a * t * t;
  const vy = v0y + a * t;
  const tanTheta = absV0x > 1e-6 ? vy / v0x : 0;
  return (
    <div className="space-y-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, lineHeight: 1.8 }}>
      <div style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: 500, marginBottom: 2 }}>公式推导</div>
      <div style={{ color: COLORS.textSecondary }}>
        v₀x = v₀cosθ₀，v₀y = v₀sinθ₀
      </div>
      <div style={{ color: COLORS.textSecondary }}>
        {absV0x > 1e-6
          ? <>t = Δx/|v₀x| = {horizontalDistance.toFixed(2)}/{absV0x.toFixed(2)} = <Val>{t.toFixed(2)} s</Val></>
          : <>t = L/|v₀x|：<Val>v₀x = 0，无法定义完整穿越时间</Val></>}
      </div>
      <div style={{ color: COLORS.textSecondary }}>
        a = qE/m = {q}×{E}/{m} = <Val>{a.toFixed(2)} m/s²</Val>
      </div>
      <div style={{ color: COLORS.textSecondary }}>
        v₀ = ({v0x.toFixed(2)}, {v0y.toFixed(2)}) m/s
      </div>
      <FieldModelFormula state={fieldState} />
      <div style={{ color: COLORS.textSecondary }}>
        {absV0x > 1e-6
          ? <>{targetLabel ?? '出场前'} y = v₀y t + ½at² = {v0y.toFixed(2)}×{t.toFixed(2)} + ½×{a.toFixed(2)}×{t.toFixed(2)}² = <Val>{yDeflect.toFixed(2)} m</Val></>
          : <>y = v₀y t + ½at²：<Val>需先给出非零 v₀x</Val></>}
      </div>
      <div style={{ color: COLORS.textSecondary }}>
        {absV0x > 1e-6
          ? <>v<sub>y</sub> = v₀y + at = {v0y.toFixed(2)} + {a.toFixed(2)}×{t.toFixed(2)} = <Val>{vy.toFixed(2)} m/s</Val></>
          : <>v<sub>y</sub> = v₀y + at：<Val>需先给出非零 v₀x</Val></>}
      </div>
      <div style={{ color: COLORS.textSecondary }}>
        {absV0x > 1e-6
          ? <>tanθ = v<sub>y</sub>/v<sub>x</sub> = {vy.toFixed(2)}/{v0x.toFixed(2)} = <Val>{tanTheta.toFixed(3)}</Val></>
          : <>tanθ = v<sub>y</sub>/v<sub>x</sub>：<Val>v₀x = 0，无法定义</Val></>}
      </div>
    </div>
  );
}

// ─── 电场信息视图（平行板电容器） ───

function EFieldInfo({ entity }: { entity: Entity }) {
  const fieldState = getUniformEFieldDerivedState(entity);
  const voltage = fieldState.voltage ?? null;
  const d = fieldState.gap;
  const W = fieldState.plateSpan;
  const E = Math.abs(fieldState.effectiveE);
  const ratio = d > 0 ? W / d : 0;
  const C = fieldState.capacitance;
  const Q = fieldState.plateCharge;

  return (
    <div className="space-y-2 text-xs" style={{ color: COLORS.text }}>
      {/* 核心公式 */}
      <div
        className="rounded px-2.5 py-2"
        style={{ backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primaryDisabled}` }}
      >
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
          {getUniformEFieldModelLabel(fieldState.model)} · E = {E.toFixed(1)} V/m
        </div>
        <div className="mt-1" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, color: COLORS.textSecondary }}>
          <FieldModelFormula state={fieldState} />
        </div>
        <div className="mt-1" style={{ fontSize: 11, color: COLORS.textSecondary }}>
          {fieldState.model === 'constant-charge'
            ? '定电荷模型（与电源断开）：改变 Q 会直接改变 E，改变 εr 会反向改变 E。'
            : fieldState.model === 'constant-voltage'
              ? '恒压模型（接电源）：εr 影响电容 C 和极板电荷 Q，不直接改变板间 E。'
              : '当前按直接设定 E 处理，未通过电容器 U / Q 推导板间场强。'}
        </div>
      </div>

      {/* 参数值 */}
      <div className="space-y-1">
        <InfoRow label="电容器模型" value={getUniformEFieldModelLabel(fieldState.model)} />
        {voltage != null && <InfoRow label="电压 U" value={`${formatNumber(voltage)} V`} />}
        <InfoRow label="间距 d" value={`${d.toFixed(2)} m`} />
        {fieldState.model !== 'direct' && (
          <InfoRow label="介电常数 εr" value={`${fieldState.dielectric.toFixed(1)}${fieldState.dielectric === 1 ? '（空气）' : fieldState.dielectric <= 2 ? '（聚乙烯）' : fieldState.dielectric <= 3 ? '（玻璃）' : '（陶瓷）'}`} />
        )}
        <InfoRow label="极板宽度 W" value={`${W.toFixed(1)} m`} />
      </div>

      {/* 分隔线 */}
      <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: '4px 0' }} />

      {/* 导出量 */}
      <div className="space-y-1">
        <InfoRow label="电容 C" value={C != null ? formatCapacitance(C) : '—'} />
        <InfoRow label="电荷 Q" value={Q != null ? formatCharge(Q) : '—'} />
        <InfoRow label="W/d 比值" value={ratio.toFixed(1)} />
      </div>

      {/* 场类型提示 */}
      <div
        className="rounded px-2 py-1.5 text-center"
        style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }}
      >
        {ratio > 5 ? '边缘效应可忽略 — 近似匀强电场' :
          ratio > 3 ? '弱边缘效应 — 中央区域匀强' :
            '边缘效应明显 — 注意非均匀区域'}
      </div>
    </div>
  );
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-2)) return value.toExponential(2);
  return value.toFixed(2);
}

function getMagneticObservation({
  charge,
  magneticField,
  fieldDirection,
  inField,
}: {
  charge: number;
  magneticField: number;
  fieldDirection: 'into' | 'out';
  inField: boolean;
}): string {
  if (Math.abs(charge) < 1e-9) {
    return '当 q = 0 时，洛伦兹力始终为 0，轨迹保持直线。';
  }

  if (!inField || magneticField < 1e-9) {
    return '粒子离开磁场区域后，不再受洛伦兹力作用，后续保持匀速直线运动。';
  }

  if (charge > 0) {
    return fieldDirection === 'into'
      ? '当前是正电荷且磁场向里，粒子会按右手定则向速度左侧偏转。'
      : '当前是正电荷且磁场向外，粒子会按右手定则向速度右侧偏转。';
  }

  return fieldDirection === 'into'
    ? '当前是负电荷且磁场向里，偏转方向与正电荷完全相反。'
    : '当前是负电荷且磁场向外，偏转方向与正电荷完全相反。';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: COLORS.textSecondary }}>{label}</span>
      <span className="tabular-nums" style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function formatCapacitance(c: number): string {
  if (c === 0) return '0 F';
  if (c >= 1e-6) return `${(c * 1e6).toFixed(2)} μF`;
  if (c >= 1e-9) return `${(c * 1e9).toFixed(2)} nF`;
  return `${(c * 1e12).toFixed(2)} pF`;
}

function formatCharge(q: number): string {
  if (q === 0) return '0 C';
  if (Math.abs(q) >= 1e-3) return `${(q * 1e3).toFixed(2)} mC`;
  if (Math.abs(q) >= 1e-6) return `${(q * 1e6).toFixed(2)} μC`;
  if (Math.abs(q) >= 1e-9) return `${(q * 1e9).toFixed(2)} nC`;
  return `${(q * 1e12).toFixed(2)} pC`;
}
