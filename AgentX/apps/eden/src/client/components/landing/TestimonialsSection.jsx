/**
 * [INPUT]: 依赖 @/components/ui/card、framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 TestimonialsSection 组件
 * [POS]: components/landing 的用户评价区，展示真实使用反馈
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { fadeInUp, scaleIn, staggerContainer } from "@/lib/motion";
import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "李明",
    role: "产品经理",
    company: "某互联网公司",
    content:
      "伊甸园让我们的头脑风暴效率提升了 3 倍。以前需要约 5 个人的会，现在一个人就能召唤 10 个 Agent，观点更多元，决策更快。",
    avatar: "👨‍💼",
  },
  {
    name: "张薇",
    role: "技术架构师",
    company: "某科技创业公司",
    content:
      "Agent 的时间线功能太棒了！它们会自动从 GitHub、HackerNews 等渠道学习最新技术，讨论时带来的洞见非常有价值。",
    avatar: "👩‍💻",
  },
  {
    name: "王强",
    role: "创始人",
    company: "某 AI 创业公司",
    content:
      "作为单人创业者，伊甸园就像给我配了一个全明星团队。技术、商业、设计各个领域的 Agent 随时待命，再也不孤单了。",
    avatar: "🚀",
  },
  {
    name: "陈丽",
    role: "内容运营",
    company: "某媒体机构",
    content:
      "用伊甸园做选题策划太高效了。让编辑 Agent、数据分析 Agent、用户洞察 Agent 一起讨论，每次都能碰撞出意想不到的角度。",
    avatar: "✍️",
  },
  {
    name: "刘洋",
    role: "研究员",
    company: "某高校实验室",
    content:
      "多 Agent 协作让文献综述变得轻松。每个 Agent 负责不同领域，讨论后自动生成结构化报告，节省了大量时间。",
    avatar: "🔬",
  },
  {
    name: "赵敏",
    role: "设计总监",
    company: "某设计工作室",
    content:
      "Agent 们会从 Dribbble、Behance 等平台学习最新设计趋势，讨论时给出的建议非常专业，就像有了一群设计顾问。",
    avatar: "🎨",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24">
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
              用户评价
            </span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-6">
            听听
            <span className="text-primary">先行者</span>
            怎么说
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
            来自不同行业的用户，都在用伊甸园重新定义工作方式
          </motion.p>
        </div>

        {/* 评价卡片网格 */}
        <motion.div
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
        >
          {TESTIMONIALS.map((testimonial) => (
            <motion.div key={testimonial.name} variants={scaleIn}>
              <Card variant="raised" className="h-full">
                <CardContent className="p-8 flex flex-col h-full">
                  {/* 引号图标 */}
                  <div className="mb-4">
                    <Quote className="w-8 h-8 text-primary/30" />
                  </div>

                  {/* 评价内容 */}
                  <p className="text-muted-foreground mb-6 flex-1">{testimonial.content}</p>

                  {/* 用户信息 */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role} · {testimonial.company}
                      </div>
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
