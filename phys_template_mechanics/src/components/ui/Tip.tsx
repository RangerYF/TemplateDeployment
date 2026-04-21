import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const EDGE_GAP = 8
const TRIGGER_GAP = 4

/** hover 即时显示，fixed + Portal，且做视口边缘防溢出 */
export function Tip({
  text,
  children,
  position = 'top',
}: {
  text: string
  children: React.ReactNode
  position?: 'top' | 'bottom'
}) {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)

  const handleEnter = useCallback(() => {
    setShow(true)
  }, [])

  const handleLeave = useCallback(() => {
    setShow(false)
  }, [])

  useLayoutEffect(() => {
    if (!show || !triggerRef.current || !tipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tipRect = tipRef.current.getBoundingClientRect()

    let left = triggerRect.left + triggerRect.width / 2 - tipRect.width / 2
    left = Math.max(EDGE_GAP, Math.min(left, window.innerWidth - EDGE_GAP - tipRect.width))

    let top =
      position === 'top'
        ? triggerRect.top - TRIGGER_GAP - tipRect.height
        : triggerRect.bottom + TRIGGER_GAP
    top = Math.max(EDGE_GAP, Math.min(top, window.innerHeight - EDGE_GAP - tipRect.height))

    setCoords({ left, top })
  }, [show, text, position])

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="flex-shrink-0"
      style={{ display: 'inline-flex' }}
    >
      {children}
      {show && createPortal(
        <span
          ref={tipRef}
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            backgroundColor: '#1f2937',
            color: '#fff',
            fontSize: 10,
            lineHeight: 1.4,
            padding: '3px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  )
}
