/**
 * [INPUT]: 依赖 framer-motion 的 Spring 物理引擎
 * [OUTPUT]: 对外提供 Apple 级动画预设（Spring-based fadeInUp、scaleIn、hoverLift、tapScale 等）
 * [POS]: lib/ 的动画预设库，基于 Spring 物理引擎实现自然落定效果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/* ========================================
   Apple Spring 物理配置
   核心哲学: 自然起势 + 优雅落定 + 物理重量感
   ======================================== */

// 标准交互 - 按钮、卡片 hover (~200ms 体感)
export const snappy = { type: "spring", stiffness: 400, damping: 30 };

// 柔和过渡 - 面板展开、模态框 (~350ms 体感)
export const gentle = { type: "spring", stiffness: 300, damping: 35 };

// 弹性强调 - 成功反馈、关键元素 (~300ms 体感)
export const bouncy = { type: "spring", stiffness: 500, damping: 25, mass: 0.8 };

// 优雅落定 - 页面过渡、大元素移动 (~500ms 体感)
export const smooth = { type: "spring", stiffness: 200, damping: 40, mass: 1.2 };

// 惯性滑动 - 列表、轮播
export const inertia = { type: "spring", stiffness: 150, damping: 20, mass: 0.5 };

/* ========================================
   Apple 缓动曲线（非 Spring 场景）
   ======================================== */

export const appleEase = [0.25, 0.1, 0.25, 1.0]; // iOS 标准曲线
export const appleEaseOut = [0.22, 1, 0.36, 1]; // iOS 弹出曲线
export const appleDecelerate = [0, 0, 0.2, 1]; // iOS 减速曲线

/* ========================================
   基础动画变体 - Spring 版
   ======================================== */

export const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: gentle,
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: snappy,
  },
};

export const slideInLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: gentle,
  },
};

export const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: gentle,
  },
};

/* ========================================
   容器动画变体 - Stagger 效果
   ======================================== */

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06, // 降低间隔，更流畅
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 350, damping: 30 },
  },
};

/* ========================================
   交互动画 - Apple Card 效果
   ======================================== */

// 悬浮提升（Card hover）
export const hoverLift = {
  rest: {
    scale: 1,
    y: 0,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
    transition: snappy,
  },
};

// 点击回弹（Button press）
export const tapScale = {
  rest: { scale: 1 },
  pressed: {
    scale: 0.96,
    transition: bouncy,
  },
};

/* ========================================
   模态框动画 - 优雅落定
   ======================================== */

export const modalOverlay = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const modalContent = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

/* ========================================
   页面路由过渡
   ======================================== */

export const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: smooth,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 },
  },
};

export const hoverScale = {
  scale: 1.02,
  transition: snappy,
};
