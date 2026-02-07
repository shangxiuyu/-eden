import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  LogOut,
  Sparkles,
  User,
  ChevronRight,
  Bell,
  Shield,
  HelpCircle,
  Brain,
  Server,
  Zap,
  Store,
} from "lucide-react";
import { useThemeStore } from "@/store/themeStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const THEMES = [
  { id: "light", name: "极致亮白", color: "#000000", bg: "#ffffff" },
  { id: "dark", name: "深邃暗黑", color: "#3b82f6", bg: "#000000" },
  { id: "desert", name: "沙漠经典", color: "#C39E88", bg: "#2d2521" },
];

export function MinePage() {
  const { logout, user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex flex-col min-h-full pb-20">
      {/* Header / Profile Section */}
      <div className="bg-background pt-6 pb-8 px-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User</h1>
            <p className="text-muted-foreground">欢迎回到 Eden</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Theme Settings Section */}
        <Section title="主题风格">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all overflow-hidden group",
                  theme === t.id
                    ? "border-primary bg-primary/5"
                    : "border-border/40 bg-card hover:border-border/80"
                )}
              >
                <div
                  className="w-10 h-10 rounded-full border-2 border-white/10 shadow-inner"
                  style={{ backgroundColor: t.bg }}
                >
                  <div
                    className="w-4 h-4 rounded-full mt-1 ml-1"
                    style={{ backgroundColor: t.color }}
                  />
                </div>
                <span className="text-xs font-medium">{t.name}</span>
                {theme === t.id && (
                  <div className="absolute top-1 right-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* Settings Section */}
        <Section title="通用设置">
          <MenuItem icon={Store} label="应用市场" onClick={() => navigate("/market")} />
          <MenuItem icon={Zap} label="技能配置" onClick={() => navigate("/skills")} />
          <MenuItem icon={Brain} label="模型管理" onClick={() => navigate("/models")} />
          <MenuItem icon={Server} label="MCP 服务" onClick={() => navigate("/mcps")} />
          <MenuItem icon={Sparkles} label="设计系统" onClick={() => navigate("/design-system")} />
        </Section>

        <Section title="偏好设置">
          <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/40">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">消息通知</span>
            </div>
            <Switch />
          </div>
        </Section>

        <Section title="帮助与支持">
          <MenuItem icon={HelpCircle} label="帮助与反馈" />
          <MenuItem icon={Shield} label="隐私政策" />
        </Section>

        <Button
          variant="destructive"
          className="w-full mt-4 h-12 rounded-xl"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground ml-1">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-card hover:bg-accent/50 rounded-xl border border-border/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
    </button>
  );
}
