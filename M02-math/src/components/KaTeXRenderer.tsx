/**
 * KaTeXRenderer — M04 Phase 3
 *
 * Lightweight React wrapper around katex.renderToString.
 * Renders inline LaTeX math using the KaTeX CSS (imported once here).
 *
 * Errors are caught silently; the raw LaTeX string is shown in red as fallback.
 */

import katex from 'katex';
import 'katex/dist/katex.min.css';

function renderToHtml(latex: string): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    return `<span style="color:#EF4444">${latex}</span>`;
  }
}

export function KaTeXRenderer({
  latex,
  style,
  className,
}: {
  latex:      string;
  style?:     React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: renderToHtml(latex) }}
      style={style}
      className={className}
    />
  );
}
