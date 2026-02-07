/**
 * [INPUT]: 依赖 react、@/lib/utils
 * [OUTPUT]: 对外提供 Card 组件及子组件（微拟物风格），支持 raised/inset 变体
 * [POS]: components/ui 的容器组件，立体渐变效果 + 凸起/内凹阴影
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/* ========================================
   卡片样式配置 - 凸起/内凹效果
   ======================================== */

const CARD_STYLES = {
  raised: {
    background:
      "linear-gradient(135deg, var(--color-card) 0%, color-mix(in srgb, var(--color-card) 95%, black) 100%)",
    boxShadow:
      "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.1)",
    hoverBoxShadow:
      "0 6px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.12)",
  },
  inset: {
    background: "color-mix(in srgb, var(--color-card) 90%, black)",
    boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,0,0,0.2)",
    hoverBoxShadow: "inset 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,0,0,0.2)",
  },
  flat: {
    background: "var(--color-card)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    hoverBoxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  },
};

const Card = React.forwardRef(({ className, variant = "raised", style, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const styleConfig = CARD_STYLES[variant] || CARD_STYLES.raised;

  const combinedStyle = {
    background: styleConfig.background,
    boxShadow: isHovered ? styleConfig.hoverBoxShadow : styleConfig.boxShadow,
    ...style,
  };

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-border/40 text-card-foreground transition-all duration-200",
        className
      )}
      style={combinedStyle}
      onMouseEnter={(e) => {
        setIsHovered(true);
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        props.onMouseLeave?.(e);
      }}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
