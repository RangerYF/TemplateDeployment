import * as React from "react";
import { cn } from "@/lib/utils";
import { COLORS, RADIUS } from "@/styles/tokens";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

const Tabs = ({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("", className)}>{children}</div>
    </TabsContext.Provider>
  );
};

const TabsList = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { activeTab, setActiveTab } = React.useContext(TabsContext)!;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-start",
        className
      )}
      style={{
        background: COLORS.bgMuted,
        borderRadius: RADIUS.full,
        padding: "3px",
      }}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            activeTab,
            setActiveTab,
          } as Record<string, unknown>);
        }
        return child;
      })}
    </div>
  );
};

const TabsTrigger = ({
  value,
  children,
  activeTab,
  setActiveTab,
  className,
  variant = "pill",
}: {
  value: string;
  children: React.ReactNode;
  activeTab?: string;
  setActiveTab?: (value: string) => void;
  className?: string;
  variant?: "pill" | "underline";
}) => {
  const context = React.useContext(TabsContext);
  const isActive = (activeTab !== undefined ? activeTab : context?.activeTab) === value;
  const onClick = () => setActiveTab?.(value) || context?.setActiveTab(value);

  if (variant === "underline") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap transition-all focus:outline-none border-b-2",
          className
        )}
        style={{
          padding: "8px 16px",
          fontSize: "13px",
          fontWeight: isActive ? "600" : "500",
          borderRadius: "0",
          borderColor: isActive ? COLORS.primary : "transparent",
          color: isActive ? COLORS.text : COLORS.textMuted,
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.color = COLORS.text;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.color = COLORS.textMuted;
          }
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap transition-all focus:outline-none",
        className
      )}
      style={{
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: isActive ? "600" : "500",
        borderRadius: RADIUS.full,
        border: "none",
        background: isActive ? COLORS.white : "transparent",
        boxShadow: isActive ? "0 1px 3px rgba(0, 0, 0, 0.08)" : "none",
        color: isActive ? COLORS.text : COLORS.textMuted,
        transition: "all 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = COLORS.text;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = COLORS.textMuted;
        }
      }}
    >
      {children}
    </button>
  );
};

const TabsContent = ({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const { activeTab } = React.useContext(TabsContext)!;

  if (activeTab !== value) return null;

  return (
    <div className={cn("focus:outline-none", className)}>{children}</div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
