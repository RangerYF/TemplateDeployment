import { useMemo } from 'react';
import katex from 'katex';

export function InlineLatex({ latex, style }: { latex: string; style?: React.CSSProperties }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { throwOnError: false, displayMode: false });
    } catch {
      return latex;
    }
  }, [latex]);
  return <span style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
