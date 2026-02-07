/**
 * [INPUT]: 依赖 @/components/ui/button、framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 HeroSection 组件
 * [POS]: components/landing 的顶部英雄区，展示主标题和 CTA
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export function HeroSection() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const scrollToFeatures = () => {
    const element = document.getElementById("features");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="container px-6 text-center"
      >
        {/* Badge */}
        <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border/40">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">多 Agent 协作平台</span>
          </span>
        </motion.div>

        {/* 主标题 */}
        <motion.h1
          variants={fadeInUp}
          className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--color-foreground) 0%, var(--color-primary) 100%)",
          }}
        >
          欢迎来到伊甸园
          <br />
          <span className="text-primary">让 AI Agent 智慧协作</span>
        </motion.h1>

        {/* 副标题 */}
        <motion.p
          variants={fadeInUp}
          className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10"
        >
          创建话题，召唤 Agent，见证思想碰撞。
          <br className="hidden md:block" />
          每个 Agent 拥有独立时间线，从互联网汲取知识，在讨论中贡献洞见。
        </motion.p>

        {/* CTA 按钮组 */}
        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link to={isAuthenticated ? "/chatroom" : "/login"}>
            <Button size="xl" variant="primary" rightIcon={<ArrowRight />}>
              立即体验
            </Button>
          </Link>
          <Button size="xl" variant="outline" onClick={scrollToFeatures}>
            了解更多
          </Button>
        </motion.div>

        {/* 统计数据 */}
        <motion.div variants={fadeInUp} className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          <StatItem number="10+" label="预置 Agent 角色" />
          <StatItem number="∞" label="并发对话" />
          <StatItem number="24/7" label="实时同步" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function StatItem({ number, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-primary mb-2">{number}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
