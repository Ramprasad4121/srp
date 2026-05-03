import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { UserProfile, Avatar } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const AVATAR_APPEARANCES: { id: Avatar["appearance"]; label: string; colors: string; symbol: string }[] = [
  { id: "nebula", label: "Nebula", colors: "from-violet-500 to-indigo-600", symbol: "✦" },
  { id: "flame", label: "Flame", colors: "from-orange-500 to-red-600", symbol: "◈" },
  { id: "crystal", label: "Crystal", colors: "from-cyan-400 to-blue-600", symbol: "◆" },
  { id: "aurora", label: "Aurora", colors: "from-green-400 to-teal-500", symbol: "◉" },
];

const AVATAR_PERSONALITIES: { id: Avatar["personality"]; label: string; desc: string }[] = [
  { id: "patient", label: "Patient Guide", desc: "Gentle, step-by-step. Never rushes." },
  { id: "energetic", label: "Energy Boost", desc: "High-octane. Pushes you to the limit." },
  { id: "socratic", label: "Thought Provoker", desc: "Teaches through questions and discovery." },
  { id: "mentor", label: "Seasoned Mentor", desc: "Real-world war stories and hard-won wisdom." },
];

const CHAINS = [
  { id: "both" as const, label: "Both", desc: "ETH + Solana", icon: "⟠◎" },
  { id: "ethereum" as const, label: "Ethereum", desc: "Solidity + EVM", icon: "⟠" },
  { id: "solana" as const, label: "Solana", desc: "Rust + Anchor", icon: "◎" },
];

const LEVELS = [
  { id: "beginner" as const, label: "Fresh Start", desc: "Never written a contract. Start from zero." },
  { id: "intermediate" as const, label: "I Know Basics", desc: "Can write simple contracts, want to go deeper." },
  { id: "advanced" as const, label: "Going Deep", desc: "I want security, architecture, and advanced patterns." },
];

