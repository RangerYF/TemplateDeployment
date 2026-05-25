import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  math: string;
  /** true = 块级显示 (居中、字号大)；false = 内联（默认） */
  displayMode?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** 渲染 LaTeX 数学公式（KaTeX）— SVG 外的 HTML 上下文用 */
export function KatexInline({ math, displayMode = false, className, style }: Props) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        throwOnError: false,
        displayMode,
        output: 'html',
      });
    } catch {
      return math;
    }
  }, [math, displayMode]);
  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
