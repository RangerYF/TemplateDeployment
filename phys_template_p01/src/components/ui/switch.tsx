import * as React from "react";
import { cn } from "@/lib/utils";
import { COLORS } from "@/styles/tokens";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  checked = false,
  onCheckedChange,
  disabled = false,
  className,
  ...props
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(checked);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.target.checked;
    setInternalChecked(newChecked);
    onCheckedChange?.(newChecked);
  };

  React.useEffect(() => {
    setInternalChecked(checked);
  }, [checked]);

  return (
    <label
      className={cn(
        "relative inline-flex h-[18px] w-8 cursor-pointer items-center rounded-full",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      style={{
        backgroundColor: internalChecked ? COLORS.primary : COLORS.bgMuted,
        transition: "all 0.12s",
      }}
    >
      <input
        type="checkbox"
        checked={internalChecked}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        {...props}
      />
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full shadow",
          internalChecked ? "translate-x-[14px]" : "translate-x-0.5"
        )}
        style={{
          backgroundColor: COLORS.white,
          transition: "transform 0.12s",
        }}
      />
    </label>
  );
}
