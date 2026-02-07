/**
 * [INPUT]: 依赖 @/components/ui/button、card、input，依赖 lucide-react 图标、framer-motion、@/lib/motion
 * [OUTPUT]: 对外提供 DesignSystemPage 页面组件
 * [POS]: pages/ 的设计系统展示页，展示所有可用的 shadcn/ui 组件和颜色系统，带页面过渡动画
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Palette, Box, Type, Layout, Sparkles } from "lucide-react";
import { pageTransition } from "@/lib/motion";

export function DesignSystemPage() {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransition}
      className="container py-10 space-y-10"
    >
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">设计系统</h1>
        <p className="text-muted-foreground">
          伊甸园使用 shadcn/ui + Tailwind CSS v4 + 微拟物设计语言
        </p>
      </div>

      {/* 微拟物设计原则 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">微拟物设计语言</h2>
        </div>
        <Card variant="raised">
          <CardHeader>
            <CardTitle>核心公式</CardTitle>
            <CardDescription>渐变背景 + 立体阴影 + 微交互</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. 渐变背景</h3>
              <code className="text-xs text-muted-foreground">
                linear-gradient(135deg, var(--primary) 0%, color-mix(...) 50%, color-mix(...) 100%)
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. 三层阴影</h3>
              <code className="text-xs text-muted-foreground">
                外投影 + inset 顶部高光 + inset 底部暗边
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. 微交互</h3>
              <code className="text-xs text-muted-foreground">
                hover: scale(1.02) | active: scale(0.97)
              </code>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 颜色系统 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          <h2 className="text-2xl font-bold">颜色系统 - Amethyst Haze</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ColorCard title="Background" hex="#2d2521" />
          <ColorCard title="Foreground" hex="#F1F0E5" />
          <ColorCard title="Primary" hex="#C39E88" />
          <ColorCard title="Secondary" hex="#8A655A" />
          <ColorCard title="Muted" hex="#56453F" />
          <ColorCard title="Accent" hex="#BAAB92" />
          <ColorCard title="Destructive" hex="#E57373" />
          <ColorCard title="Border" hex="#56453F" />
        </div>
      </section>

      {/* 按钮组件 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Box className="h-5 w-5" />
          <h2 className="text-2xl font-bold">按钮组件 - 立体渐变</h2>
        </div>
        <Card variant="inset">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Variant</h3>
              <div className="flex flex-wrap gap-4">
                <Button>Default</Button>
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="accent">Accent</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Size</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
                <Button size="icon">🎨</Button>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Loading</h3>
              <div className="flex gap-4">
                <Button isLoading>Loading</Button>
                <Button variant="secondary" isLoading>
                  Please wait
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 卡片组件 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layout className="h-5 w-5" />
          <h2 className="text-2xl font-bold">卡片组件 - 凸起/内凹</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card variant="raised">
            <CardHeader>
              <CardTitle>Raised 凸起</CardTitle>
              <CardDescription>外投影 + 顶部高光</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                默认变体，适合主要内容卡片。立体感强，视觉层次明显。
              </p>
            </CardContent>
          </Card>
          <Card variant="inset">
            <CardHeader>
              <CardTitle>Inset 内凹</CardTitle>
              <CardDescription>内阴影效果</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                适合输入区域、代码块等需要内嵌视觉的场景。
              </p>
            </CardContent>
          </Card>
          <Card variant="flat">
            <CardHeader>
              <CardTitle>Flat 扁平</CardTitle>
              <CardDescription>最小阴影</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">适合信息密集型布局，减少视觉干扰。</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 输入组件 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          <h2 className="text-2xl font-bold">输入组件 - 内凹效果</h2>
        </div>
        <Card variant="raised">
          <CardContent className="p-6 space-y-4">
            <div className="max-w-md space-y-4">
              <Input placeholder="默认输入框" />
              <Input type="email" placeholder="邮箱输入" />
              <Input type="password" placeholder="密码输入" />
              <Input disabled placeholder="禁用状态" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 设计原则 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">设计原则</h2>
        <Card variant="raised">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. 一切设计必须来自设计系统</h3>
              <p className="text-sm text-muted-foreground">
                所有颜色、组件、间距必须使用 shadcn/ui 和 Tailwind CSS 提供的设计 token
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. 禁止硬编码颜色</h3>
              <p className="text-sm text-muted-foreground">
                使用 var(--color-primary) 和 color-mix() 派生颜色，避免 #C39E88、bg-blue-500
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. 大圆角规范</h3>
              <p className="text-sm text-muted-foreground">
                sm: 16px | default: 20px | lg: 24px | xl: 32px
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">4. 微交互一致性</h3>
              <p className="text-sm text-muted-foreground">
                所有交互元素使用 scale(1.02) hover 和 scale(0.97) active
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </motion.div>
  );
}

function ColorCard({ title, hex }) {
  return (
    <Card variant="raised">
      <CardContent className="p-4 space-y-2">
        <div className="h-20 rounded-xl" style={{ backgroundColor: hex }} />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <code className="text-xs text-muted-foreground">{hex}</code>
        </div>
      </CardContent>
    </Card>
  );
}
