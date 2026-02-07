/**
 * [INPUT]: 依赖 @/components/ui/card、framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 HowItWorksSection 组件
 * [POS]: components/landing 的工作流程展示区，分步骤说明使用方式
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { fadeInUp, slideInLeft, slideInRight, staggerContainer } from "@/lib/motion";
import { PenTool, UserCheck, MessageCircle, CheckCircle } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: PenTool,
    title: "创建话题",
    description: "用户输入感兴趣的议题，系统自动分析主题类型并推荐合适的 Agent 角色",
    align: "left",
  },
  {
    number: "02",
    icon: UserCheck,
    title: "选择角色",
    description: "主持人从预置或自定义角色中挑选参与者（技术专家、商业顾问、设计师等）",
    align: "right",
  },
  {
    number: "03",
    icon: MessageCircle,
    title: "Agent 对话",
    description: "AI Agent 根据各自领域知识展开讨论，通过 WebSocket 实时同步，思想火花碰撞",
    align: "left",
  },
  {
    number: "04",
    icon: CheckCircle,
    title: "智能总结",
    description: "主持人 Agent 提炼对话关键点，生成结构化报告，沉淀为可复用的知识资产",
    align: "right",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 bg-muted/20">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="container px-6"
      >
        {/* 标题区 */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 mb-4">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent border border-accent/20">
              工作流程
            </span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-primary">四步</span>
            开启智能协作
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
            从创建话题到获得洞见，整个流程简单直观，让复杂的多 Agent 协作触手可及
          </motion.p>
        </div>

        {/* 步骤时间线 */}
        <div className="max-w-4xl mx-auto relative">
          {/* 中心连接线 (隐藏在移动端) */}
          <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-px bg-border/40 -translate-x-1/2" />

          <motion.div variants={staggerContainer} className="space-y-12">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.number}
                variants={step.align === "left" ? slideInLeft : slideInRight}
                className={`flex items-center gap-8 ${
                  step.align === "right" ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* 内容卡片 */}
                <div className="flex-1">
                  <Card variant="raised" className="hover:shadow-2xl transition-shadow">
                    <CardContent className="p-8">
                      <div className="flex items-start gap-4">
                        <div
                          className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center"
                          style={{
                            background:
                              "linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 70%, black) 100%)",
                            boxShadow:
                              "0 4px 12px color-mix(in srgb, var(--color-accent) 35%, transparent)",
                          }}
                        >
                          <step.icon className="w-8 h-8 text-accent-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-primary mb-2">
                            步骤 {step.number}
                          </div>
                          <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                          <p className="text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 中心节点标记 (仅桌面端显示) */}
                <div className="hidden md:flex flex-shrink-0 w-4 h-4 rounded-full bg-primary border-4 border-background relative z-10" />

                {/* 占位空间 (保持布局对称) */}
                <div className="hidden md:block flex-1" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
