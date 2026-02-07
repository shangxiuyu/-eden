/**
 * [INPUT]: 依赖 framer-motion、@/lib/motion、react-icons/si
 * [OUTPUT]: 对外提供 LogoBarSection 组件
 * [POS]: components/landing 的技术栈展示区，显示支持的技术
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import { SiReact, SiPython, SiOpenai, SiDocker, SiTailwindcss } from "react-icons/si";
import { Zap } from "lucide-react";

const TECH_STACK = [
  { Icon: SiReact, name: "React", color: "#61DAFB" },
  { Icon: SiPython, name: "Python", color: "#3776AB" },
  { Icon: SiOpenai, name: "OpenAI", color: "#412991" },
  { Icon: Zap, name: "WebSocket", color: "#010101" },
  { Icon: SiDocker, name: "Docker", color: "#2496ED" },
  { Icon: SiTailwindcss, name: "Tailwind CSS", color: "#06B6D4" },
];

export function LogoBarSection() {
  return (
    <section className="py-16 border-y border-border/40">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="container px-6"
      >
        <motion.p variants={fadeInUp} className="text-center text-sm text-muted-foreground mb-12">
          基于现代化技术栈构建
        </motion.p>

        <motion.div
          variants={staggerContainer}
          className="grid grid-cols-3 md:grid-cols-6 gap-12 items-center justify-items-center"
        >
          {TECH_STACK.map(({ Icon, name, color }) => (
            <motion.div
              key={name}
              variants={fadeInUp}
              whileHover={{ scale: 1.1, y: -4 }}
              className="flex flex-col items-center gap-3 group"
            >
              <Icon
                className="w-12 h-12 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors"
                style={{ color: "var(--color-muted-foreground)" }}
              />
              <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                {name}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
