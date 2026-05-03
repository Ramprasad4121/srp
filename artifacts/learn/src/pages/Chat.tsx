import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft } from "lucide-react";
import type { AppState, Message } from "@/lib/store";
import { addXP } from "@/lib/store";
import { streamAvatarResponse } from "@/lib/avatar-ai";
import { Button } from "@/components/ui/button";

interface Props {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onBack: () => void;
}

const AVATAR_APPEARANCES = [
  { id: "nebula" as const, colors: "from-violet-500 to-indigo-600", symbol: "✦" },
  { id: "flame" as const, colors: "from-orange-500 to-red-600", symbol: "◈" },
  { id: "crystal" as const, colors: "from-cyan-400 to-blue-600", symbol: "◆" },
  { id: "aurora" as const, colors: "from-green-400 to-teal-500", symbol: "◉" },
];

const QUICK_PROMPTS = [
  "Explain how smart contracts work like I'm 12",
  "What's the difference between ETH and SOL?",
  "How do I get started building on Solana?",
  "What's reentrancy and why is it dangerous?",
  "Explain gas fees in simple terms",
  "What's DeFi and how does it make money?",
];

export default function Chat({ state, onStateChange, onBack }: Props) {
  const profile = state.profile!;
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const avatarApp = AVATAR_APPEARANCES.find(a => a.id === profile.avatar.appearance)!;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, streamingContent]);

  useEffect(() => {
    if (state.messages.length === 0) {
      sendFirstGreeting();
    }
  }, []);

  const sendFirstGreeting = async () => {
    const greeting = `Hi ${profile.name}! I'm ${profile.avatar.name}, your personal web3 tutor. I know you're a ${profile.level} learner focused on ${profile.chain === "both" ? "Ethereum and Solana" : profile.chain}, and you have about ${profile.hoursPerDay} hour(s) per day to learn. I'm here 24/7 — ask me anything, and I'll teach it in a way that actually makes sense. What do you want to learn first?`;
    appendMessage({ id: crypto.randomUUID(), role: "assistant", content: greeting, timestamp: new Date().toISOString() });
  };

  const appendMessage = useCallback((msg: Message) => {
    onStateChange({
      ...state,
      messages: [...state.messages, msg],
    });
  }, [state, onStateChange]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    setError(null);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    const newState = { ...state, messages: [...state.messages, userMsg] };
    onStateChange(newState);
    setInput("");
    setStreaming(true);
    setStreamingContent("");

    let full = "";
    try {
      for await (const chunk of streamAvatarResponse(text.trim(), profile, newState.messages)) {
        full += chunk;
        setStreamingContent(full);
      }
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: full,
        timestamp: new Date().toISOString(),
      };
      const xpGained = Math.min(50, Math.max(10, Math.floor(full.length / 100)));
      const withMsg = { ...newState, messages: [...newState.messages, assistantMsg] };
      const withXP = addXP(withMsg, xpGained);
      onStateChange(withXP);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Check your API key.");
    } finally {
      setStreaming(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0];
        const code = lines.slice(1).join("\n");
        return (
          <div key={i} className="my-3 rounded-lg overflow-hidden border border-border">
            {lang && <div className="bg-muted px-3 py-1 text-xs text-muted-foreground font-mono">{lang}</div>}
            <pre className="bg-muted/50 p-3 overflow-x-auto text-xs text-foreground font-mono leading-relaxed">{code}</pre>
          </div>
        );
      }
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part.split(/(\*\*[^*]+\*\*)/g).map((s, j) =>
            s.startsWith("**") && s.endsWith("**")
              ? <strong key={j} className="font-semibold text-foreground">{s.slice(2, -2)}</strong>
              : s
          )}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <button data-testid="button-back-chat" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarApp.colors} flex items-center justify-center text-lg ${streaming ? "avatar-pulse" : ""}`}>
          {avatarApp.symbol}
        </div>
        <div>
          <div className="font-semibold text-sm text-foreground">{profile.avatar.name}</div>
          <div className="text-xs text-muted-foreground">{streaming ? "Thinking..." : "Online · Your web3 tutor"}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin">
        <AnimatePresence initial={false}>
          {state.messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className={`w-7 h-7 shrink-0 rounded-full bg-gradient-to-br ${avatarApp.colors} flex items-center justify-center text-sm mt-1`}>
                  {avatarApp.symbol}
                </div>
              )}
              <div
                data-testid={`message-${msg.role}`}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm"
                }`}
              >
                {formatContent(msg.content)}
              </div>
            </motion.div>
          ))}

          {/* Streaming message */}
          {streaming && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 justify-start"
            >
              <div className={`w-7 h-7 shrink-0 rounded-full bg-gradient-to-br ${avatarApp.colors} flex items-center justify-center text-sm mt-1 avatar-pulse`}>
                {avatarApp.symbol}
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-card border border-border text-foreground leading-relaxed">
                {streamingContent ? (
                  <>{formatContent(streamingContent)}<span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" /></>
                ) : (
                  <div className="flex items-center gap-1.5 py-1">
                    <div className="w-2 h-2 rounded-full bg-primary typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-primary typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-primary typing-dot" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Quick prompts — only if no messages */}
        {state.messages.length <= 1 && !streaming && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                data-testid="quick-prompt"
                onClick={() => sendMessage(p)}
                className="text-left text-xs bg-card border border-border rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all duration-200"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            data-testid="input-chat"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${profile.avatar.name} anything about web3...`}
            rows={1}
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary transition-all max-h-32"
            style={{ minHeight: "44px" }}
          />
          <Button
            data-testid="button-send"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            size="icon"
            className="bg-primary hover:bg-primary/90 h-11 w-11 rounded-xl shrink-0 glow-primary"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