const HOURS = [0.5, 1, 2, 3, 5];

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [chain, setChain] = useState<UserProfile["chain"]>("both");
  const [level, setLevel] = useState<UserProfile["level"]>("beginner");
  const [hours, setHours] = useState(1);
  const [avatarName, setAvatarName] = useState("Sage");
  const [appearance, setAppearance] = useState<Avatar["appearance"]>("nebula");
  const [personality, setPersonality] = useState<Avatar["personality"]>("patient");

  const steps = [
    { title: "Welcome to SRP Learn", subtitle: "Your personal web3 mentor, available 24/7" },
    { title: "Who are you?", subtitle: "Let's personalize your journey" },
    { title: "What are you learning?", subtitle: "Pick your path" },
    { title: "How much time do you have?", subtitle: "We'll plan around your schedule" },
    { title: "Meet your Avatar", subtitle: "Your AI tutor — give them a name and personality" },
  ];

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

  const canAdvance = () => {
    if (step === 1) return name.trim().length >= 2;
    return true;
  };

  const selectedAppearance = AVATAR_APPEARANCES.find(a => a.id === appearance)!;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 stars-bg">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`transition-all duration-500 rounded-full ${
                i === step ? "w-8 h-2 bg-primary" : i < step ? "w-2 h-2 bg-primary/60" : "w-2 h-2 bg-border"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center space-y-8">
                <div className="relative mx-auto w-32 h-32">
                  <div className={`w-full h-full rounded-full bg-gradient-to-br ${selectedAppearance.colors} flex items-center justify-center text-5xl glow-primary avatar-pulse`}>
                    {selectedAppearance.symbol}
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-serif font-bold gradient-text mb-3">SRP Learn</h1>
                  <p className="text-muted-foreground text-lg">The world&apos;s most personal web3 education.</p>
                  <p className="text-muted-foreground mt-2">No tutorial hell. No boring videos. Just you and your AI mentor — building real skills that stick.</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[["⟠◎", "ETH + Solana", "Both ecosystems"], ["★", "Gamified", "XP, streaks, ranks"], ["◈", "AI Avatar", "Your 24/7 mentor"]].map(([icon, title, desc]) => (
                    <div key={title} className="bg-card border border-border rounded-xl p-4">
                      <div className="text-2xl mb-1">{icon}</div>
                      <div className="text-sm font-semibold text-foreground">{title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Name */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-serif font-bold text-foreground">{steps[step].title}</h2>
                  <p className="text-muted-foreground mt-2">{steps[step].subtitle}</p>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Your name</label>
                  <Input
                    data-testid="input-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name..."
                    className="bg-card border-border text-foreground text-lg h-12"
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && canAdvance() && setStep(s => s + 1)}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Your background</label>
                  <div className="grid grid-cols-1 gap-3">
                    {LEVELS.map(l => (
                      <button
                        key={l.id}
                        data-testid={`level-${l.id}`}
                        onClick={() => setLevel(l.id)}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                          level === l.id
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <div className="font-semibold text-foreground">{l.label}</div>
                        <div className="text-sm text-muted-foreground mt-1">{l.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Chain */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-serif font-bold text-foreground">{steps[step].title}</h2>
                  <p className="text-muted-foreground mt-2">{steps[step].subtitle}</p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {CHAINS.map(c => (
                    <button
                      key={c.id}
                      data-testid={`chain-${c.id}`}
                      onClick={() => setChain(c.id)}
                      className={`p-5 rounded-xl border text-left transition-all duration-200 flex items-center gap-4 ${
                        chain === c.id
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <span className="text-3xl">{c.icon}</span>
                      <div>
                        <div className="font-bold text-foreground text-lg">{c.label}</div>
                        <div className="text-sm text-muted-foreground">{c.desc}</div>
                      </div>
                      {chain === c.id && (
                        <div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Hours */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-serif font-bold text-foreground">{steps[step].title}</h2>
                  <p className="text-muted-foreground mt-2">{steps[step].subtitle}</p>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {HOURS.map(h => (
                    <button
                      key={h}
                      data-testid={`hours-${h}`}
                      onClick={() => setHours(h)}
                      className={`py-4 rounded-xl border font-bold text-lg transition-all duration-200 ${
                        hours === h
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border bg-card text-foreground hover:border-primary/50"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <p className="text-center text-muted-foreground text-sm">hours per day</p>
                <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Based on your schedule, your avatar will:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Plan {Math.ceil(hours * 2)} lessons per day</li>
                    <li>Set daily XP goals of ~{hours * 100} XP</li>
                    <li>Remind you when it&apos;s time to learn</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 4: Avatar */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-serif font-bold text-foreground">{steps[step].title}</h2>
                  <p className="text-muted-foreground mt-2">{steps[step].subtitle}</p>
                </div>

                {/* Avatar preview */}
                <div className="flex justify-center">
                  <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${selectedAppearance.colors} flex items-center justify-center text-4xl glow-primary float-anim`}>
                    {selectedAppearance.symbol}
                  </div>
                </div>

                {/* Avatar name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Name your tutor</label>
                  <Input
                    data-testid="input-avatar-name"
                    value={avatarName}
                    onChange={e => setAvatarName(e.target.value)}
                    placeholder="Give your avatar a name..."
                    className="bg-card border-border text-foreground"
                  />
                </div>

                {/* Appearance */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Appearance</label>
                  <div className="grid grid-cols-4 gap-2">
                    {AVATAR_APPEARANCES.map(a => (
                      <button
                        key={a.id}
                        data-testid={`appearance-${a.id}`}
                        onClick={() => setAppearance(a.id)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                          appearance === a.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${a.colors} flex items-center justify-center text-lg`}>{a.symbol}</div>
                        <span className="text-xs text-muted-foreground">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personality */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Teaching style</label>
                  <div className="grid grid-cols-1 gap-2">
                    {AVATAR_PERSONALITIES.map(p => (
                      <button
                        key={p.id}
                        data-testid={`personality-${p.id}`}
                        onClick={() => setPersonality(p.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          personality === p.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <div className="font-semibold text-sm text-foreground">{p.label}</div>
                        <div className="text-xs text-muted-foreground">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <Button
              data-testid="button-back"
              variant="ghost"
              onClick={() => setStep(s => s - 1)}
              className="flex-1 border border-border"
            >
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button
              data-testid="button-next"
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 glow-primary"
            >
              Continue
            </Button>
          ) : (
            <Button
              data-testid="button-start"
              onClick={handleComplete}
              disabled={!avatarName.trim()}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 glow-primary"
            >
              Start Learning with {avatarName || "my Avatar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
