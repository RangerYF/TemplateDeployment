import { useState, useMemo, useRef, useCallback } from 'react';
import { useEntityStore } from '@/editor';
import type { Entity } from '@/editor/entities/types';
import { calculate } from '@/engine/math';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { TeX } from '@/components/ui/TeX';
import { CalcStepsModal } from './CalcStepsModal';
import type { CalcStep } from '@/engine/math/types';

export function MeasurementDisplay() {
  // ─── EntityStore 数据源 ───
  const entities = useEntityStore((s) => s.entities);
  const activeGeometryId = useEntityStore((s) => s.activeGeometryId);

  const geometry = useMemo(() => {
    if (!activeGeometryId) return null;
    const e = entities[activeGeometryId];
    return e?.type === 'geometry' ? (e as Entity<'geometry'>) : null;
  }, [activeGeometryId, entities]);

  const currentType = geometry?.properties.geometryType;
  const currentParams = geometry?.properties.params;

  const [activeSteps, setActiveSteps] = useState<{
    title: string;
    steps: CalcStep[];
  } | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-clickable]')) return;
    e.preventDefault();
    e.stopPropagation();
    const panel = panelRef.current;
    if (!panel) return;
    const parent = panel.parentElement;
    if (!parent) return;

    let origX: number;
    let origY: number;
    if (position) {
      origX = position.x;
      origY = position.y;
    } else {
      const parentRect = parent.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      origX = panelRect.left - parentRect.left;
      origY = panelRect.top - parentRect.top;
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX, origY };
    panel.setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const result = useMemo(
    () => currentType && currentParams
      ? calculate(currentType, currentParams as unknown as Record<string, number>)
      : null,
    [currentType, currentParams],
  );

  if (!result) return null;

  const posStyle = position
    ? { left: position.x, top: position.y }
    : { right: 16, top: 16 };

  return (
    <>
      <div
        ref={panelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'absolute',
          ...posStyle,
          backgroundColor: COLORS.bg,
          borderRadius: RADIUS.sm,
          boxShadow: SHADOWS.md,
          border: `1px solid ${COLORS.border}`,
          padding: '10px 14px',
          minWidth: 160,
          zIndex: 10,
          fontSize: 14,
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <Row
          label="V"
          fullLabel="体积"
          value={result.volume.value}
          steps={result.volume.steps}
          onClick={() =>
            setActiveSteps({ title: '体积计算步骤', steps: result.volume.steps })
          }
        />
        <Row
          label="S"
          fullLabel="表面积"
          value={result.surfaceArea.value}
          steps={result.surfaceArea.steps}
          onClick={() =>
            setActiveSteps({
              title: '表面积计算步骤',
              steps: result.surfaceArea.steps,
            })
          }
        />
        <div style={{ fontSize: 10, color: COLORS.textPlaceholder, marginTop: 4, textAlign: 'center' }}>
          点击查看推导过程
        </div>
      </div>

      {activeSteps && (
        <CalcStepsModal
          title={activeSteps.title}
          steps={activeSteps.steps}
          onClose={() => setActiveSteps(null)}
        />
      )}
    </>
  );
}

/**
 * 从 steps 中找到 label 为"体积公式"或"表面积公式"的步骤，提取等号右侧。
 * 仅匹配整体公式（如 V = ⅓πr²h），不匹配分项公式（如侧面积公式）。
 */
function extractFormula(label: string, steps: CalcStep[]): string | null {
  const targetLabels = label === 'V' ? ['体积公式'] : ['表面积公式'];
  const formulaStep = steps.find((s) => targetLabels.includes(s.label));
  if (!formulaStep) return null;
  const eqIdx = formulaStep.latex.indexOf('=');
  return eqIdx >= 0 ? formulaStep.latex.slice(eqIdx + 1).trim() : formulaStep.latex;
}

function Row({
  label,
  fullLabel,
  value,
  steps,
  onClick,
}: {
  label: string;
  fullLabel: string;
  value: { latex: string; numeric: number };
  steps: CalcStep[];
  onClick: () => void;
}) {
  const approx = value.numeric.toFixed(2);
  const isExact =
    value.latex === String(Math.round(value.numeric)) &&
    Math.abs(value.numeric - Math.round(value.numeric)) < 1e-9;

  // 仅含 π 时展示公式：体积 V = 公式 = 结果 ≈ 数值
  const showFormula = value.latex.includes('\\pi');
  const formula = showFormula ? extractFormula(label, steps) : null;

  // 含 π：V = 公式 ≈ 近似值
  // 不含 π 且精确：V = 值
  // 不含 π 且非精确：V ≈ 近似值
  let displayLatex: string;
  if (formula) {
    displayLatex = `${label} = ${formula} \\approx ${approx}`;
  } else if (isExact) {
    displayLatex = `${label} = ${value.latex}`;
  } else {
    displayLatex = `${label} \\approx ${approx}`;
  }

  return (
    <div
      data-clickable
      onClick={onClick}
      style={{
        padding: '4px 0',
        cursor: 'pointer',
        color: COLORS.text,
      }}
      title="点击查看计算步骤"
    >
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>
        {fullLabel}
      </div>
      <div style={{ fontSize: 13 }}>
        <TeX math={displayLatex} />
      </div>
    </div>
  );
}
