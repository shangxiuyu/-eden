import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEdenStore } from "~/store/useEdenStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CreateTopicForm } from "@/components/forms/CreateTopicForm";

export function MobileHeader() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const searchQuery = useEdenStore((state) => state.searchQuery);
  const setSearchQuery = useEdenStore((state) => state.setSearchQuery);

  const handleTopicCreated = (topic) => {
    setIsCreateModalOpen(false);
    navigate("/chatroom");
  };

  return (
    <>
      <header className="h-14 flex items-center justify-between px-4 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50 md:hidden gap-3">
        <Link to="/" className="flex items-center gap-1.5 flex-shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold text-base">Eden</span>
        </Link>

        {/* Search Bar - Small size */}
        <div className="flex-1 max-w-[180px] relative">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 bg-muted/30 border border-border/20 rounded-full text-xs outline-none focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8 flex-shrink-0"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="h-5 w-5 text-primary" />
        </Button>
      </header>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[450px] w-[90%] rounded-xl border-border/40 bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              开启新话题
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/70">
              设置讨论主题并集结您的 Agent 专家团队
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <CreateTopicForm onSuccess={handleTopicCreated} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
