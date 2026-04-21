import { useState, useEffect, useRef } from 'react';
import { useFunctionStore } from '@/editor/store/functionStore';
import { editorInstance } from '@/editor/core/Editor';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import { compileExpression, isParseError } from '@/engine/expressionEngine';
import { getKnownFunctionNames } from '@/engine/compositionEngine';
import { detectAndMergeCoefficients } from '@/engine/coefficientDetector';
import { COLORS } from '@/styles/colors';
import { pillHover, focusRing } from '@/styles/interactionStyles';

// ─── Quick-insert symbol buttons ─────────────────────────────────────────────

const QUICK_SYMBOLS: { label: string; insert: string; cursorBack?: number }[] = [
  { label: 'sin',  insert: 'sin()',  cursorBack: 1 },
  { label: 'cos',  insert: 'cos()',  cursorBack: 1 },
  { label: 'tan',  insert: 'tan()',  cursorBack: 1 },
  { label: 'sqrt', insert: 'sqrt()', cursorBack: 1 },
  { label: 'abs',  insert: 'abs()',  cursorBack: 1 },
  { label: 'log',  insert: 'log()',  cursorBack: 1 },
  { label: 'x',    insert: 'x' },
  { label: 'π',    insert: 'pi' },
  { label: 'e',    insert: 'e' },
  { label: 'x²',   insert: 'x^2' },
  { label: 'x³',   insert: 'x^3' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function FunctionInputPanel() {
  const activeFunctionId = useFunctionStore((s) => s.activeFunctionId);
  const functions        = useFunctionStore((s) => s.functions);

  const activeFunction = functions.find((f) => f.id === activeFunctionId) ?? null;

  // Local draft state — synced from the active function's exprStr
  const [draft, setDraft]         = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  // Track the last committed (valid) exprStr for blur/Enter revert
  const lastValidExpr = useRef('');

  // Sync draft when active function changes.
  // Read from store directly so the dep array only needs activeFunctionId.
  useEffect(() => {
    if (!activeFunctionId) { setDraft(''); setParseError(null); return; }
    const fn = useFunctionStore.getState().functions.find((f) => f.id === activeFunctionId);
    if (!fn) { setDraft(''); setParseError(null); return; }
    setDraft(fn.exprStr);
    lastValidExpr.current = fn.exprStr;
    setParseError(null);
  }, [activeFunctionId]);

  const inputRef = useRef<HTMLInputElement>(null);

  if (!activeFunction) {
    return (
      <div style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '12px', color: COLORS.textSecondary, margin: 0 }}>
          请先选择一个函数
        </p>
      </div>
    );
  }

  // ── Live change: validate and update store (no Command) ───────────────
  const handleChange = (value: string) => {
    setDraft(value);
    const knownFns = getKnownFunctionNames(
      useFunctionStore.getState().functions,
      activeFunction?.id,
    );
    const compiled = compileExpression(value, knownFns);
    if (isParseError(compiled)) {
      setParseError(compiled.error);
    } else {
      setParseError(null);
      // Live preview: update store directly (not recorded as Undo step)
      useFunctionStore.getState().updateFunction(activeFunction.id, { exprStr: value });
    }
  };

  // ── Commit: write UpdateFunctionParamCommand (Undo-recordable) ────────
  const handleCommit = () => {
    if (parseError !== null || !draft.trim()) {
      // Revert to last valid expr
      setDraft(lastValidExpr.current);
      setParseError(null);
      useFunctionStore.getState().updateFunction(activeFunction.id, {
        exprStr: lastValidExpr.current,
      });
      return;
    }

    if (draft === lastValidExpr.current) return; // no change

    // Auto-detect free coefficients (e.g. a, b, c in "a*x^2 + b*x + c")
    // Merge with existing namedParams to preserve user-set values.
    const currentFn = useFunctionStore.getState().functions.find(
      (f) => f.id === activeFunction.id,
    );
    const existingParams = currentFn?.namedParams ?? [];
    const mergedParams   = detectAndMergeCoefficients(draft, existingParams) ?? existingParams;

    const before = { exprStr: lastValidExpr.current, namedParams: existingParams };
    const after  = { exprStr: draft, namedParams: mergedParams };
    editorInstance?.execute(new UpdateFunctionParamCommand(activeFunction.id, before, after));
    lastValidExpr.current = draft;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      // Revert without committing
      setDraft(lastValidExpr.current);
      setParseError(null);
      inputRef.current?.blur();
    }
  };

  // ── Quick symbol insertion ────────────────────────────────────────────
  const handleInsert = (e: React.MouseEvent, text: string, cursorBack = 0) => {
    e.preventDefault(); // prevent input blur
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? draft.length;
    const end   = input.selectionEnd   ?? draft.length;
    const newValue = draft.slice(0, start) + text + draft.slice(end);
    handleChange(newValue);

    // Place cursor inside parentheses when cursorBack > 0 (e.g. sin|)
    const cursorPos = start + text.length - cursorBack;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const isValid = parseError === null;

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Title */}
      <p
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: COLORS.textSecondary,
          margin: '0 0 6px',
        }}
      >
        {activeFunction.label} =
      </p>

      {/* Input row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '10px',
          border: `1px solid ${isValid ? COLORS.border : COLORS.error}`,
          background: COLORS.surface,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        {...focusRing(COLORS.primary, COLORS.primaryFocusRing, isValid ? COLORS.border : COLORS.error)}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          placeholder="输入表达式，例如 sin(x)"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '13px',
            color: isValid ? COLORS.textPrimary : COLORS.error,
            fontFamily: 'monospace',
          }}
        />
        {/* Valid / invalid indicator */}
        <span style={{ fontSize: '14px', flexShrink: 0 }}>
          {isValid ? (
            <span style={{ color: COLORS.primary }}>✓</span>
          ) : (
            <span style={{ color: COLORS.error }}>✗</span>
          )}
        </span>
      </div>

      {/* Error message */}
      {parseError && (
        <p
          style={{
            fontSize: '11px',
            color: COLORS.error,
            margin: '4px 0 0',
            wordBreak: 'break-word',
          }}
        >
          ⚠ {parseError}
        </p>
      )}

      {/* Quick symbol buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          marginTop: '8px',
        }}
      >
        {QUICK_SYMBOLS.map(({ label, insert, cursorBack }) => (
          <button
            key={label}
            onMouseDown={(e) => handleInsert(e, insert, cursorBack)}
            style={{
              padding: '2px 7px',
              fontSize: '12px',
              borderRadius: '9999px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surfaceAlt,
              color: COLORS.textSecondary,
              cursor: 'pointer',
              fontFamily: 'monospace',
              transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            }}
            {...pillHover(COLORS.surfaceAlt, COLORS.textSecondary, COLORS.border)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
