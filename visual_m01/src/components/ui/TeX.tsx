import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface TeXProps {
  /** LaTeX 字符串 */
  math: string;
  /** true = 块级（display mode），false = 行内 */
  display?: boolean;
  className?: string;
}

export function TeX({ math, display = false, className }: TeXProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: display,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return math;
    }
  }, [math, display]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
