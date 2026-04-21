import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { COLORS, RADIUS } from '@/styles/tokens'

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined)

const useDialog = () => {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error('Dialog components must be used within Dialog')
  }
  return context
}

const useStableCallback = (callback: ((open: boolean) => void) | undefined) => {
  const callbackRef = React.useRef(callback)

  React.useEffect(() => {
    callbackRef.current = callback
  })

  return React.useCallback((open: boolean) => {
    callbackRef.current?.(open)
  }, [])
}

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Dialog: React.FC<DialogProps> = ({ open = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(open)
  const stableOnOpenChange = useStableCallback(onOpenChange)

  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(newOpen)
      }
      stableOnOpenChange(newOpen)
    },
    [isControlled, stableOnOpenChange],
  )

  React.useEffect(() => {
    if (isControlled) {
      setInternalOpen(open)
    }
  }, [isControlled, open])

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

interface DialogTriggerProps {
  children: React.ReactNode
  onClick?: () => void
}

const DialogTrigger: React.FC<DialogTriggerProps> = ({ children, onClick }) => {
  const { onOpenChange } = useDialog()

  const handleClick = () => {
    onClick?.()
    onOpenChange(true)
  }

  const child = React.Children.only(children) as React.ReactElement<{ onClick?: () => void }>

  return React.cloneElement(child, {
    onClick: handleClick,
  })
}

interface DialogContentProps {
  className?: string
  children: React.ReactNode
}

const DialogContent: React.FC<DialogContentProps> = ({ className, children }) => {
  const { open, onOpenChange } = useDialog()

  const handleClose = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, handleClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        onClick={handleClose}
      />
      <div
        className={cn('relative w-full mx-4 p-6', className)}
        style={{
          backgroundColor: COLORS.bg,
          borderRadius: RADIUS.card,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const DialogHeader: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => {
  return (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)}>
      {children}
    </div>
  )
}

const DialogTitle: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => {
  return (
    <h2 className={cn('text-lg font-semibold', className)} style={{ color: COLORS.text }}>
      {children}
    </h2>
  )
}

const DialogDescription: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => {
  return (
    <p className={cn('text-sm', className)} style={{ color: COLORS.textMuted }}>
      {children}
    </p>
  )
}

const DialogFooter: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
