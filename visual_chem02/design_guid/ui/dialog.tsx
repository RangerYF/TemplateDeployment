"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS, RADIUS } from "@/styles/tokens";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined);

const useDialog = () => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within Dialog");
  }
  return context;
};

// 使用 ref 来稳定 onOpenChange 回调的引用
const useStableCallback = (callback: ((open: boolean) => void) | undefined) => {
  const callbackRef = React.useRef(callback);
  callbackRef.current = callback;

  return React.useCallback((open: boolean) => {
    callbackRef.current?.(open);
  }, []);
};

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const stableOnOpenChange = useStableCallback(onOpenChange);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    stableOnOpenChange(newOpen);
  }, [isControlled, stableOnOpenChange]);

  React.useEffect(() => {
    if (isControlled) {
      setInternalOpen(open);
    }
  }, [isControlled, open]);

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

interface DialogTriggerProps {
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const DialogTrigger: React.FC<DialogTriggerProps> = ({ children, onClick }) => {
  const { onOpenChange } = useDialog();

  const handleClick = () => {
    onClick?.();
    onOpenChange(true);
  };

  const child = React.Children.only(children) as React.ReactElement<{ onClick?: () => void }>;

  return React.cloneElement(child, {
    onClick: handleClick,
  });
};

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

const DialogContent: React.FC<DialogContentProps> = ({ className, children }) => {
  const { open, onOpenChange } = useDialog();

  // 使用 useCallback 稳定 onOpenChange 的引用
  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop/Overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        onClick={handleClose}
      />

      {/* Content */}
      <div
        className={cn(
          "relative w-full mx-4 p-6",
          className
        )}
        style={{
          backgroundColor: COLORS.bg,
          borderRadius: RADIUS.card,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

interface DialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

const DialogHeader: React.FC<DialogHeaderProps> = ({ className, children }) => {
  return (
    <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)}>
      {children}
    </div>
  );
};

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

const DialogTitle: React.FC<DialogTitleProps> = ({ className, children }) => {
  return (
    <h2 className={cn("text-lg font-semibold", className)} style={{ color: COLORS.text }}>
      {children}
    </h2>
  );
};

interface DialogDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

const DialogDescription: React.FC<DialogDescriptionProps> = ({ className, children }) => {
  return (
    <p className={cn("text-sm", className)} style={{ color: COLORS.textMuted }}>
      {children}
    </p>
  );
};

interface DialogFooterProps {
  className?: string;
  children: React.ReactNode;
}

const DialogFooter: React.FC<DialogFooterProps> = ({ className, children }) => {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4", className)}>
      {children}
    </div>
  );
};

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};

// ============================================
// 表单组件
// ============================================

interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
}

export function FormField({ children, className }: FormFieldProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

interface FormLabelProps {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

export function FormLabel({ children, required, className }: FormLabelProps) {
  return (
    <label className={cn("block text-sm font-medium mb-1.5", className)} style={{ color: COLORS.text }}>
      {children}
      {required && <span className="ml-1" style={{ color: COLORS.error }}>*</span>}
    </label>
  );
}

interface FormDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function FormDescription({ children, className }: FormDescriptionProps) {
  return <p className={cn("text-xs text-gray-500 mt-1", className)}>{children}</p>;
}

interface FormErrorProps {
  children: React.ReactNode;
  className?: string;
}

export function FormError({ children, className }: FormErrorProps) {
  if (!children) return null;
  return (
    <p className={cn("text-xs text-red-500 mt-1", className)}>
      {children}
    </p>
  );
}

// ============================================
// 空状态组件
// ============================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ============================================
// 加载状态组件
// ============================================

interface LoadingStateProps {
  text?: string;
  className?: string;
}

export function LoadingState({ text = "加载中...", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      {text && <p className="text-sm text-gray-500 mt-2">{text}</p>}
    </div>
  );
}

// ============================================
// 分隔线组件
// ============================================

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-gray-200", className)} />;
}
