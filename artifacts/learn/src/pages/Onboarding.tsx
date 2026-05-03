import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { UserProfile, Avatar } from "@/lib/store";

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const AVATAR_OPTIONS: { id: Avatar["appearance"]; label: string; color: string; symbol: string }[] = [
  { id: "nebula",  label: "Nebula",  color: "#7c3aed", symbol: "✦" },
  { id: "flame",   label: "Flame",   color: "#ea580c", symbol: "◈" },
  { id: "crystal", label: "Crystal", color: "#0ea5e9", symbol: "◆" },
  { id: "aurora",  label: "Aurora",  color: "#16a34a", symbol: "◉" },
];

const PERSONALITIES: { id: Avatar["personality"]; label: string; desc: string }[] = [
  { id: "patient",   label: "Patient Guide",      desc: "Step-by-step. Never rushes you." },
  { id: "energetic", label: "Energy Boost",        desc: "High-octane. Pushes you forward." },
  { id: "socratic",  label: "Thought Provoker",    desc: "Teaches through questions." },
  { id: "mentor",    label: "Seasoned Mentor",     desc: "Real-world war stories." },
];

const CHAINS = [
  { id: "both"     as const, label: "Both",     desc: "ETH + Solana",   tag: "⟠ + ◎" },
  { id: "ethereum" as const, label: "Ethereum", desc: "Solidity + EVM", tag: "⟠" },
  { id: "solana"   as const, label: "Solana",   desc: "Rust + Anchor",  tag: "◎" },
];

const LEVELS = [
  { id: "beginner"     as const, label: "Start from zero",     desc: "Never written a contract." },
  { id: "intermediate" as const, label: "Know the basics",     desc: "Ready to go deeper." },
  { id: "advanced"     as const, label: "Going deep",          desc: "Security & architecture." },
];

const HOURS = [0.5, 1, 2, 3, 5];

