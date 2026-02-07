import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { pageTransition, fadeInUp, staggerContainer, scaleIn, hoverScale } from "@/lib/motion";
import {
  Wrench,
  Sliders,
  Search,
  Check,
  X,
  FolderSearch,
  RefreshCw,
  Plus,
  Package,
  Layers,
  ArrowRight,
  Info,
  ChevronDown,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useEdenStore } from "~/store/useEdenStore";

/**
 * Professional Skill Card Component
 */
function SkillCard({ skill, onToggle, onUpdateParam }) {
  const [showParams, setShowParams] = useState(false);

  return (
    <motion.div
      layout
      variants={fadeInUp}
      whileHover={hoverScale}
      className="group relative h-full"
    >
      <Card
        className={`h-full border-none shadow-lg transition-all duration-300 ${
          skill.enabled
            ? "bg-gradient-to-br from-[var(--color-card)] to-[var(--color-primary)/5] ring-1 ring-[var(--color-primary)/20]"
            : "bg-[var(--color-card)]/50 grayscale-[0.8] opacity-70 hover:grayscale-0 hover:opacity-100 hover:shadow-xl"
        }`}
      >
        <CardContent className="p-4 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl transition-colors ${
                  skill.enabled
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base tracking-tight group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
                  {skill.name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase h-4 px-1 border-muted-foreground/30 text-muted-foreground"
                  >
                    {skill.type}
                  </Badge>
                  {skill.enabled && (
                    <Badge className="text-[10px] uppercase h-4 px-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("[SkillCard] Toggling skill:", skill.path);
                onToggle(skill.path);
              }}
              className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full transition-all duration-300 shadow-sm ${
                skill.enabled
                  ? "bg-emerald-500 ring-4 ring-emerald-500/10"
                  : "bg-red-500 ring-4 ring-red-500/10"
              } hover:scale-125 active:scale-95`}
              title={skill.enabled ? "点击停用" : "点击启用"}
            />
          </div>

          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-6 flex-grow">
            {skill.desc || "暂无描述内容"}
          </p>

          <Separator className="mb-4 bg-muted/50" />

          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium truncate max-w-[65%]">
              <FolderSearch className="w-3 h-3 flex-shrink-0" />
              <span className="truncate" title={skill.path}>
                {skill.repoName}
              </span>
            </div>

            {skill.params && skill.params.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowParams(!showParams)}
                className="h-7 text-[10px] gap-1 hover:bg-primary/10 text-primary uppercase font-bold tracking-widest"
              >
                <Sliders className="w-3 h-3" />
                {showParams ? "隐藏参数" : "配置参数"}
              </Button>
            )}
          </div>

          <AnimatePresence>
            {showParams && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-4 pt-4 border-t border-muted/30"
              >
                <div className="space-y-3">
                  {skill.params.map((p) => (
                    <div key={p.key} className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground/70 flex items-center gap-1.5">
                        <ArrowRight className="w-2.5 h-2.5" />
                        {p.key}
                      </label>
                      <Input
                        value={p.value}
                        onChange={(e) => onUpdateParam(skill.id, p.key, e.target.value)}
                        placeholder="输入配置值..."
                        className="h-8 text-xs bg-muted/30 border-none focus-visible:ring-1"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function SkillsContent() {
  const [query, setQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("all");

  const skills = useEdenStore((state) => state.skills);
  const repos = useEdenStore((state) => state.repos);
  const skillPath = useEdenStore((state) => state.skillPath);
  const discoverRepos = useEdenStore((state) => state.discoverRepos);
  const selectRepo = useEdenStore((state) => state.selectRepo);

  const toggleSkill = useEdenStore((state) => state.toggleSkill);
  const updateSkillParams = useEdenStore((state) => state.updateSkillParams);

  // Flatten and Transform Logic
  const allSkills = useMemo(() => {
    return skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      desc: skill.description,
      type: skill.type,
      path: skill.path,
      repoName: skill.repoName || "Root Skills",
      repoPath: skill.repoPath || "root",
      enabled: !!skill.enabled,
      params: skill.params || [],
    }));
  }, [skills]);

  // Extract unique repos for the dropdown
  const uniqueRepos = useMemo(() => {
    const rMap = new Map();
    allSkills.forEach((s) => {
      const existing = rMap.get(s.repoPath) || { name: s.repoName, count: 0 };
      rMap.set(s.repoPath, { ...existing, count: existing.count + 1 });
    });
    return Array.from(rMap.entries()).map(([path, data]) => ({
      path,
      name: data.name,
      count: data.count,
    }));
  }, [allSkills]);

  // Combined Filtering Logic
  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSkills.filter((s) => {
      const matchesQuery =
        !q || s.name.toLowerCase().includes(q) || (s.desc && s.desc.toLowerCase().includes(q));
      const matchesRepo = selectedRepo === "all" || s.repoPath === selectedRepo;
      return matchesQuery && matchesRepo;
    });
  }, [allSkills, query, selectedRepo]);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Search & Stats Header */}
      <motion.div variants={fadeInUp} className="relative z-50">
        <div className="bg-[var(--color-card)]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索技能名称或描述..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-11 h-12 bg-black/10 border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/50"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl bg-black/10 border-none px-6 gap-2 hover:bg-black/20 transition-all font-bold"
                  >
                    <Filter className="w-4 h-4" />
                    {selectedRepo === "all"
                      ? "全部仓库"
                      : uniqueRepos.find((r) => r.path === selectedRepo)?.name || "选择仓库"}
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-72 bg-[var(--color-card)] border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl p-2 max-h-[400px] overflow-y-auto custom-scrollbar"
                  align="end"
                >
                  <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-3 py-2">
                    过滤仓库
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuRadioGroup value={selectedRepo} onValueChange={setSelectedRepo}>
                    <DropdownMenuRadioItem
                      value="all"
                      className="rounded-xl px-3 py-2 text-sm focus:bg-[var(--color-primary)]/10 cursor-pointer flex justify-between items-center font-medium"
                    >
                      <span>显示全部仓库</span>
                      <Badge
                        variant="secondary"
                        className="h-4 px-1.5 text-[10px] bg-muted/50 text-muted-foreground border-none"
                      >
                        {allSkills.length}
                      </Badge>
                    </DropdownMenuRadioItem>
                    {uniqueRepos.map((repo) => (
                      <DropdownMenuRadioItem
                        key={repo.path}
                        value={repo.path}
                        className="rounded-xl px-3 py-2 text-sm focus:bg-[var(--color-primary)]/10 cursor-pointer flex justify-between items-center"
                      >
                        <span className="truncate mr-2">{repo.name}</span>
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[10px] bg-muted/50 text-muted-foreground border-none"
                        >
                          {repo.count}
                        </Badge>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-6 px-4">
              <div className="text-center">
                <div className="text-2xl font-black text-[var(--color-primary)]">
                  {uniqueRepos.length}
                </div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
                  Repositories
                </div>
              </div>
              <Separator orientation="vertical" className="h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-black text-[var(--color-primary)]">
                  {allSkills.length}
                </div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
                  Total Skills
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Repo Suggestion - Polished */}
      <AnimatePresence>
        {repos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-none bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Layers className="w-32 h-32" />
              </div>
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold mb-2 flex items-center justify-center md:justify-start gap-2">
                      <FolderSearch className="w-6 h-6 text-indigo-400" />
                      发现潜在技能仓库
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-lg">
                      我们扫描到您的本地环境中存在以下可能包含技能定义的目录。
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {repos.slice(0, 3).map((repo) => (
                      <Button
                        key={repo.path}
                        variant="secondary"
                        size="sm"
                        onClick={() => selectRepo(repo.path)}
                        className="rounded-xl h-auto py-3 bg-white/5 hover:bg-white/10 border border-white/5"
                      >
                        <div className="text-left px-2">
                          <div className="font-bold text-xs">{repo.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {repo.skillCount} Skills
                          </div>
                        </div>
                      </Button>
                    ))}
                    {repos.length > 3 && (
                      <Button
                        variant="ghost"
                        onClick={discoverRepos}
                        className="text-xs text-indigo-400"
                      >
                        +{repos.length - 3} 更多...
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {filteredSkills.length === 0 ? (
          <motion.div
            variants={fadeInUp}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-muted/30 flex items-center justify-center text-4xl mb-6">
              🔍
            </div>
            <h3 className="text-xl font-bold">没有匹配的技能</h3>
            <p className="text-muted-foreground mt-2 max-w-xs">
              尝试更换关键词或过滤器，或者点击刷新按钮重新扫描
            </p>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start"
          >
            <AnimatePresence mode="popLayout">
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill.path}
                  skill={skill}
                  onToggle={() => toggleSkill(skill.path)}
                  onUpdateParam={(id, key, val) => {
                    const currentParams = skill.params || [];
                    const newParams = [...currentParams];
                    const idx = newParams.findIndex((p) => p.key === key);
                    if (idx > -1) newParams[idx].value = val;
                    else newParams.push({ key, value: val });
                    updateSkillParams(skill.path, newParams);
                  }}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function SkillsConfigPage() {
  const skillPath = useEdenStore((state) => state.skillPath);
  const skills = useEdenStore((state) => state.skills);
  const discoverRepos = useEdenStore((state) => state.discoverRepos);
  const discoverSkills = useEdenStore((state) => state.discoverSkills);
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (fn) => {
    setIsLoading(true);
    await fn();
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransition}
      className="container max-w-7xl pt-10 px-8"
    >
      <div className="flex flex-col gap-10">
        {/* Modern Title Area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-widest mb-2">
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              Agent Capabilities
            </div>
            <h1 className="text-5xl font-black tracking-tighter leading-none">
              技能中心{" "}
              <span className="text-[var(--color-primary)] text-3xl opacity-50 block md:inline font-light tracking-normal ml-0 md:ml-4">
                Management
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl">
              探索、配置并强化您的 AI
              团队。所有的技能都直接从您的本地环境中读取，保持灵活性与私密性。
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="rounded-2xl h-11 border-muted/50 hover:bg-muted font-bold"
              onClick={() => handleAction(discoverRepos)}
              disabled={isLoading}
              title="搜索系统中可能包含技能的仓库"
            >
              <FolderSearch className="w-4 h-4 mr-2" />
              搜索仓库
            </Button>
            <Button
              className="rounded-2xl h-11 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-bold shadow-lg shadow-[var(--color-primary)]/20 px-6"
              onClick={() => handleAction(() => useEdenStore.getState().initSkills())}
              disabled={isLoading}
              title="扫描并初始化当前项目的本地技能"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "扫描中..." : "重新扫描"}
            </Button>
          </div>
        </div>

        <SkillsContent />
      </div>
    </motion.div>
  );
}
