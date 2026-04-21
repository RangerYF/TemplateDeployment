import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import { TopBar } from './TopBar';
import { RightPanel } from './RightPanel';
import { COLORS } from '@/styles/tokens';

interface AppLayoutProps {
  children: React.ReactNode;
}

const MIN_RIGHT = 240;
const MAX_RIGHT = 420;
const DEFAULT_RIGHT = 280;

export function AppLayout({ children }: AppLayoutProps) {
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newRight = containerRect.right - e.clientX;
    setRightWidth(Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, newRight)));
  }, [dragging]);

  const onPointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const dividerActive = hovered || dragging;

  return (
    <div className="flex flex-col w-full h-full">
      <TopBar />
      <div
        ref={containerRef}
        className="flex flex-1 overflow-hidden"
        onPointerMove={dragging ? onPointerMove : undefined}
        onPointerUp={dragging ? onPointerUp : undefined}
      >
        <main className="relative flex-1 min-w-0">{children}</main>

        {/* Resizable divider */}
        <div
          onPointerDown={onPointerDown}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          style={{
            width: 6,
            cursor: 'col-resize',
            backgroundColor: dividerActive ? COLORS.primary : 'transparent',
            opacity: dividerActive ? (dragging ? 0.8 : 0.5) : 1,
            transition: dragging ? 'none' : 'background-color 0.15s, opacity 0.15s',
            flexShrink: 0,
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* Center dot indicator */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 3,
            height: 24,
            borderRadius: 2,
            backgroundColor: dividerActive ? COLORS.white : COLORS.borderStrong,
            transition: dragging ? 'none' : 'background-color 0.15s',
          }} />
        </div>

        <RightPanel width={rightWidth} />
      </div>
    </div>
  );
}
