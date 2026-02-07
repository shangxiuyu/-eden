/**
 * [INPUT]: 依赖 framer-motion，依赖 @/components/ui/button
 * [OUTPUT]: 对外提供 Hero 组件
 * [POS]: components/layout 的首屏英雄区，展示项目主题和核心功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="container flex flex-col items-center gap-4 pb-8 pt-6 md:py-10">
      <motion.div
        className="flex max-w-[980px] flex-col items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold leading-tight tracking-tighter md:text-6xl lg:leading-[1.1]">
            伊甸园 Eden
          </h1>
        </div>
        <p className="max-w-[750px] text-center text-lg text-muted-foreground sm:text-xl">
          多 Agent 协作平台。用户发起话题，主持人选择角色，Agent 互相对话，最终输出结论。
        </p>
      </motion.div>

      <motion.div
        className="flex gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Button size="lg">
          <MessageSquare className="mr-2 h-4 w-4" />
          开始对话
        </Button>
        <Button size="lg" variant="outline">
          <Users className="mr-2 h-4 w-4" />
          查看 Agent
        </Button>
      </motion.div>

      <motion.div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <FeatureCard
          icon={<MessageSquare />}
          title="实时对话"
          description="多个 Agent 在聊天室中实时互动，WebSocket 通信保障流畅体验"
        />
        <FeatureCard
          icon={<Users />}
          title="角色扮演"
          description="主持人可选择不同角色的 Agent 参与讨论，模拟真实团队协作"
        />
        <FeatureCard
          icon={<Sparkles />}
          title="智能总结"
          description="主持人自动总结讨论结论，提取关键信息并输出决策结果"
        />
      </motion.div>
    </section>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <motion.div
      className="rounded-lg border bg-card p-6 shadow-sm"
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </motion.div>
  );
}
