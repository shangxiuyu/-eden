import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolBox } from "./ToolBox";
import { cn } from "~/lib/utils";
import type { ToolCall, ToolResult } from "@shared/types";
import { useThemeStore } from "~/store/themeStore";

interface MessageContentProps {
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  isUsingTool?: boolean;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  variant?: "user" | "agent";
}

/**
 * 解析文本字符串，高亮 @提及
 */
function parseMentions(text: string): React.ReactNode[] {
  // 匹配 @ 后面只包含字母、数字、下划线、破折号的字符
  // 这样可以避免匹配到后面的中文或其他标点符号
  const mentionPattern = /@([a-zA-Z0-9_-]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    let name = match[1];

    // 移除末尾可能的标点符号（虽然现在的正则不太会匹配到标点，作为防御性编程保留）
    const punctuationMatch = name.match(/[.,;!?。，；！？]+$/);
    if (punctuationMatch) {
      name = name.substring(0, name.length - punctuationMatch[0].length);
    }

    const fullMatch = `@${name}`;
    const matchIndex = match.index;

    // 添加 @之前的文本
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // 添加高亮的 @提及
    parts.push(
      <span
        key={`${matchIndex}-${name}`}
        className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 rounded font-medium mx-0.5 text-xs"
      >
        {fullMatch}
      </span>
    );

    // 更新 lastIndex
    lastIndex = matchIndex + fullMatch.length;
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * 自定义文本渲染组件，用于支持 @mention
 * 注意：ReactMarkdown 的 p 标签会包含 text node 和其他 inline node
 * 我们只处理直接的 string children
 */
const TextWithMentions = ({ children, node, ...props }: any) => {
  return (
    <p {...props}>
      {React.Children.map(children, (child) => {
        if (typeof child === "string") {
          return parseMentions(child);
        }
        return child;
      })}
    </p>
  );
};

// 列表项也需要支持
const ListItemWithMentions = ({ children, node, ...props }: any) => {
  return (
    <li {...props}>
      {React.Children.map(children, (child) => {
        if (typeof child === "string") {
          return parseMentions(child);
        }
        // 如果是 p 标签（markdown list item 可能包含 p），则让 p 处理
        return child;
      })}
    </li>
  );
};

/**
 * MessageContent 组件
 */
export function MessageContent({
  content,
  reasoning,
  isStreaming,
  isUsingTool,
  toolCalls,
  toolResults,
  variant = "agent",
}: MessageContentProps) {
  const { theme } = useThemeStore();
  const [isReasoningExpanded, setIsReasoningExpanded] = React.useState(!!isStreaming);

  // 思考完成后自动折叠
  React.useEffect(() => {
    if (!isStreaming) {
      setIsReasoningExpanded(false);
    }
  }, [isStreaming]);

  // Logic to determine if we need prose-invert (light text on dark bg)
  // In light theme: user bubble is dark indigo (needs invert), agent bubble is light gray (needs NO invert)
  // In dark theme: both bubbles are relatively dark. Both need invert.
  // In desert theme: User is light clay (needs NO invert), Agent is dark brown (needs invert).
  const needsInvert = React.useMemo(() => {
    if (theme === "dark") return true;
    if (theme === "light") return variant === "user";
    if (theme === "desert") return variant === "agent";
    return variant === "user";
  }, [theme, variant]);

  // Silence Protocol
  const trimmed = content.trim().toUpperCase();
  const isPartialSilence = /^\[\s*S?I?L?E?N?C?E?\]?$/.test(trimmed);
  const isSilenceArtifact = trimmed.startsWith("[") && trimmed.includes("SILENCE");

  if ((isPartialSilence || isSilenceArtifact) && (isStreaming || trimmed.length < 50)) {
    return null;
  }

  // 预处理内容，修复非标准 Markdown 和移除协议标签
  const preprocessContent = (text: string) => {
    if (!text) return text;
    let processed = text;

    // 0. 移除协议标签 (Fix: Leaked tags)
    processed = processed.replace(/<\/?final>/gi, ""); // Remove <final> and </final>

    // 移除 [SILENCE] 标记如果它出现在开头
    const silenceRegex = /^\[\s*S?I?L?E?N?C?E?\]?\s*/i;
    if (silenceRegex.test(processed)) {
      processed = processed.replace(silenceRegex, "");
    }

    // 1. 修复像 "Text### Header" 这样没有换行的标题
    // 在 # 号前如果不是换行符，强制加两个换行
    processed = processed.replace(/([^\n])(#{1,6})/g, "$1\n\n$2");

    // 2. 修复像 "###Title" 这样 # 后没有空格的标题
    processed = processed.replace(/(^|\n)(#{1,6})([^\s#])/g, "$1$2 $3");

    // 3. 修复标题过长的问题 (Kimi 经常把整段话放在标题里)
    // 如果标题内容超过 50 个字符，将其降级为加粗文本
    // 匹配: 行首 # + 空格 + 内容
    processed = processed.replace(/(^|\n)#{1,6} ([^\n]+)/g, (match, prefix, content) => {
      if (content.length > 50) {
        return `${prefix}**${content}**`;
      }
      return match;
    });

    return processed;
  };

  const processedContent = preprocessContent(content);

  // 如果预处理后没有内容且没有在运行工具，则不渲染任何东西（防止空气泡）
  if (!processedContent?.trim() && !isUsingTool && !isStreaming) {
    return null;
  }

  return (
    <div className="text-sm break-words overflow-hidden">
      {/* 
        使用 Tailwind Typography (prose) 样式 
        - prose-sm: 小号字体
        - max-w-none: 移除最大宽度限制
        - prose-p:my-1: 减小段落间距
      */}
      <div
        className={cn(
          "prose prose-sm max-w-none leading-snug !text-inherit",
          needsInvert && "prose-invert",
          "prose-p:my-2 prose-pre:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
          "prose-p:!text-inherit prose-li:!text-inherit prose-ul:!text-inherit prose-ol:!text-inherit",
          "prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0",
          "prose-headings:!text-inherit prose-headings:font-bold prose-headings:tracking-tight",
          "prose-strong:!text-inherit prose-strong:font-bold prose-strong:bg-premium-bg-hover/10 prose-strong:px-1 prose-strong:rounded-sm",
          "prose-a:text-premium-primary prose-a:underline hover:prose-a:opacity-80",
          "prose-blockquote:border-l-2 prose-blockquote:border-current/20 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:!text-inherit prose-blockquote:opacity-70 prose-blockquote:my-2",
          "prose-hr:my-4 prose-hr:border-current/10",
          "prose-ol:list-decimal prose-ol:pl-5 prose-ul:list-disc prose-ul:pl-5",
          variant === "agent"
            ? (needsInvert ? "!text-white/95" : "!text-premium-text-primary")
            : "!text-white"
        )}
      >
        {/* Reasoning Block: 模型思维过程 (CoT) */}
        {reasoning && (
          <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <button
              onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all group",
                needsInvert
                  ? "bg-white/10 hover:bg-white/15 text-white/70"
                  : "bg-premium-bg-hover/40 hover:bg-premium-bg-hover/60 text-premium-text-primary/60",
                "border border-current/5"
              )}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-500",
                isStreaming ? "bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.6)]" : "bg-gray-400/50"
              )} />
              <span>{isStreaming ? (content ? "Thinking about final response..." : "Thinking...") : "Thought Process"}</span>
              <span className={cn(
                "transition-transform duration-300 transform opacity-50 group-hover:opacity-100",
                isReasoningExpanded ? "rotate-0" : "-rotate-90"
              )}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-current">
                  <path d="M7 2L4 5L1 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            {isReasoningExpanded && (
              <div className={cn(
                "mt-2 ml-2 pl-4 border-l-2 border-current/10 text-[13px] leading-relaxed italic overflow-hidden",
                needsInvert ? "text-white/50" : "text-premium-text-primary/60",
                isStreaming && "line-clamp-1"
              )}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reasoning}
                </ReactMarkdown>
                {isStreaming && !content && (
                  <span className="inline-block w-1 h-3.5 bg-blue-500/40 ml-1 animate-pulse align-middle" />
                )}
              </div>
            )}
          </div>
        )}

        {/* 思考中状态：只有在既没有内容也没有推理过程时才显示占位符 */}
        {isStreaming && !content && !reasoning && !isUsingTool && (
          <div className="flex items-center gap-3 py-2 px-1 text-premium-primary/60 italic animate-in fade-in duration-500">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 bg-premium-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-premium-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-premium-primary/40 rounded-full animate-bounce" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest opacity-70">
              Agent is thinking...
            </span>
          </div>
        )}

        {content && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: TextWithMentions,
              li: ListItemWithMentions,
              // 链接样式优化
              a: ({ node, ...props }) => (
                <a
                  {...props}
                  className={cn(
                    "font-medium transition-colors hover:underline",
                    variant === "user" ? "text-white/90" : "text-premium-primary hover:text-premium-primary/80"
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ),
              // 代码块样式
              code: ({ node, inline, className, children, ...props }: any) => {
                return inline ? (
                  <code
                    className={cn(
                      "px-1.5 py-0.5 rounded-md font-mono text-[0.85em] border",
                      variant === "user"
                        ? (needsInvert ? "bg-white/15 text-white border-white/20" : "bg-black/10 text-black border-black/20")
                        : (needsInvert ? "bg-white/15 text-white border-white/20" : "bg-premium-bg-hover/10 text-premium-text-primary border-premium-border/30")
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                ) : (
                  <div className="relative group my-4 rounded-xl overflow-hidden border border-white/10 bg-black/80 shadow-2xl transition-all duration-300 hover:border-primary/30">
                    <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/20" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/20" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400/20" />
                      </div>
                      <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                        {className?.replace('language-', '') || 'code'}
                      </span>
                    </div>
                    <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-blue-100/90 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      <code className={className} {...props}>{children}</code>
                    </pre>
                  </div>
                );
              },
            }}
          >
            {processedContent}
          </ReactMarkdown>
        )}
      </div>

      {isStreaming && (
        <span className="inline-block w-1 h-3.5 bg-blue-500 ml-0.5 animate-pulse align-middle" />
      )}
      <ToolBox toolCalls={toolCalls} toolResults={toolResults} isExecuting={isUsingTool} />
    </div>
  );
}
