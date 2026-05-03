import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send } from "lucide-react";
import type { AppState, Message } from "@/lib/store";
import { addXP } from "@/lib/store";
import { streamAvatarResponse } from "@/lib/avatar-ai";

interface Props {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onBack: () => void;
}

const AVATAR_COLORS: Record<string, string> = {
  nebula: "#7c3aed", flame: "#ea580c", crystal: "#0ea5e9", aurora: "#16a34a",
};
const AVATAR_SYMBOLS: Record<string, string> = {
  nebula: "✦", flame: "◈", crystal: "◆", aurora: "◉",
};

const QUICK_PROMPTS = [
  "How do smart contracts work?",
  "ETH vs Solana — key differences?",
  "Getting started on Solana",
  "What is reentrancy?",
  "Explain gas fees",
  "What is DeFi?",
];

export default function Chat({ state, onStateChange, onBack }: Props) {
  const profile = state.profile!;
  const [input, setInput]             = useState("");
  const [streaming, setStreaming]     = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [error, setError]             = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const avatarColor  = AVATAR_COLORS[profile.avatar.appearance]  ?? "#7c3aed";
  const avatarSymbol = AVATAR_SYMBOLS[profile.avatar.appearance] ?? "✦";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, streamContent]);

  useEffect(() => {
    if (state.messages.length === 0) sendGreeting();
  }, []);

  const sendGreeting = async () => {
    const txt = `Hi ${profile.name}. I'm ${profile.avatar.name} — your web3 tutor. You're a ${profile.level} learner focused on ${profile.chain === "both" ? "Ethereum and Solana" : profile.chain}, with ${profile.hoursPerDay}h/day. I'm here 24/7. What do you want to learn first?`;
    appendMessage({ id: crypto.randomUUID(), role: "assistant", content: txt, timestamp: new Date().toISOString() });
  };

  const appendMessage = useCallback((msg: Message) => {
    onStateChange({ ...state, messages: [...state.messages, msg] });
  }, [state, onStateChange]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    setError(null);
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim(), timestamp: new Date().toISOString() };
    const newState = { ...state, messages: [...state.messages, userMsg] };
    onStateChange(newState);
    setInput("");
    setStreaming(true);
    setStreamContent("");

    let full = "";
    try {
      for await (const chunk of streamAvatarResponse(text.trim(), profile, newState.messages)) {
        full += chunk;
        setStreamContent(full);
      }
      const aMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: full, timestamp: new Date().toISOString() };
      const xpGain = Math.min(50, Math.max(10, Math.floor(full.length / 100)));
      onStateChange(addXP({ ...newState, messages: [...newState.messages, aMsg] }, xpGain));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStreaming(false);
      setStreamContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const formatContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang  = lines[0];
        const code  = lines.slice(1).join("\n");
        return (
          <div key={i} className="my-3 border border-border overflow-hidden">
            {lang && (
              <div className="bg-muted border-b border-border px-3 py-1.5 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{lang}</span>
              </div>
            )}
            <pre className="bg-card p-3 overflow-x-auto font-mono text-xs text-foreground leading-relaxed">{code}</pre>
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
    <div className="flex flex-col h-[calc(100vh-104px)]">
      {/* Header */}
      <div className="flex items-center gap-3 py-3 border-b border-border">
        <button data-testid="button-back-chat" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="w-8 h-8 flex items-center justify-center text-base font-bold shrink-0"
          style={{ background: avatarColor, color: "#fff" }}
        >
          {avatarSymbol}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-foreground">{profile.avatar.name}</div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            {streaming ? "thinking..." : "online · web3 tutor"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        <AnimatePresence initial={false}>
          {state.messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-1"
                  style={{ background: avatarColor, color: "#fff" }}
                >
                  {avatarSymbol}
                </div>
              )}
              <div
                data-testid={`message-${msg.role}`}
                className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-foreground text-background font-mono"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                {formatContent(msg.content)}
              </div>
            </motion.div>
          ))}

          {/* Streaming */}
          {streaming && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 justify-start">
              <div
                className="w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-1"
                style={{ background: avatarColor, color: "#fff" }}
              >
                {avatarSymbol}
              </div>
              <div className="max-w-[85%] border border-border bg-card px-3.5 py-2.5 text-sm text-foreground leading-relaxed">
                {streamContent ? (
                  <>{formatContent(streamContent)}<span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 cursor-blink" /></>
                ) : (
                  <div className="flex items-center gap-1.5 py-0.5">
                    <div className="w-1.5 h-1.5 bg-muted-foreground typing-dot" />
                    <div className="w-1.5 h-1.5 bg-muted-foreground typing-dot" />
                    <div className="w-1.5 h-1.5 bg-muted-foreground typing-dot" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 font-mono text-xs text-destructive">
            Error: {error}
          </div>
        )}

        {/* Quick prompts */}
        {state.messages.length <= 1 && !streaming && (
          <div className="grid grid-cols-2 gap-1.5 mt-4">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                data-testid="quick-prompt"
                onClick={() => sendMessage(p)}
                className="text-left font-mono text-xs border border-border bg-card px-3 py-2 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all duration-150"
              >
                → {p}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <div className="flex-1 border border-border bg-card flex items-center">
            <span className="font-mono text-sm text-muted-foreground pl-3 shrink-0 select-none">›</span>
            <textarea
              ref={inputRef}
              data-testid="input-chat"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${profile.avatar.name}...`}
              rows={1}
              className="flex-1 bg-transparent px-2 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-32"
              style={{ minHeight: "40px" }}
            />
          </div>
          <button
            data-testid="button-send"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="bg-foreground text-background h-10 w-10 flex items-center justify-center shrink-0 disabled:opacity-30 hover:opacity-80 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
