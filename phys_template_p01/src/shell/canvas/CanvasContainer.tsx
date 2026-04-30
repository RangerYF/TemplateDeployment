import { useRef, useEffect, useCallback, type CSSProperties } from 'react';

export interface CanvasContainerProps {
  onContextReady?: (ctx: CanvasRenderingContext2D) => void;
  backgroundStyle?: CSSProperties;
}

/**
 * 中央画布容器
 * 管理 Canvas 元素、处理 resize 和 devicePixelRatio
 */
export function CanvasContainer({ onContextReady, backgroundStyle }: CanvasContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    // 设置 Canvas 物理尺寸（高分屏）
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // 设置 CSS 显示尺寸
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // 缩放上下文以匹配 DPR
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      onContextReady?.(ctx);
    }
  }, [onContextReady]);

  useEffect(() => {
    handleResize();

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [handleResize]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      style={{ backgroundColor: '#FAFAFA', ...backgroundStyle }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />
    </div>
  );
}
