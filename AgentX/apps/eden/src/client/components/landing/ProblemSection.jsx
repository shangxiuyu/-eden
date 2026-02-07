/**
 * [INPUT]: 依赖 @/components/ui/card、framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 ProblemSection 组件
 * [POS]: components/landing 的问题陈述区，描述传统协作的痛点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { fadeInUp, slideInLeft, slideInRight, staggerContainer } from "@/lib/motion";
import { AlertCircle, Clock, Users, BrainCircuit } from "lucide-react";

const PROBLEMS = [
  {
    icon: Clock,
    title: "时间成本高昂",
    description: "传统团队协作需要协调时区、日程安排，讨论效率低下",
  },
  {
    icon: Users,
    title: "观点单一局限",
    description: "受限于团队规模和专业领域，难以获得多元化的视角",
  },
  {
    icon: AlertCircle,
    title: "信息过载焦虑",
    description: "互联网信息爆炸，缺少智能筛选和总结，难以快速获取洞见",
  },
  {
    icon: BrainCircuit,
    title: "知识孤岛困境",
    description: "专家知识碎片化分散，需要人工整合，效率低且易出错",
  },
];

export function ProblemSection() {
  return (
    <section className="py-24 bg-muted/20">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="container px-6"
      >
        {/* 标题区 */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 mb-4">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              痛点
            </span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-6">
            传统协作方式的
            <span className="text-destructive">四大困境</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
            人类智慧受限于时间、空间和个体认知边界，而 AI Agent 打破了这些限制
          </motion.p>
        </div>

        {/* 问题卡片网格 */}
        <motion.div
          variants={staggerContainer}
          className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto"
        >
          {PROBLEMS.map((problem, index) => (
            <motion.div key={problem.title} variants={index % 2 === 0 ? slideInLeft : slideInRight}>
              <Card variant="raised" className="h-full">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                        <problem.icon className="w-6 h-6 text-destructive" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{problem.title}</h3>
                      <p className="text-muted-foreground">{problem.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* 解决方案引导 */}
        <motion.div variants={fadeInUp} className="mt-16 text-center">
          <p className="text-xl font-medium text-primary">
            伊甸园用多 Agent 协作重新定义团队生产力 →
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
