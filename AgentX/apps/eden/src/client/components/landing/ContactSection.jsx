/**
 * [INPUT]: 依赖 @/components/ui/button、@/components/ui/card、@/components/ui/input、framer-motion、@/lib/motion、lucide-react
 * [OUTPUT]: 对外提供 ContactSection 组件
 * [POS]: components/landing 的联系我们版块
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState } from "react";

export function ContactSection() {
  const [formState, setFormState] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // 模拟提交
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setFormState({ name: "", email: "", message: "" });
      setTimeout(() => setIsSuccess(false), 3000);
    }, 1500);
  };

  return (
    <section id="contact" className="py-24">
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
              保持联系
            </span>
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-6">
            期待您的
            <span className="text-primary">声音</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
            无论是产品建议、商务合作还是技术支持，我们随时为您提供帮助
          </motion.p>
        </div>

        <div className="grid md:grid-cols-5 gap-12 max-w-6xl mx-auto">
          {/* 联系信息 */}
          <motion.div variants={fadeInUp} className="md:col-span-2 space-y-8">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold">联系信息</h3>
              <p className="text-muted-foreground">
                我们的团队通常会在 24 小时内回复您的所有咨询。
              </p>
            </div>

            <div className="space-y-4">
              <ContactInfoItem
                icon={<Mail className="w-5 h-5" />}
                title="电子邮箱"
                content="support@eden-ai.com"
              />
              <ContactInfoItem
                icon={<Phone className="w-5 h-5" />}
                title="联系电话"
                content="+86 (010) 8888-6666"
              />
              <ContactInfoItem
                icon={<MapPin className="w-5 h-5" />}
                title="办公地址"
                content="北京市朝阳区科技园 A 座 1201"
              />
            </div>
          </motion.div>

          {/* 联系表单 */}
          <motion.div variants={fadeInUp} className="md:col-span-3">
            <Card variant="raised" className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground ml-1">姓名</label>
                    <Input
                      placeholder="您的称呼"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground ml-1">邮箱</label>
                    <Input
                      type="email"
                      placeholder="您的邮箱"
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">留言内容</label>
                  <textarea
                    className="flex min-h-[120px] w-full rounded-xl border border-input/40 bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                    placeholder="请输入您想对我们说的话..."
                    style={{
                      background: "color-mix(in srgb, var(--color-input) 90%, black)",
                      boxShadow: "inset 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,0,0,0.2)",
                    }}
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  variant={isSuccess ? "accent" : "primary"}
                  isLoading={isSubmitting}
                  leftIcon={!isSubmitting && !isSuccess && <Send className="w-4 h-4" />}
                >
                  {isSuccess ? "发送成功！" : "提交留言"}
                </Button>
              </form>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function ContactInfoItem({ icon, title, content }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-muted-foreground">{content}</p>
      </div>
    </div>
  );
}
