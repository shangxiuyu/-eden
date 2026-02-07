import React, { useEffect, useState } from "react";
import { Check, ChevronDown, Cpu } from "lucide-react";

type Provider = "claude" | "openai";

interface ModelSwitcherProps {
  variant?: "sidebar" | "chat";
}

export function ModelSwitcher({ variant = "sidebar" }: ModelSwitcherProps) {
  const [provider, setProvider] = useState<Provider>("claude");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch initial provider
    fetch("/api/config/provider")
      .then((res) => res.json())
      .then((data) => {
        if (data.provider) setProvider(data.provider);
      })
      .catch((err) => console.error("Failed to fetch provider:", err));
  }, []);

  const handleSwitch = async (newProvider: Provider) => {
    if (newProvider === provider) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setIsOpen(false);
    try {
      const res = await fetch("/api/config/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: newProvider }),
      });
      if (res.ok) {
        setProvider(newProvider);
        // Reload page to clear old sessions (simple approach) or dispatch event
        // Ideally we should clear the chat or reconnect socket.
        // For now, let's just update the UI state.
      } else {
        console.error("Failed to switch provider");
      }
    } catch (err) {
      console.error("Error switching provider:", err);
    } finally {
      setLoading(false);
    }
  };

  // Styles based on variant
  const isSidebar = variant === "sidebar";

  const containerClasses = isSidebar ? "relative w-full" : "relative";

  const buttonClasses = isSidebar
    ? "flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors w-full"
    : `flex items-center space-x-2 px-3 py-1.5 rounded-full transition-all text-sm font-medium border ${
        isOpen
          ? "bg-white text-eden-primary border-eden-primary ring-2 ring-eden-primary/10"
          : "bg-white text-eden-text-primary border-eden-border hover:border-eden-primary hover:text-eden-primary"
      }`;

  const dropdownClasses = isSidebar
    ? "absolute bottom-full left-0 mb-2 w-full bg-[#1e1e1e] border border-white/10 rounded-lg shadow-xl overflow-hidden z-20"
    : "absolute bottom-full left-0 mb-2 w-48 bg-white border border-eden-border rounded-lg shadow-lg overflow-hidden z-20";

  const itemClasses = (active: boolean) =>
    isSidebar
      ? `flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors ${
          active ? "bg-primary/20 text-primary" : "text-gray-400 hover:bg-white/5 hover:text-white"
        }`
      : `flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-eden-primary/5 text-eden-primary font-medium"
            : "text-eden-text-secondary hover:bg-gray-50 hover:text-eden-text-primary"
        }`;

  return (
    <div className={containerClasses}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={buttonClasses}
        title="Switch Model"
      >
        <Cpu className={isSidebar ? "w-4 h-4" : "w-3.5 h-3.5"} />
        <span className={isSidebar ? "flex-1 text-left" : ""}>
          {provider === "claude" ? "Claude" : "Kimi"}
        </span>
        <ChevronDown
          className={`${isSidebar ? "w-4 h-4" : "w-3 h-3"} transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className={dropdownClasses}>
          <div className="p-1">
            <button
              onClick={() => handleSwitch("openai")}
              className={itemClasses(provider === "openai")}
            >
              <span className="flex-1 text-left">Kimi (OpenAI)</span>
              {provider === "openai" && <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => handleSwitch("claude")}
              className={itemClasses(provider === "claude")}
            >
              <span className="flex-1 text-left">Claude</span>
              {provider === "claude" && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
