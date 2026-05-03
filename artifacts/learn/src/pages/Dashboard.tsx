import type { AppState } from "@/lib/store";
import { xpToLevel } from "@/lib/store";
import { LEARNING_PATHS } from "@/lib/curriculum";
import { CHALLENGES_BY_MODE } from "@/lib/challenges";
import { getCustomTopics } from "@/pages/Admin";
import AvatarViz from "@/components/AvatarViz";
import type { Avatar } from "@/lib/store";

interface Props {
  state: AppState;
  onNavigate: (path: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CHALLENGE_MODES = [
  { id: "beginner" as const, label: "BEGINNER", desc: "Fill in the blanks. Watch contracts execute live.", color: "#16a34a", xp: "100–150 XP", solvers: "2,847" },
  { id: "builder"  as const, label: "BUILDER",  desc: "Implement DeFi primitives from spec.",             color: "#2563eb", xp: "300–400 XP", solvers: "521"   },
  { id: "auditor"  as const, label: "AUDITOR",  desc: "Find bugs. Exploit real vulnerabilities.",         color: "#dc2626", xp: "500–600 XP", solvers: "189"   },
] as const;

export default function Dashboard({ state, onNavigate }: Props) {
  const profile = state.profile!;
  const { level, levelName, progress, toNext } = xpToLevel(profile.xp);
  const today = new Date().getDay();
  const maxWeekly = Math.max(...state.weeklyXp, 1);
  const totalCompleted = profile.completedLessons.length;
  const totalLessons = LEARNING_PATHS.reduce((a, p) => a + p.lessons.length, 0);
  const totalChallenges = Object.values(CHALLENGES_BY_MODE).reduce((a, c) => a + c.length, 0);
  const customTopics = getCustomTopics();

  const relevantPaths = LEARNING_PATHS.filter(p =>
    profile.chain === "both" ? true : p.chain === profile.chain || p.chain === "both"
  );

  const getPathProgress = (pathId: string) => {
    const path = LEARNING_PATHS.find(p => p.id === pathId)!;
    const done = path.lessons.filter(l => profile.completedLessons.includes(l.id)).length;
    return { done, total: path.lessons.length, pct: Math.round((done / path.lessons.length) * 100) };
  };

  const greeting = profile.streak >= 3
    ? `${profile.streak}-day streak — keep it going.`
    : profile.streak > 0
    ? `Day ${profile.streak} streak. Build the habit.`
    : `Ready to learn, ${profile.name}?`;

  return (
    <div className="space-y-0 pt-4">

      {/* ── HERO: Avatar + greeting ── */}
      <div className="border border-border p-6 flex items-start gap-6 bg-card">
        <div className="shrink-0">
          <AvatarViz
            appearance={profile.avatar.appearance as Avatar["appearance"]}
            size={96}
          />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="label-mono mb-1">{levelName} · Level {level}</div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight leading-tight">
            {profile.avatar.name}
          </h2>
          <p className="font-mono text-xs text-muted-foreground mt-1.5 leading-relaxed">
            {greeting}
          </p>
          {/* XP bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">{profile.xp.toLocaleString()} XP</span>
              <span className="font-mono text-[10px] text-muted-foreground">{toNext.toLocaleString()} → Lv.{level + 1}</span>
            </div>
            <div className="h-[2px] bg-border overflow-hidden">
              <div
                className="h-full bg-foreground xp-bar-fill transition-all duration-1000"
                style={{ "--xp-pct": `${progress}%` } as React.CSSProperties}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── BIG STATS — x402 style ── */}
      <div className="border-x border-b border-border grid grid-cols-4 divide-x divide-border">
        {[
          { value: profile.xp.toLocaleString(),          label: "Total XP" },
          { value: `${profile.streak}d`,                  label: "Streak"   },
          { value: state.todaysXpEarned || 0,             label: "Today XP" },
          { value: `${totalCompleted}/${totalLessons}`,   label: "Lessons"  },
        ].map((stat, i) => (
          <div key={i} className="p-4">
            <div className="font-mono text-xl font-bold text-foreground leading-none tracking-tight">
              {stat.value}
            </div>
            <div className="label-mono mt-1.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── WEEKLY ACTIVITY ── */}
      <div className="border-x border-b border-border p-5 bg-card">
        <div className="label-mono mb-4">Weekly Activity</div>
        <div className="flex items-end gap-1.5 h-14">
          {state.weeklyXp.map((xp, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full transition-all duration-700"
                style={{
                  height: `${Math.max(2, (xp / maxWeekly) * 40)}px`,
                  background: i === today ? "hsl(var(--foreground))" : "hsl(var(--border))",
                }}
              />
              <span className={`font-mono text-[9px] ${i === today ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                {DAYS[i].slice(0, 2).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SANDBOX CHALLENGE ── */}
      <div className="border-x border-b border-border bg-card mt-6">
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div>
            <div className="label-mono mb-1">Interactive Sandbox</div>
            <h3 className="text-lg font-bold text-foreground tracking-tight">
              Run → See → Change → Repeat
            </h3>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Real contracts. Visual EVM execution. {totalChallenges} challenges.
            </p>
          </div>
          <div className="text-right shrink-0 pl-4">
            <div className="font-mono text-3xl font-bold text-foreground">{totalChallenges}</div>
            <div className="label-mono">challenges</div>
          </div>
        </div>
        <div className="divide-y divide-border border-t border-border">
          {CHALLENGE_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => onNavigate(`challenge/${m.id}`)}
              className="w-full px-5 py-3.5 text-left flex items-center justify-between group hover:bg-muted transition-colors duration-150"
            >
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold tracking-widest" style={{ color: m.color }}>
                      {m.label}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {CHALLENGES_BY_MODE[m.id].length} challenges
                    </span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="font-mono text-xs font-bold text-foreground">{m.xp}</div>
                  <div className="font-mono text-[9px] text-muted-foreground">{m.solvers} solved</div>
                </div>
                <span className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3D NEURAL VOID SIMULATOR ── */}
      <div
        className="mt-6 border border-border relative overflow-hidden"
        style={{ background: "#03020a" }}
      >
        {/* Animated grid bg */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#2d1b6922 1px, transparent 1px), linear-gradient(90deg, #2d1b6922 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div
                className="font-mono text-[10px] font-bold tracking-widest uppercase mb-1"
                style={{ color: "#7c3aed" }}
              >
                3D Immersive · Neural Void Simulator
              </div>
              <h3
                className="text-lg font-bold tracking-tight leading-tight"
                style={{ color: "#e9d5ff" }}
              >
                Watch Code Execute in 3D
              </h3>
              <p
                className="font-mono text-xs mt-1.5 leading-relaxed"
                style={{ color: "#6b7280" }}
              >
                Paste Solidity or Rust — see EVM sequential flow vs Solana
                parallel lanes in a live cyberpunk simulation.
              </p>
              <div className="flex gap-3 mt-3">
                {[
                  { label: "EVM Vault", color: "#7c3aed" },
                  { label: "Logic Gates", color: "#ef4444" },
                  { label: "Sealevel", color: "#10b981" },
                  { label: "Reentrancy", color: "#f59e0b" },
                ].map((tag) => (
                  <div key={tag.label} className="flex items-center gap-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: tag.color,
                        boxShadow: `0 0 4px ${tag.color}`,
                      }}
                    />
                    <span
                      className="font-mono text-[9px] uppercase tracking-wide"
                      style={{ color: "#374151" }}
                    >
                      {tag.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Glowing orb decoration */}
            <div
              className="shrink-0 w-14 h-14 rounded-sm flex items-center justify-center text-2xl"
              style={{
                background: "#1a0a3e",
                boxShadow: "0 0 20px #7c3aed44, inset 0 0 12px #7c3aed22",
                border: "1px solid #2d1b69",
              }}
            >
              ⬡
            </div>
          </div>
          <button
            onClick={() => onNavigate("simulator")}
            className="mt-4 w-full font-mono text-sm font-bold py-2.5 border transition-all"
            style={{
              borderColor: "#7c3aed",
              background: "#7c3aed",
              color: "#fff",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "#6d28d9";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "#7c3aed";
            }}
          >
            ▶ Launch Neural Void Simulator
          </button>
        </div>
      </div>

      {/* ── LEARNING PATHS ── */}
      <div className="mt-6 space-y-0">
        <div className="flex items-center justify-between mb-3 px-0">
          <div className="label-mono">Learning Paths</div>
          <button
            onClick={() => onNavigate("paths")}
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </button>
        </div>
        <div className="border border-border divide-y divide-border">
          {relevantPaths.slice(0, 3).map(path => {
            const { done, total, pct } = getPathProgress(path.id);
            return (
              <button
                key={path.id}
                onClick={() => onNavigate(`path/${path.id}`)}
                className="w-full bg-card p-4 text-left hover:bg-muted transition-colors duration-150 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{path.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-foreground group-hover:text-foreground/80">{path.title}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">{done}/{total} lessons</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
                    <span className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">→</span>
                  </div>
                </div>
                <div className="mt-3 h-[1px] bg-border overflow-hidden">
                  <div className="h-full bg-foreground/50 transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CUSTOM TOPICS (admin-added) ── */}
      {customTopics.length > 0 && (
        <div className="mt-6 space-y-0">
          <div className="flex items-center justify-between mb-3">
            <div className="label-mono">Custom Topics</div>
            <span className="font-mono text-[10px] text-muted-foreground">{customTopics.length} added</span>
          </div>
          <div className="border border-border divide-y divide-border">
            {customTopics.map(topic => (
              <div key={topic.id} className="bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{topic.title}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5 leading-relaxed">{topic.description}</div>
                    {topic.tags && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {topic.tags.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => (
                          <span key={tag} className="font-mono text-[9px] border border-border px-1.5 py-0.5 text-muted-foreground uppercase tracking-wide">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs font-bold text-foreground">{topic.duration} min</div>
                    <div className="label-mono mt-0.5">read</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <button
        onClick={() => onNavigate("chat")}
        className="w-full mt-6 btn-arrow justify-center py-4 text-sm font-semibold"
      >
        → Talk to {profile.avatar.name}
      </button>

      <div className="h-4" />
    </div>
  );
}
