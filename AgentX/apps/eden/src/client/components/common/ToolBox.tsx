import { useState } from "react";
import { ChevronDown, ChevronUp, Terminal, CheckCircle2, AlertCircle, Box } from "lucide-react";
import type { ToolCall, ToolResult } from "@shared/types";
import { cn } from "~/lib/utils";

interface ToolBoxProps {
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isExecuting?: boolean;
}

export function ToolBox({ toolCalls, toolResults, isExecuting }: ToolBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if ((!toolCalls || toolCalls.length === 0) && (!toolResults || toolResults.length === 0))
    return null;

  const uniqueTools = [...new Set(toolCalls?.map((tc) => tc.name) || [])];

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-primary/10"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shadow-inner relative">
            <Box size={14} />
            {isExecuting && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
              Tool Intelligence
            </span>
            <span className="text-xs font-semibold text-foreground/80">
              {uniqueTools.length > 0 ? uniqueTools.join(", ") : "Executing tools..."}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {toolCalls?.length || 0} calls
          </div>
          <div className="text-muted-foreground/50 transition-transform duration-300">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {/* Content */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-primary/10 bg-black/5 p-4">
            {toolCalls?.map((tc) => {
              const result = toolResults?.find((tr) => tr.toolCallId === tc.id);
              let parsedArgs = {};
              try {
                parsedArgs = JSON.parse(tc.arguments);
              } catch (e) {
                parsedArgs = { error: "Failed to parse arguments" };
              }

              return (
                <div key={tc.id} className="space-y-3">
                  {/* Tool Call */}
                  <div className="relative pl-4">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-primary/30" />
                    <div className="flex items-center gap-2 mb-1.5">
                      <Terminal size={12} className="text-primary/60" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary/80">
                        {tc.name}
                      </span>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-white/5 p-2.5 shadow-sm">
                      <pre className="font-mono text-[11px] leading-relaxed text-blue-300/90 whitespace-pre-wrap">
                        {JSON.stringify(parsedArgs, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Tool Result */}
                  {result && (
                    <div className="pl-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        {result.isError ? (
                          <AlertCircle size={12} className="text-destructive/80" />
                        ) : (
                          <CheckCircle2 size={12} className="text-green-500/80" />
                        )}
                        <span
                          className={cn(
                            "text-[11px] font-bold uppercase tracking-wider",
                            result.isError ? "text-destructive/80" : "text-green-500/80"
                          )}
                        >
                          {result.isError ? "Runtime Error" : "Execution Result"}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "rounded-lg border p-2.5 shadow-sm overflow-x-auto",
                          result.isError
                            ? "bg-destructive/5 border-destructive/20 text-destructive-foreground"
                            : "bg-green-500/5 border-green-500/10 text-foreground/90"
                        )}
                      >
                        <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto">
                          {result.content}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