const TOTAL_STEPS = 5;

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep]               = useState(0);
  const [name, setName]               = useState("");
  const [chain, setChain]             = useState<UserProfile["chain"]>("both");
  const [level, setLevel]             = useState<UserProfile["level"]>("beginner");
  const [hours, setHours]             = useState(1);
  const [avatarName, setAvatarName]   = useState("Sage");
  const [appearance, setAppearance]   = useState<Avatar["appearance"]>("nebula");
  const [personality, setPersonality] = useState<Avatar["personality"]>("patient");

  const canAdvance = step === 1 ? name.trim().length >= 2 : true;

  const selectedAvatar = AVATAR_OPTIONS.find(a => a.id === appearance)!;

  const handleComplete = () => {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      name,
      level,
      chain,
      hoursPerDay: hours,
      goals: [],
      avatar: { name: avatarName, personality, appearance },
      xp: 0,
      streak: 0,
      lastActiveDate: "",
      completedLessons: [],
      currentPath: chain === "solana" ? "sol-foundations" : "eth-foundations",
      onboardingDone: true,
      createdAt: new Date().toISOString(),
    };
    onComplete(profile);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dot grid bg */}
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" />

      {/* Faint right-side dot cluster (x402 style) */}
      <div className="fixed right-0 top-0 w-1/3 h-full dot-grid-sm opacity-20 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Step counter — x402 style */}
        <div className="flex items-center justify-between mb-8">
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
            SRP Learn
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {String(step + 1).padStart(2, "0")} / {String(TOTAL_STEPS).padStart(2, "0")}
          </span>
        </div>

        {/* Step bar */}
        <div className="flex gap-1 mb-10">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="h-px flex-1 transition-all duration-500"
              style={{ background: i <= step ? "hsl(var(--foreground))" : "hsl(var(--border))" }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >

            {/* ── Step 0: Welcome ── */}
            {step === 0 && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-10 h-10 flex items-center justify-center text-xl font-bold"
                      style={{ background: selectedAvatar.color, color: "#fff" }}
                    >
                      {selectedAvatar.symbol}
                    </div>
                  </div>
                  <h1 className="text-4xl font-bold text-foreground leading-none tracking-tight">
                    SRP Learn
                  </h1>
                  <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
                    — Web3 Personal Mentor
                  </p>
                </div>

                <p className="text-muted-foreground leading-relaxed text-sm max-w-sm">
                  No tutorial hell. No boring videos. Just you and your AI avatar — learning Ethereum and Solana, building real skills that stick.
                </p>

                {/* Stats strip — x402 style */}
                <div className="border border-border divide-x divide-border flex">
                  {[
                    { value: "19",    label: "Lessons" },
                    { value: "4",     label: "Paths" },
                    { value: "24/7",  label: "AI Mentor" },
                  ].map(s => (
                    <div key={s.label} className="flex-1 p-4">
                      <div className="font-mono text-2xl font-bold text-foreground leading-none">{s.value}</div>
                      <div className="label-mono mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 1: Name + Level ── */}
            {step === 1 && (
              <div className="space-y-7">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Who are you?</h2>
                  <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest uppercase">Personalize your journey</p>
                </div>
                <div className="space-y-2">
                  <label className="label-mono">Your name</label>
                  <input
                    data-testid="input-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name..."
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && canAdvance && setStep(s => s + 1)}
                    className="w-full bg-card border border-border text-foreground font-mono text-sm px-4 py-3 outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-mono">Your background</label>
                  <div className="space-y-1.5">
                    {LEVELS.map(l => (
                      <button
                        key={l.id}
                        data-testid={`level-${l.id}`}
                        onClick={() => setLevel(l.id)}
                        className={`w-full border p-4 text-left transition-all duration-150 flex items-center justify-between group ${
                          level === l.id
                            ? "border-foreground/40 bg-card"
                            : "border-border bg-card hover:border-foreground/20"
                        }`}
                      >
                        <div>
                          <div className="font-medium text-sm text-foreground">{l.label}</div>
                          <div className="font-mono text-xs text-muted-foreground mt-0.5">{l.desc}</div>
                        </div>
                        {level === l.id && <span className="font-mono text-sm text-foreground">→</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Chain ── */}
            {step === 2 && (
              <div className="space-y-7">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">What are you learning?</h2>
                  <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest uppercase">Pick your path</p>
                </div>
                <div className="space-y-1.5">
                  {CHAINS.map(c => (
                    <button
                      key={c.id}
                      data-testid={`chain-${c.id}`}
                      onClick={() => setChain(c.id)}
                      className={`w-full border p-5 text-left transition-all duration-150 flex items-center justify-between ${
                        chain === c.id
                          ? "border-foreground/40 bg-card"
                          : "border-border bg-card hover:border-foreground/20"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-lg text-foreground">{c.tag}</span>
                        <div>
                          <div className="font-semibold text-foreground">{c.label}</div>
                          <div className="font-mono text-xs text-muted-foreground mt-0.5">{c.desc}</div>
                        </div>
                      </div>
                      {chain === c.id && <span className="font-mono text-sm text-foreground">→</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 3: Hours ── */}
            {step === 3 && (
              <div className="space-y-7">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">How much time?</h2>
                  <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest uppercase">Hours per day — we plan around you</p>
                </div>
                <div className="flex gap-2">
                  {HOURS.map(h => (
                    <button
                      key={h}
                      data-testid={`hours-${h}`}
                      onClick={() => setHours(h)}
                      className={`flex-1 py-4 border font-mono text-lg font-bold transition-all duration-150 ${
                        hours === h
                          ? "border-foreground/40 bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:border-foreground/30"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <p className="font-mono text-xs text-muted-foreground text-center">hours / day</p>

                <div className="border border-border p-4 space-y-2">
                  <div className="label-mono mb-3">Your avatar will</div>
                  {[
                    `Plan ${Math.ceil(hours * 2)} lessons / day`,
                    `Target ${hours * 100} XP daily`,
                    `Adapt pace to your schedule`,
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span className="text-foreground/40">→</span> {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 4: Avatar ── */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Meet your avatar</h2>
                  <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest uppercase">Name & customize your AI tutor</p>
                </div>

                {/* Avatar preview */}
                <div className="flex items-center gap-4 border border-border p-4">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-2xl font-bold shrink-0"
                    style={{ background: selectedAvatar.color, color: "#fff" }}
                  >
                    {selectedAvatar.symbol}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{avatarName || "—"}</div>
                    <div className="font-mono text-xs text-muted-foreground capitalize">{personality} style · {appearance}</div>
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="label-mono">Name your tutor</label>
                  <input
                    data-testid="input-avatar-name"
                    value={avatarName}
                    onChange={e => setAvatarName(e.target.value)}
                    placeholder="e.g. Sage, Rex, Nova..."
                    className="w-full bg-card border border-border text-foreground font-mono text-sm px-4 py-3 outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground"
                  />
                </div>

                {/* Appearance */}
                <div className="space-y-1.5">
                  <label className="label-mono">Appearance</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {AVATAR_OPTIONS.map(a => (
                      <button
                        key={a.id}
                        data-testid={`appearance-${a.id}`}
                        onClick={() => setAppearance(a.id)}
                        className={`border p-3 flex flex-col items-center gap-1.5 transition-all duration-150 ${
                          appearance === a.id ? "border-foreground/40" : "border-border hover:border-foreground/20"
                        }`}
                      >
                        <div
                          className="w-8 h-8 flex items-center justify-center text-base font-bold"
                          style={{ background: a.color, color: "#fff" }}
                        >
                          {a.symbol}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personality */}
                <div className="space-y-1.5">
                  <label className="label-mono">Teaching style</label>
                  <div className="space-y-1">
                    {PERSONALITIES.map(p => (
                      <button
                        key={p.id}
                        data-testid={`personality-${p.id}`}
                        onClick={() => setPersonality(p.id)}
                        className={`w-full border p-3 text-left transition-all duration-150 flex items-center justify-between ${
                          personality === p.id ? "border-foreground/40 bg-card" : "border-border bg-card hover:border-foreground/20"
                        }`}
                      >
                        <div>
                          <div className="font-medium text-xs text-foreground">{p.label}</div>
                          <div className="font-mono text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                        </div>
                        {personality === p.id && <span className="font-mono text-xs text-foreground">→</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-10 flex gap-2">
          {step > 0 && (
            <button
              data-testid="button-back"
              onClick={() => setStep(s => s - 1)}
              className="border border-border bg-card text-foreground font-mono text-sm px-6 py-3 hover:border-foreground/30 transition-colors"
            >
              ← Back
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              data-testid="button-next"
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance}
              className="flex-1 bg-foreground text-background font-mono text-sm font-semibold py-3 disabled:opacity-30 hover:opacity-85 transition-opacity flex items-center justify-center gap-2"
            >
              Continue →
            </button>
          ) : (
            <button
              data-testid="button-start"
              onClick={handleComplete}
              disabled={!avatarName.trim()}
              className="flex-1 bg-foreground text-background font-mono text-sm font-semibold py-3 disabled:opacity-30 hover:opacity-85 transition-opacity flex items-center justify-center gap-2"
            >
              Start Learning →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
