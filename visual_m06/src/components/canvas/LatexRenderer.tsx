import { useEffect, useRef } from 'react';
import katex from 'katex';

interface LatexRendererProps {
  latex: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  opacity?: number;
  stroke?: string;
  width?: number;
  height?: number;
}

export function LatexRenderer({
  latex, x, y, fontSize = 16, color = '#1A1A2E', opacity = 1, stroke,
  width = 200, height = 60,
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
    <foreignObject x={x} y={y} width={width} height={height} overflow="visible" opacity={opacity} style={{ pointerEvents: 'none' }}>
      <div
        ref={containerRef}
        // @ts-expect-error xmlns needed for SVG foreignObject XHTML rendering
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          fontSize: `${fontSize}px`,
          color,
          whiteSpace: 'nowrap',
          fontFamily: "KaTeX_Main, 'PingFang SC', serif",
          ...(stroke ? { filter: `drop-shadow(0 0 1.5px ${stroke}) drop-shadow(0 0 1.5px ${stroke})` } : {}),
        }}
      />
    </foreignObject>
  );
}
