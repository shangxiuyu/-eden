/**
 * [INPUT]: 依赖 react、@/lib/utils
 * [OUTPUT]: 对外提供 Input 组件（微拟物风格）
 * [POS]: components/ui 的表单输入组件，内凹阴影效果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type, style, ...props }, ref) => {
  const [isFocused, setIsFocused] = React.useState(false);

  const inputStyle = {
    // Background is controlled via className for better theming
    boxShadow: isFocused
      ? "inset 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(0,0,0,0.25), 0 0 0 2px var(--color-ring)"
      : "inset 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,0,0,0.2)",
    ...style,
  };

  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input/40 px-4 py-2 text-sm",
        "bg-muted/20 text-foreground placeholder:text-muted-foreground",
        "transition-all duration-200",
        "focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className
      )}
      style={inputStyle}
      ref={ref}
      onFocus={(e) => {
        setIsFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        props.onBlur?.(e);
      }}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
