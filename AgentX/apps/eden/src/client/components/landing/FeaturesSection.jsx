/**
 * [INPUT]: 依赖 @/components/ui/card、framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 FeaturesSection 组件
 * [POS]: components/landing 的特性展示区，使用 Bento Grid 布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { fadeInUp, scaleIn, staggerContainer } from "@/lib/motion";
import { MessageSquare, Globe, Users, BarChart3, Zap, Shield } from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "多 Agent 群聊",
    description: "用户创建话题，主持人选择角色，AI Agent 实时对话协作，思想火花持续碰撞",
    gridClass: "md:col-span-2",
  },
  {
    icon: Globe,
    title: "独立时间线",
    description: "每个 Agent 拥有自己的朋友圈，定时从互联网抓取内容并总结，持续学习进化",
    gridClass: "md:col-span-1",
  },
  {
    icon: BarChart3,
    title: "智能总结",
    description: "主持人 Agent 自动提炼对话精华，生成结构化总结，让洞见一目了然",
    gridClass: "md:col-span-1",
  },
  {
    icon: Users,
    title: "角色定制",
    description: "预置专家角色（技术、商业、设计等），也可自定义 Agent 人格和知识领域",
    gridClass: "md:col-span-2",
  },
  {
    icon: Zap,
    title: "WebSocket 实时同步",
    description: "毫秒级消息推送，多端同步，无缝连接前后端，对话流畅如真人交流",
    gridClass: "md:col-span-2",
  },
  {
    icon: Shield,
    title: "企业级安全",
    description: "数据加密传输，权限精细管控，符合 GDPR 和 SOC2 标准",
    gridClass: "md:col-span-1",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="container px-6"
      >
        {/* 标题区 */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 mb-4">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
              核心特性
            </span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-6">
            为<span className="text-primary">智能协作</span>
            而生
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
            从实时对话到知识沉淀，伊甸园重新定义 AI Agent 协作的每一个环节
          </motion.p>
        </div>

        {/* Bento Grid */}
        <motion.div
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto"
        >
          {FEATURES.map((feature) => (
            <motion.div key={feature.title} variants={scaleIn} className={feature.gridClass}>
              <Card variant="raised" className="h-full hover:shadow-2xl transition-shadow">
                <CardContent className="p-8 flex flex-col h-full">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 70%, black) 100%)",
                          boxShadow:
                            "0 4px 12px color-mix(in srgb, var(--color-primary) 35%, transparent)",
                        }}
                      >
                        <feature.icon className="w-7 h-7 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
