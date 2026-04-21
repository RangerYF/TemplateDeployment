import { useRef, useState, useCallback } from 'react';

export interface DraggablePopoverProps {
  initialLeft: number;
  initialTop: number;
  children: React.ReactNode;
}

/**
 * 可拖拽的浮动面板包装器
 * 子组件中带 data-drag-handle 属性的元素作为拖拽手柄
 */
export function DraggablePopover({ initialLeft, initialTop, children }: DraggablePopoverProps) {
  const [pos, setPos] = useState({ left: initialLeft, top: initialTop });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 只有点击 [data-drag-handle] 元素才启动拖拽
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;

    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - pos.left,
      y: e.clientY - pos.top,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      setPos({
        left: ev.clientX - dragOffset.current.x,
        top: ev.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [pos.left, pos.top]);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        zIndex: 10,
        pointerEvents: 'auto',
        cursor: dragging ? 'grabbing' : undefined,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
