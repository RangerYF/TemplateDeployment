import { useEffect, useRef } from 'react';
import katex from 'katex';

interface LatexRendererProps {
  latex: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  opacity?: number;
}

export function LatexRenderer({
  latex, x, y, fontSize = 16, color = '#1A1A2E', opacity = 1,
}: LatexRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      katex.render(latex, containerRef.current, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
      });
    } catch {
      if (containerRef.current) {
        containerRef.current.textContent = latex;
      }
    }
  }, [latex]);

  return (
    <foreignObject x={x} y={y} width="200" height="60" overflow="visible" opacity={opacity}>
      <div
        ref={containerRef}
        style={{
          fontSize: `${fontSize}px`,
          color,
          whiteSpace: 'nowrap',
          fontFamily: 'KaTeX_Main, serif',
        }}
      />
    </foreignObject>
  );
}
