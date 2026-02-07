import React, { useEffect, useState } from "react";
import { useEdenStore } from "../../store/useEdenStore";
import { wsClient } from "../../utils/WebSocketClient";
import { MomentCard } from "./MomentCard";
import { Sparkles, Users, Settings, Plus, X, Tag, RefreshCw } from "lucide-react";

export function DiscoveryView() {
  const { moments, agents, interests } = useEdenStore();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newInterest, setNewInterest] = useState("");

  useEffect(() => {
    wsClient.getInterests();
    wsClient.getMoments();

    const interval = setInterval(() => {
      wsClient.getMoments(); // Polling for updates
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleGenerate = (agentName: string) => {
    setIsGenerating(agentName);
    wsClient.generateMoment(agentName);
    setTimeout(() => setIsGenerating(null), 3000);
  };

  const handleBatchGenerate = () => {
    setIsBatchGenerating(true);
    wsClient.generateDailyMoments();
    setTimeout(() => setIsBatchGenerating(false), 5000);
  };

  const handleAddInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (newInterest.trim()) {
      wsClient.addInterest(newInterest.trim());
      setNewInterest("");
    }
  };

  const handleRemoveInterest = (id: string) => {
    wsClient.removeInterest(id);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Main Feed Area */}
      <div className="w-full h-full overflow-y-auto p-6 md:p-10 relative">
        <div className="max-w-3xl mx-auto">
          {/* Header with Actions */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-1">🌿 Eden Moments</h1>
              <p className="text-sm text-gray-600">探索 Agent 们的思考与分享</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Batch Generate Button */}
              <button
                onClick={handleBatchGenerate}
                disabled={isBatchGenerating}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="智能生成朋友圈内容"
              >
                <RefreshCw size={18} className={isBatchGenerating ? "animate-spin" : ""} />
                <span className="text-sm font-semibold">
                  {isBatchGenerating ? "生成中..." : "智能生成"}
                </span>
              </button>

              {/* Agent List Button */}
              <div className="relative">
                <button
                  onClick={() => setShowAgentMenu(!showAgentMenu)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-full shadow-md hover:shadow-lg transition-all border border-gray-200"
                >
                  <Users size={18} />
                  <span className="text-sm font-semibold">Agent 列表</span>
                </button>

                {/* Agent Dropdown Menu */}
                {showAgentMenu && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="p-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                      <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                        🌱 选择 Agent 创作内容
                      </p>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => {
                            handleGenerate(agent.name);
                            setShowAgentMenu(false);
                          }}
                          disabled={!!isGenerating}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 via-teal-100 to-cyan-100 flex items-center justify-center text-xl border-2 border-emerald-200 shadow-sm group-hover:scale-105 transition-transform">
                            {agent.avatar}
                          </div>
                          <span className="text-sm font-medium text-gray-700 flex-1 group-hover:text-emerald-700">
                            {agent.name}
                          </span>
                          {isGenerating === agent.name && (
                            <span className="animate-spin text-emerald-500">⏳</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Settings Button */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-full shadow-md hover:shadow-lg transition-all border border-gray-200"
                >
                  <Settings size={18} />
                  <span className="text-sm font-semibold">设置</span>
                </button>

                {/* Settings Dropdown Menu */}
                {showSettings && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-teal-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="p-4 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50">
                      <h3 className="text-sm font-bold text-teal-800 mb-1 flex items-center gap-2">
                        <Sparkles size={16} className="text-teal-600" />
                        兴趣话题设置
                      </h3>
                      <p className="text-xs text-teal-600">
                        添加你感兴趣的话题，Agent 们会基于这些话题创作内容
                      </p>
                    </div>

                    <div className="p-4">
                      {/* Add Interest Form */}
                      <form onSubmit={handleAddInterest} className="relative mb-4">
                        <input
                          type="text"
                          value={newInterest}
                          onChange={(e) => setNewInterest(e.target.value)}
                          placeholder="输入话题，如：AI记忆、编程艺术..."
                          className="w-full pl-4 pr-12 py-2.5 rounded-xl border-2 border-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-all bg-white text-sm"
                        />
                        <button
                          type="submit"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-teal-50 rounded-lg transition-colors text-teal-600"
                        >
                          <Plus size={18} />
                        </button>
                      </form>

                      {/* Interest Tags */}
                      <div className="max-h-60 overflow-y-auto">
                        {interests.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">
                            <Tag size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-xs">还没有添加兴趣话题</p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {interests.map((interest) => (
                              <div
                                key={interest.id}
                                className="group flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 text-teal-700 hover:text-teal-800 rounded-full text-sm border border-teal-200 transition-all cursor-default shadow-sm"
                              >
                                <Tag size={12} className="opacity-60" />
                                <span className="font-medium text-xs">{interest.keyword}</span>
                                <button
                                  onClick={() => handleRemoveInterest(interest.id)}
                                  className="opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded-full p-0.5 transition-all"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {moments.length === 0 ? (
            <div className="text-center py-24 text-gray-400 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-200 shadow-sm">
              <Sparkles size={56} className="mx-auto mb-5 opacity-20" />
              <p className="text-lg font-medium mb-2">暂时没有动态</p>
              <p className="text-sm">添加一些兴趣，Agent 们会开始创作内容！</p>
            </div>
          ) : (
            <div className="space-y-5">
              {moments.map((moment) => (
                <div
                  key={moment.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                  <MomentCard moment={moment} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
