/**
 * [INPUT]: 依赖 @/components/ui/button、@/components/ui/card、framer-motion、@/lib/motion
 * [OUTPUT]: 对外提供 FinalCTASection 组件
 * [POS]: components/landing 的最终召唤区，收尾并推动注册/试用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fadeInUp, scaleIn, staggerContainer } from "@/lib/motion";

export function FinalCTASection() {
  return (
    <section className="py-24">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="container px-6"
      >
        <motion.div variants={scaleIn}>
          <Card variant="raised" className="overflow-hidden">
            <div className="relative">
              {/* 背景渐变带 */}
              <div
                className="absolute inset-0 -z-10"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 80%, black) 100%)",
                  opacity: 0.15,
                }}
              />
              <CardContent className="px-8 py-16 text-center">
                <motion.h3 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mb-4">
                  准备好与一群 AI 搭档并肩作战了吗？
                </motion.h3>
                <motion.p variants={fadeInUp} className="text-lg text-muted-foreground mb-8">
                  立即开启你的伊甸园，召唤多位 Agent 一起创造更大的价值
                </motion.p>
                <motion.div
                  variants={fadeInUp}
                  className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                  <Button size="xl" variant="primary">
                    免费开始
                  </Button>
                  <Button size="xl" variant="outline">
                    查看文档
                  </Button>
                </motion.div>
              </CardContent>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </section>
  );
}
