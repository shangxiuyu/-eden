import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Users, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const location = useLocation();

  const menuItems = [
    { icon: MessageSquare, label: "聊天", path: "/chatroom" },
    { icon: Users, label: "Agent", path: "/agents" },
    { icon: Clock, label: "朋友圈", path: "/timeline" },
    { icon: User, label: "我的", path: "/mine" },
  ];

  return (
    <nav className="h-16 flex items-center justify-around px-2 border-t border-border/40 bg-background/80 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
      {menuItems.map((item) => (
        <MobileNavItem key={item.path} item={item} isActive={location.pathname === item.path} />
      ))}
    </nav>
  );
}

function MobileNavItem({ item, isActive }) {
  return (
    <Link to={item.path} className="flex-1 flex flex-col items-center justify-center py-2">
      <div
        className={cn(
          "p-1.5 rounded-xl transition-all duration-300",
          isActive ? "text-primary bg-primary/10" : "text-muted-foreground"
        )}
      >
        <item.icon className="h-5 w-5" />
      </div>
      <span
        className={cn(
          "text-[10px] font-medium mt-1 leading-none",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
