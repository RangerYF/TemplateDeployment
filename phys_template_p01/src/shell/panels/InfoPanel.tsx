import type { ReactNode } from 'react';
import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import { COLORS } from '@/styles/tokens';
import { FORCE_COLORS, FORCE_TYPE_NAMES } from '@/core/visual-constants';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

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
export function InfoPanel() {
  const storeResult = useSimulationStore((s) => s.simulationState.currentResult);
  const duration = useSimulationStore((s) => s.simulationState.timeline.duration);
  const result = storeResult ?? simulator.getCurrentResult();
  const isDynamic = duration > 0;

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
        {!result ? (
          <div
            className="flex h-full items-center justify-center text-xs"
            style={{ color: COLORS.textMuted }}
          >
            加载预设后显示物理信息
          </div>
        ) : (
          <div className="space-y-4">
            {result.forceAnalyses.size > 0 && (
              <section>
                <SectionTitle>受力分析</SectionTitle>
                <ForceInfo analyses={Array.from(result.forceAnalyses.values())} />
              </section>
            )}

            {/* 动态预设始终显示运动状态 */}
            {isDynamic && result.motionStates.size > 0 && (
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
                      {force.magnitude.toFixed(1)} N
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
                    : `${analysis.resultant.magnitude.toFixed(1)} N ${directionLabel(analysis.resultant.direction.x, analysis.resultant.direction.y)}`}
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
              <span style={{ color: COLORS.textSecondary }}>位移</span>
              <span className="tabular-nums">
                {state.position.x.toFixed(2)} m
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
