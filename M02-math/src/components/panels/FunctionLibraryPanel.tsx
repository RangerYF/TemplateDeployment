/**
 * FunctionLibraryPanel — Compact horizontal function template buttons.
 *
 * Renders as a horizontal strip suitable for embedding in the TopBar.
 * Shows template icons + a "自定义" button for free-form expressions.
 */

import { useFunctionStore } from '@/editor/store/functionStore';
import { executeM02Command } from '@/editor/commands/m02Execute';
import { AddFunctionCommand } from '@/editor/commands/AddFunctionCommand';
import { FUNCTION_TEMPLATES } from '@/engine/functionTemplates';
import { FUNCTION_COLORS, DEFAULT_TRANSFORM, type FunctionEntry } from '@/types';
import { COLORS } from '@/styles/colors';
import { createId } from '@/lib/id';

const MAX_FUNCTIONS = 8;
const LABELS = ['f(x)', 'g(x)', 'h(x)', 'p(x)', 'q(x)', 'r(x)', 's(x)', 't(x)'];

export function FunctionLibraryPanel() {
  const functions = useFunctionStore((s) => s.functions);
  const count     = functions.length;

  const addFunction = (templateId: string | null) => {
    console.log('[FunctionLibraryPanel] addFunction called, templateId=', templateId, 'count=', count);
    if (count >= MAX_FUNCTIONS) return;

    const idx   = count;
    const color = FUNCTION_COLORS[idx % FUNCTION_COLORS.length] as string;
    const label = LABELS[idx] ?? `f${idx}(x)`;

    let exprStr   = 'x';
    let namedParams: FunctionEntry['namedParams'] = [];

    if (templateId !== null) {
      const tmpl = FUNCTION_TEMPLATES.find((t) => t.id === templateId);
      if (tmpl) {
        namedParams = tmpl.defaultParams.map((p) => ({ ...p }));
        const values = Object.fromEntries(namedParams.map((p) => [p.name, p.value]));
        exprStr = tmpl.buildExpr(values);
      }
    }

    const entry: FunctionEntry = {
      id:          createId(),
      label,
      mode:        'standard',
      exprStr,
      segments:    [],
      color,
      visible:     true,
      transform:   { ...DEFAULT_TRANSFORM },
      templateId,
      namedParams,
    };

    console.log('[FunctionLibraryPanel] before execute, entry=', entry.label, entry.exprStr);
    executeM02Command(new AddFunctionCommand(entry));
    useFunctionStore.getState().setActiveFunctionId(entry.id);
    console.log('[FunctionLibraryPanel] after execute, store functions=', useFunctionStore.getState().functions.length);
  };

  const disabled = count >= MAX_FUNCTIONS;

  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
      {FUNCTION_TEMPLATES.map((tmpl) => (
        <button
          key={tmpl.id}
          onClick={() => addFunction(tmpl.id)}
          disabled={disabled}
          title={tmpl.displayExpr}
          style={{
            padding: '2px 6px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 9999,
            border: `1px solid ${COLORS.border}`,
            background: disabled ? COLORS.surfaceAlt : COLORS.surface,
            color: disabled ? COLORS.neutral : COLORS.textPrimary,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background 0.12s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = COLORS.surfaceHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = disabled ? COLORS.surfaceAlt : COLORS.surface; }}
        >
          {tmpl.label}
        </button>
      ))}
      <button
        onClick={() => addFunction(null)}
        disabled={disabled}
        title="自定义表达式"
        style={{
          padding: '2px 6px',
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 9999,
          border: `1px dashed ${COLORS.border}`,
          background: 'transparent',
          color: disabled ? COLORS.neutral : COLORS.textSecondary,
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = COLORS.surfaceHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        + 自定义
      </button>
    </div>
  );
}
