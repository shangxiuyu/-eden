import { useState } from "react";
import { useEdenStore } from "../../store/useEdenStore";

export function SkillView() {
  const skills = useEdenStore((state) => state.skills);
  const discoverSkills = useEdenStore((state) => state.discoverSkills);
  const initSkills = useEdenStore((state) => state.initSkills);
  const repos = useEdenStore((state) => state.repos);
  const discoverRepos = useEdenStore((state) => state.discoverRepos);
  const selectRepo = useEdenStore((state) => state.selectRepo);
  const setRepos = useEdenStore((state) => state.setRepos);
  const skillPath = useEdenStore((state) => state.skillPath);
  const [isLoading, setIsLoading] = useState(false);

  const handleDiscover = () => {
    setIsLoading(true);
    discoverSkills();
    // Reset loading after a delay or based on store update
    setTimeout(() => setIsLoading(false), 2000);
  };

  const handleInit = () => {
    setIsLoading(true);
    initSkills();
    // Reset loading after a delay or based on store update
    setTimeout(() => setIsLoading(false), 2000);
  };

  const handleDiscoverRepos = () => {
    setIsLoading(true);
    discoverRepos();
    setTimeout(() => setIsLoading(false), 2000);
  };

  const handleSelectRepo = (path: string) => {
    selectRepo(path);
    setRepos([]); // Close selection view
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50/50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">技能中心</h2>
          <div className="flex flex-col gap-1 mt-1">
            <p className="text-sm text-gray-500">管理并启用您的本地 AI 技能定义</p>
            {skillPath && (
              <p
                className="text-xs text-gray-400 font-mono bg-gray-100/50 px-2 py-0.5 rounded w-fit border border-gray-100/50"
                title={skillPath}
              >
                {skillPath.replace(/\/Users\/[^/]+/, "~")}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDiscoverRepos}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors text-xs font-medium shadow-sm"
          >
            {isLoading ? "🔍 正在发现..." : "📂 发现仓库"}
          </button>
          {skills.length > 0 && (
            <button
              onClick={handleDiscover}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors text-xs font-medium shadow-sm"
            >
              {isLoading ? "🔍 查找中..." : "🔍 重新扫描"}
            </button>
          )}
        </div>
      </div>

      {repos.length > 0 && (
        <div className="mb-8 p-6 bg-white border border-indigo-100 rounded-xl shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-900">
              <span>发现多个技能仓库</span>
              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] uppercase font-medium">
                Beta
              </span>
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-2xl">
              我们在您的电脑中发现了以下可能包含 AgentX 技能的文件夹。请选择一个作为当前的工作空间：
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {repos.map((repo) => (
                <div
                  key={repo.path}
                  onClick={() => handleSelectRepo(repo.path)}
                  className="bg-gray-50 hover:bg-white hover:shadow-md border border-gray-200 hover:border-indigo-300 p-4 rounded-xl cursor-pointer transition-all group active:scale-[0.99]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div
                      className="font-medium text-sm text-gray-900 group-hover:text-indigo-600 transition-colors truncate pr-2"
                      title={repo.name}
                    >
                      {repo.name}
                    </div>
                    <div className="px-1.5 py-0.5 bg-white border border-gray-100 rounded text-[10px] text-gray-400 font-mono whitespace-nowrap">
                      {repo.skillCount} 技能
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate font-mono" title={repo.path}>
                    {repo.path}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setRepos([])}
              className="mt-6 text-xs text-gray-400 hover:text-gray-600 transition-colors underline decoration-dotted underline-offset-2"
            >
              跳过，稍后再选
            </button>
          </div>
        </div>
      )}

      {skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl mb-4 text-gray-300">
            🧩
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">尚未加载技能</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm mb-8 leading-relaxed">
            您可以通过搜索本地已有的技能目录，或者初始化一个新的项目技能库来开始。
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleDiscover}
              disabled={isLoading}
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow"
            >
              {isLoading ? "🔍 搜索中..." : "查找现有技能"}
            </button>
            <button
              onClick={handleInit}
              disabled={isLoading}
              className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow-md"
            >
              {isLoading ? "⏳ 初始化中..." : "初始化本地技能"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col min-h-[160px]"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xl group-hover:scale-105 transition-transform text-gray-600">
                  ⚡️
                </div>
                <span className="px-1.5 py-0.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                  {skill.type}
                </span>
              </div>
              <h3 className="text-base font-semibold mb-1.5 text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                {skill.name}
              </h3>
              <p className="text-xs text-gray-500 flex-grow mb-4 line-clamp-2 leading-relaxed h-[2.5em]">
                {skill.description}
              </p>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium mt-auto pt-3 border-t border-gray-50">
                <span className="truncate max-w-[120px] font-mono" title={skill.path}>
                  {skill.path.split("/").pop()}
                </span>
                <span className="flex items-center gap-1.5 align-middle">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-80"></span>
                  已就绪
                </span>
              </div>
            </div>
          ))}

          {/* Add Skill Placeholder */}
          <div
            onClick={handleDiscover}
            className="border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center min-h-[160px] hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group bg-gray-50/50"
          >
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-lg text-gray-400 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-all mb-2 shadow-sm">
              +
            </div>
            <span className="text-xs font-medium text-gray-400 group-hover:text-indigo-600 transition-colors">
              发现更多
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
