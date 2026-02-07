/**
 * [INPUT]: 依赖 react, react-router-dom, @/store/authStore, @/components/ui/button, @/components/ui/input, @/components/ui/card, lucide-react
 * [OUTPUT]: 对外提供 LoginPage 组件
 * [POS]: pages/ 的登录页，提供邮箱密码登录功能
 */

import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/motion";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/chatroom";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || "登录失败，请检查您的凭据");
      }
    } catch (err) {
      setError("登录失败，请检查您的凭据");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container relative min-h-[calc(100vh-3.5rem)] flex items-center justify-center py-10">
      {/* 背景装饰 */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        <Card className="p-8 border-border/40 bg-card/50 backdrop-blur-md">
          <motion.div variants={fadeInUp} className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">欢迎回来</h1>
            <p className="text-muted-foreground mt-2">登录您的伊甸园账号</p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div variants={fadeInUp} className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  className="pl-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </motion.div>

            <motion.div variants={fadeInUp} className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive font-medium"
              >
                {error}
              </motion.p>
            )}

            <motion.div variants={fadeInUp}>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                variant="primary"
                isLoading={isLoading}
                rightIcon={!isLoading && <ArrowRight />}
              >
                {isLoading ? "登录中..." : "登录"}
              </Button>
            </motion.div>
          </form>

          <motion.div variants={fadeInUp} className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              还没有账号？{" "}
              <button className="text-primary hover:underline font-medium">立即注册</button>
            </p>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}
