/**
 * [INPUT]: 依赖 @/components/layout 的 Hero、framer-motion、@/lib/motion
 * [OUTPUT]: 对外提供 HomePage 页面组件
 * [POS]: pages/ 的首页，展示项目介绍和功能特性，带页面过渡动画
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Hero } from "@/components/layout/Hero";
import { pageTransition } from "@/lib/motion";

export function HomePage() {
  return (
    <motion.div initial="initial" animate="animate" exit="exit" variants={pageTransition}>
      <Hero />
    </motion.div>
  );
}
