import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useActiveModel } from '@/store/simulationStore';
import { COLORS } from '@/styles/tokens';

function renderLatex(expression: string) {
  return katex.renderToString(expression, {
    displayMode: false,
    throwOnError: false,
    strict: false,
    output: 'html',
  });
}

function isPlainTextExpression(expression: string) {
  return /[\u4e00-\u9fff]/.test(expression);
}

export function FormulaPanel() {
  const model = useActiveModel();

  return (
    <div className="space-y-2">
      {model.formulas.map((formula) => (
        <div key={formula.label} className="rounded-xl border p-3" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
          <div className="space-y-2">
            <span className="text-sm font-semibold" style={{ color: COLORS.text }}>{formula.label}</span>
            <div className="overflow-x-auto whitespace-nowrap pb-1">
              {isPlainTextExpression(formula.expression) ? (
                <span className="text-[13px] leading-relaxed" style={{ color: COLORS.primary }}>
                  {formula.expression}
                </span>
              ) : (
                <span
                  className="inline-block text-[13px]"
                  style={{ color: COLORS.primary }}
                  dangerouslySetInnerHTML={{ __html: renderLatex(formula.expression) }}
                />
              )}
            </div>
          </div>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.textMuted }}>{formula.note}</p>
        </div>
      ))}
    </div>
  );
}
