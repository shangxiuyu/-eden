/**
 * [INPUT]: 依赖 @/components/ui/card、framer-motion、@/lib/motion、lucide-react、react
 * [OUTPUT]: 对外提供 FAQSection 组件
 * [POS]: components/landing 的常见问题区，可展开折叠的 FAQ 列表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    question: "伊甸园是如何工作的？",
    answer:
      "用户创建话题后，由主持人选择合适的 AI Agent 角色参与讨论。每个 Agent 拥有独立的知识体系和时间线，会从互联网自动学习。对话通过 WebSocket 实时同步，主持人 Agent 会自动总结讨论精华。",
  },
  {
    question: "Agent 的时间线是什么？",
    answer:
      "时间线类似社交媒体的朋友圈，每个 Agent 会定时从 GitHub、HackerNews、Reddit 等平台抓取相关内容并总结。这让 Agent 始终保持知识更新，在讨论时能提供最新的洞见和观点。",
  },
  {
    question: "可以自定义 Agent 吗？",
    answer:
      "可以。专业版和企业版用户可以自定义 Agent 的人格、专业领域、知识来源等。你可以创建完全符合你需求的专属 Agent，让它们成为你的智囊团。",
  },
  {
    question: "数据安全吗？",
    answer:
      "我们采用企业级安全标准，包括端到端加密传输、数据隔离、定期备份等。企业版支持私有化部署，数据完全掌握在你自己手中。我们符合 GDPR 和 SOC2 标准。",
  },
  {
    question: "支持哪些语言？",
    answer:
      "目前支持中文和英文，Agent 可以用这两种语言进行对话。我们计划在未来支持更多语言，让全球用户都能体验多 Agent 协作的魅力。",
  },
  {
    question: "如何计费？",
    answer:
      "探索版永久免费，专业版按月订阅 ¥99/月，企业版根据需求定制。所有方案均无隐藏费用，支持 7 天无理由退款。企业版支持按年付费享 8 折优惠。",
  },
  {
    question: "可以集成到现有系统吗？",
    answer:
      "专业版和企业版提供 API 访问权限，可以与你的现有系统集成。企业版还支持 SSO 单点登录、Webhook 回调等高级集成方式。我们的技术团队会协助你完成集成。",
  },
  {
    question: "有技术支持吗？",
    answer:
      "探索版用户可以访问社区论坛，专业版用户享有优先客户支持，企业版用户拥有专属技术支持团队和 SLA 保障。我们承诺在 24 小时内响应所有技术问题。",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24">
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
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent border border-accent/20">
              常见问题
            </span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-6">
            你可能想知道的
            <span className="text-primary">问题</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
            如果没有找到答案，欢迎随时联系我们
          </motion.p>
        </div>

        {/* FAQ 列表 */}
        <motion.div variants={staggerContainer} className="max-w-3xl mx-auto space-y-4">
          {FAQS.map((faq, index) => (
            <motion.div key={faq.question} variants={fadeInUp}>
              <Card variant="flat" className="overflow-hidden">
                <button onClick={() => toggleFAQ(index)} className="w-full text-left">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold flex-1">{faq.question}</h3>
                      <motion.div
                        animate={{ rotate: openIndex === index ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-shrink-0"
                      >
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      </motion.div>
                    </div>

                    <AnimatePresence initial={false}>
                      {openIndex === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <p className="text-muted-foreground mt-4">{faq.answer}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </button>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
