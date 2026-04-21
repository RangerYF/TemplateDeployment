"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS, RADIUS, SHADOWS } from "@/styles/tokens";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

// ============================================
// Toast Types
// ============================================

type ToastVariant = "success" | "error" | "warning" | "info";
type ToastPosition = "top-right" | "top-center" | "top-left" | "bottom-right" | "bottom-center" | "bottom-left";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

// ============================================
// Toast Context
// ============================================

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

// ============================================
// Toast Provider
// ============================================

interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  duration?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  position = "top-right",
  duration = 3000,
}) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timeoutRefs = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    // Clear timeout if exists
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    if (toast.duration !== 0) {
      const toastDuration = toast.duration ?? duration;
      const timeout = setTimeout(() => {
        removeToast(id);
      }, toastDuration);
      timeoutRefs.current.set(id, timeout);
    }

    return id;
  }, [duration, removeToast]);

  // Clear all timeouts on unmount
  React.useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer position={position} />
    </ToastContext.Provider>
  );
};

// ============================================
// Toast Container
// ============================================

interface ToastContainerProps {
  position: ToastPosition;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ position }) => {
  const { toasts, removeToast } = useToast();

  const positionClasses: Record<ToastPosition, string> = {
    "top-right": "top-4 right-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
    "bottom-left": "bottom-4 left-4",
  };

  return (
    <div
      className={cn(
        "fixed z-[100] flex flex-col gap-2 max-w-sm w-full",
        positionClasses[position]
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

// ============================================
// Toast Item
// ============================================

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = React.useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300); // Wait for exit animation
  };

  const variantConfig: Record<
    ToastVariant,
    { icon: React.ReactNode; bgColor: string; borderColor: string }
  > = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      bgColor: COLORS.successLight,
      borderColor: COLORS.success,
    },
    error: {
      icon: <XCircle className="w-5 h-5" />,
      bgColor: COLORS.errorLight,
      borderColor: COLORS.error,
    },
    warning: {
      icon: <AlertCircle className="w-5 h-5" />,
      bgColor: COLORS.warningLight,
      borderColor: COLORS.warning,
    },
    info: {
      icon: <Info className="w-5 h-5" />,
      bgColor: COLORS.infoLight,
      borderColor: COLORS.info,
    },
  };

  const config = variantConfig[toast.variant];

  return (
    <div
      className={cn(
        "relative p-4 rounded-lg shadow-lg transition-all duration-300",
        isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"
      )}
      style={{
        backgroundColor: config.bgColor,
        borderLeft: `4px solid ${config.borderColor}`,
        borderRadius: RADIUS.md,
        boxShadow: SHADOWS.toast,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="flex-shrink-0 mt-0.5"
          style={{ color: config.borderColor }}
        >
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold"
            style={{ color: COLORS.text }}
          >
            {toast.title}
          </p>
          {toast.description && (
            <p
              className="text-sm mt-1"
              style={{ color: COLORS.textSecondary }}
            >
              {toast.description}
            </p>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={handleRemove}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" style={{ color: COLORS.textMuted }} />
        </button>
      </div>
    </div>
  );
};

// ============================================
// Toast Hook
// ============================================

export const useToastHook = () => {
  const { addToast } = useToast();

  return React.useMemo(
    () => ({
      success: (title: string, description?: string, duration?: number) => {
        addToast({ variant: "success", title, description, duration });
      },
      error: (title: string, description?: string, duration?: number) => {
        addToast({ variant: "error", title, description, duration });
      },
      warning: (title: string, description?: string, duration?: number) => {
        addToast({ variant: "warning", title, description, duration });
      },
      info: (title: string, description?: string, duration?: number) => {
        addToast({ variant: "info", title, description, duration });
      },
    }),
    [addToast]
  );
};

// ============================================
// Shorthand Hook
// ============================================

export const toast = {
  success: (title: string, description?: string, duration?: number) => {
    // This will be replaced with actual context call when used within provider
    console.warn("Toast used outside of ToastProvider");
  },
  error: (title: string, description?: string, duration?: number) => {
    console.warn("Toast used outside of ToastProvider");
  },
  warning: (title: string, description?: string, duration?: number) => {
    console.warn("Toast used outside of ToastProvider");
  },
  info: (title: string, description?: string, duration?: number) => {
    console.warn("Toast used outside of ToastProvider");
  },
};
