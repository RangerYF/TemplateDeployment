import { useRef, useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { useFunctionStore } from '@/editor/store/functionStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { editorInstance } from '@/editor/core/Editor';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import { getTemplate, buildTemplateExpr } from '@/engine/functionTemplates';
import type { FunctionParam } from '@/types';
import { COLORS } from '@/styles/colors';
import { focusRing } from '@/styles/interactionStyles';

// ─── Component ───────────────────────────────────────────────────────────────

export function TemplateParamPanel() {
  const activeFunctionId  = useFunctionStore((s) => s.activeFunctionId);
  const activeFunction    = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId) ?? null,
  );
  const isGlobalAnimating = useAnimationStore((s) => s.isAnyAnimating);

  // Local string drafts for each input box (keyed by param name)
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Snapshot of namedParams at the start of a slider drag (for Undo "before")
  const snapRef = useRef<FunctionParam[] | null>(null);

  // Sync drafts when active function changes (e.g. switching functions or after Undo/Redo)
  useEffect(() => {
    const fn = useFunctionStore.getState().functions.find((f) => f.id === activeFunctionId);
    if (!fn?.namedParams) {
      setDrafts({});
      return;
    }
    setDrafts(
      Object.fromEntries(fn.namedParams.map((p) => [p.name, String(p.value)])),
    );
  }, [activeFunctionId]);

  // Show for template functions OR custom functions with detected coefficients
  if (!activeFunction) return null;
  if (!activeFunction.templateId && activeFunction.namedParams.length === 0) return null;

  const template    = activeFunction.templateId ? getTemplate(activeFunction.templateId) : null;
  const headerExpr  = template?.displayExpr ?? activeFunction.exprStr;

  const { namedParams } = activeFunction;
  const fnId = activeFunction.id;

  // Build the store update patch for a single param change.
  // Template functions regenerate exprStr; custom functions only update namedParams
  // (exprStr stays as the user typed it, scope provides coefficient values).
  const buildUpdate = (paramName: string, value: number) => {
    const newParams = namedParams.map((p) =>
      p.name === paramName ? { ...p, value } : p,
    );
    if (activeFunction.templateId) {
      const newExpr = buildTemplateExpr(activeFunction.templateId, newParams);
      return { namedParams: newParams, ...(newExpr !== null ? { exprStr: newExpr } : {}) };
    }
    return { namedParams: newParams };
  };

  // ── Slider handlers ───────────────────────────────────────────────────────

  const handleSliderChange = (paramName: string, value: number) => {
    // Capture "before" snapshot once per drag
    if (snapRef.current === null) {
      snapRef.current = namedParams.map((p) => ({ ...p }));
    }
    // Live update store (no command — mid-drag)
    useFunctionStore.getState().updateFunction(fnId, buildUpdate(paramName, value));
    // Sync draft string
    setDrafts((d) => ({ ...d, [paramName]: String(value) }));
  };

  const handleSliderCommit = (paramName: string, value: number) => {
    const before = snapRef.current ?? namedParams.map((p) => ({ ...p }));
    snapRef.current = null;

    const beforeParam = before.find((p) => p.name === paramName);
    if (beforeParam?.value === value) return;

    const beforeExpr = buildTemplateExpr(activeFunction.templateId!, before);
    editorInstance?.execute(
      new UpdateFunctionParamCommand(
        fnId,
        {
          namedParams: before,
          ...(beforeExpr !== null ? { exprStr: beforeExpr } : {}),
        },
        buildUpdate(paramName, value),
        `调整参数 ${paramName}`,
      ),
    );
  };

  // ── Input handlers ────────────────────────────────────────────────────────

  const handleInputChange = (paramName: string, raw: string) => {
    setDrafts((d) => ({ ...d, [paramName]: raw }));

    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      // Live update store without recording a command
      useFunctionStore.getState().updateFunction(fnId, buildUpdate(paramName, parsed));
    }
  };

  const handleInputCommit = (paramName: string) => {
    const raw    = drafts[paramName] ?? '';
    const parsed = parseFloat(raw);

    if (isNaN(parsed)) {
      // Revert draft to current store value
      const current = namedParams.find((p) => p.name === paramName);
      setDrafts((d) => ({ ...d, [paramName]: String(current?.value ?? 0) }));
      return;
    }

    const before     = namedParams.map((p) => ({ ...p }));
    const beforeParam = before.find((p) => p.name === paramName);
    if (beforeParam?.value === parsed) return;

    const beforeExpr = buildTemplateExpr(activeFunction.templateId!, before);
    editorInstance?.execute(
      new UpdateFunctionParamCommand(
        fnId,
        {
          namedParams: before,
          ...(beforeExpr !== null ? { exprStr: beforeExpr } : {}),
        },
        buildUpdate(paramName, parsed),
        `调整参数 ${paramName}`,
      ),
    );

    setDrafts((d) => ({ ...d, [paramName]: String(parsed) }));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, paramName: string) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      const current = namedParams.find((p) => p.name === paramName);
      setDrafts((d) => ({ ...d, [paramName]: String(current?.value ?? 0) }));
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Header */}
      <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, margin: '0 0 2px' }}>
        {activeFunction.templateId ? '函数参数' : '自定义常量'}
      </p>
      <p style={{
        fontSize: '11px',
        color: COLORS.textSecondary,
        margin: '0 0 10px',
        fontFamily: 'monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {headerExpr}
      </p>

      {/* Param rows */}
      {namedParams.map((param) => {
        const spec  = template?.defaultParams.find((p) => p.name === param.name);
        const draft = drafts[param.name] ?? String(param.value);

        return (
          <div key={param.name} style={{ marginBottom: param.hint ? '4px' : '10px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '18px 80px 1fr',
              alignItems: 'center',
              gap: '6px',
            }}>
              {/* Param label + hint tooltip */}
              <span
                title={param.hint ?? ''}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: COLORS.primary,
                  fontFamily: 'monospace',
                  cursor: param.hint ? 'help' : undefined,
                }}
              >
                {param.label}
              </span>

              {/* Numeric input box */}
              <input
                type="text"
                inputMode="decimal"
                value={draft}
                disabled={isGlobalAnimating}
                onChange={(e) => handleInputChange(param.name, e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(e, param.name)}
                style={{ ...inputStyle, transition: 'border-color 0.15s, box-shadow 0.15s' }}
                {...focusRing(undefined, undefined, undefined, { onBlur: () => handleInputCommit(param.name) })}
              />

              {/* Slider */}
              <Slider
                min={spec?.min ?? -10}
                max={spec?.max ??  10}
                step={spec?.step ?? 0.1}
                value={[param.value]}
                disabled={isGlobalAnimating}
                onValueChange={([v]) => handleSliderChange(param.name, v)}
                onValueCommit={([v]) => handleSliderCommit(param.name, v)}
              />
            </div>

            {/* Semantic hint below the row */}
            {param.hint && (
              <p style={{
                fontSize: '10px',
                color: COLORS.textSecondary,
                margin: '2px 0 8px 24px',
                fontFamily: 'sans-serif',
              }}>
                {param.hint}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,   // prevent form-element intrinsic min-width from expanding grid cell
  padding: '3px 6px',
  fontSize: '12px',
  fontFamily: 'monospace',
  color: COLORS.textPrimary,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '10px',
  textAlign: 'right',
  outline: 'none',
  boxSizing: 'border-box',
};
