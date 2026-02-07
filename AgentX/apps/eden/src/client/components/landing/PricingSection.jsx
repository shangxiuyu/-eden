/**
 * [INPUT]: 依赖 @/components/ui/button、@/components/ui/card、framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 PricingSection 组件
 * [POS]: components/landing 的定价展示区，展示不同套餐
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fadeInUp, scaleIn, staggerContainer } from "@/lib/motion";
import { Check, Sparkles } from "lucide-react";

const PLANS = [
  {
    name: "探索版",
    price: "免费",
    period: "永久",
    description: "适合个人用户体验 AI 协作",
    features: [
      "最多 3 个 Agent 同时对话",
      "每日 20 次对话额度",
      "访问基础预置角色",
      "基础智能总结",
      "社区支持",
    ],
    cta: "开始使用",
    variant: "outline",
    popular: false,
  },
  {
    name: "专业版",
    price: "¥99",
    period: "/ 月",
    description: "适合团队和专业用户",
    features: [
      "最多 10 个 Agent 同时对话",
      "无限对话额度",
      "访问全部预置角色",
      "自定义 Agent 人格",
      "高级智能总结和导出",
      "独立时间线功能",
      "优先客户支持",
      "API 访问权限",
    ],
    cta: "选择专业版",
    variant: "primary",
    popular: true,
  },
  {
    name: "企业版",
    price: "定制",
    period: "",
    description: "适合企业级部署和定制需求",
    features: [
      "无限 Agent 数量",
      "私有化部署选项",
      "企业级安全和合规",
      "专属技术支持",
      "自定义集成",
      "SSO 单点登录",
      "数据隔离和备份",
      "SLA 保障",
    ],
    cta: "联系销售",
    variant: "secondary",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-muted/20">
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
              定价方案
            </span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-6">
            选择适合你的
            <span className="text-primary">协作方案</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
            无论是个人探索还是企业级部署，我们都有合适的方案
          </motion.p>
        </div>

        {/* 定价卡片 */}
        <motion.div
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {PLANS.map((plan) => (
            <motion.div key={plan.name} variants={scaleIn} className="relative">
              {/* 推荐标签 */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    最受欢迎
                  </span>
                </div>
              )}

              <Card
                variant={plan.popular ? "raised" : "flat"}
                className={`h-full ${plan.popular ? "border-2 border-primary/50 shadow-2xl" : ""}`}
              >
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-6">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground ml-2">{plan.period}</span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* 功能列表 */}
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA 按钮 */}
                  <Button variant={plan.variant} size="lg" className="w-full">
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* 额外说明 */}
        <motion.p variants={fadeInUp} className="text-center text-sm text-muted-foreground mt-12">
          所有方案均支持 7 天无理由退款 · 企业版支持按年付费享 8 折优惠
        </motion.p>
      </motion.div>
    </section>
  );
}
