"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS, RADIUS, SHADOWS } from "@/styles/tokens";

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | undefined>(undefined);

const usePopover = () => {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within Popover");
  }
  return context;
};

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Popover: React.FC<PopoverProps> = ({ open = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(open);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  React.useEffect(() => {
    if (isControlled) {
      setInternalOpen(open);
    }
  }, [isControlled, open]);

  return (
    <PopoverContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </PopoverContext.Provider>
  );
};

interface PopoverTriggerProps {
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ children, onClick }) => {
  const { open, onOpenChange } = usePopover();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
    onOpenChange(!open);
  };

  const child = React.Children.only(children) as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;

  return React.cloneElement(child, {
    onClick: handleClick,
  });
};

interface PopoverContentProps {
  className?: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}

const PopoverContent: React.FC<PopoverContentProps> = ({ className, children, align = "start" }) => {
  const { open, onOpenChange } = usePopover();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const alignClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };

  return (
    <div
      ref={contentRef}
      style={{
        backgroundColor: COLORS.bg,
        borderRadius: RADIUS.card,
        boxShadow: SHADOWS.md,
        borderColor: COLORS.border,
      }}
      className={cn(
        "absolute z-50 mt-2 min-w-[150px] border p-1",
        alignClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
};

export { Popover, PopoverTrigger, PopoverContent };
