import type { AppState } from "@/lib/store";
import { xpToLevel } from "@/lib/store";
import { LEARNING_PATHS } from "@/lib/curriculum";
import { CHALLENGES_BY_MODE } from "@/lib/challenges";

interface Props {
  state: AppState;
  onNavigate: (path: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AVATAR_COLORS: Record<string, string> = {
  nebula: "#7c3aed", flame: "#ea580c", crystal: "#0ea5e9", aurora: "#16a34a",
};
const AVATAR_SYMBOLS: Record<string, string> = {
  nebula: "✦", flame: "◈", crystal: "◆", aurora: "◉",
};

export default function Dashboard({ state, onNavigate }: Props) {
  const profile = state.profile!;
  const { level, levelName, progress, toNext } = xpToLevel(profile.xp);
  const today = new Date().getDay();
  const maxWeekly = Math.max(...state.weeklyXp, 1);
  const avatarColor = AVATAR_COLORS[profile.avatar.appearance] ?? "#7c3aed";
  const avatarSymbol = AVATAR_SYMBOLS[profile.avatar.appearance] ?? "✦";
  const totalCompleted = profile.completedLessons.length;
  const totalLessons = LEARNING_PATHS.reduce((acc, p) => acc + p.lessons.length, 0);

  const relevantPaths = LEARNING_PATHS.filter(p =>
    profile.chain === "both" ? true : p.chain === profile.chain || p.chain === "both"
  );

  const getPathProgress = (pathId: string) => {
    const path = LEARNING_PATHS.find(p => p.id === pathId)!;
    const done = path.lessons.filter(l => profile.completedLessons.includes(l.id)).length;
    return { done, total: path.lessons.length, pct: Math.round((done / path.lessons.length) * 100) };
  };

  const greeting = profile.streak > 0
    ? `${profile.streak}-day streak. Keep it going.`
    : `Welcome back, ${profile.name}.`;

  const totalChallenges = Object.values(CHALLENGES_BY_MODE).reduce((a, c) => a + c.length, 0);

  const CHALLENGE_MODES = [
    {
      id: "beginner" as const,
      label: "BEGINNER",
      desc: "Fill blanks, watch contracts run",
      color: "#22c55e",
      xp: "100–150 XP",
      count: CHALLENGES_BY_MODE.beginner.length,
      solvers: "2,847",
    },
    {
      id: "builder" as const,
      label: "BUILDER",
      desc: "Implement DeFi primitives live",
      color: "#3b82f6",
      xp: "300–400 XP",
      count: CHALLENGES_BY_MODE.builder.length,
      solvers: "521",
    },
    {
      id: "auditor" as const,
      label: "AUDITOR",
      desc: "Find bugs, exploit contracts",
      color: "#ef4444",
      xp: "500–600 XP",
      count: CHALLENGES_BY_MODE.auditor.length,
      solvers: "189",
    },
  ];

  return (
    <div className="space-y-6 pt-4">
      {/* ── Challenge Entry — hero section ── */}
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <div className="label-mono mb-1">Interactive Sandbox</div>
            <h2 className="text-lg font-bold text-foreground leading-tight">
              Run → See → Change → Repeat
            </h2>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Real smart contracts. Visual execution. {totalChallenges} challenges.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-2xl font-bold">{totalChallenges}</div>
            <div className="label-mono">challenges</div>
          </div>
        </div>
        <div className="divide-y divide-border border-t border-border mt-1">
          {CHALLENGE_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => onNavigate(`challenge/${m.id}`)}
              className="w-full px-4 py-3 text-left flex items-center justify-between group hover:bg-muted transition-colors duration-150"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 shrink-0"
                  style={{ background: m.color }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold tracking-widest" style={{ color: m.color }}>
                      {m.label}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {m.count} challenges
                    </span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
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

      {/* Avatar greeting strip */}
      <div className="border border-border p-5 flex items-start gap-4 bg-card">
        <div
          className="w-11 h-11 flex items-center justify-center text-xl font-bold shrink-0"
          style={{ background: avatarColor, color: "#fff" }}
        >
          {avatarSymbol}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-foreground text-sm">{profile.avatar.name}</span>
            <span className="font-mono text-xs text-muted-foreground">Lv.{level} — {levelName}</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">{greeting}</p>
          {/* XP progress */}
          <div className="mt-3 space-y-1">
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">{profile.xp.toLocaleString()} XP</span>
              <span className="font-mono text-[10px] text-muted-foreground">{toNext.toLocaleString()} to Lv.{level + 1}</span>
            </div>
            <div className="h-px bg-border overflow-hidden">
              <div
                className="h-full bg-foreground xp-bar-fill"
                style={{ "--xp-pct": `${progress}%` } as React.CSSProperties}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Big stats — x402 style */}
      <div className="border border-border divide-x divide-border flex">
        {[
          { value: profile.xp.toLocaleString(),     label: "Total XP" },
          { value: profile.streak,                   label: "Day Streak" },
          { value: state.todaysXpEarned,             label: "Today XP" },
          { value: `${totalCompleted}/${totalLessons}`, label: "Lessons" },
        ].map((stat, i) => (
          <div key={i} className="flex-1 p-4">
            <div className="font-mono text-xl font-bold text-foreground leading-none">{stat.value}</div>
            <div className="label-mono mt-1.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly activity */}
      <div className="border border-border p-4 bg-card">
        <div className="label-mono mb-4">Weekly Activity</div>
        <div className="flex items-end gap-1.5 h-16">
          {state.weeklyXp.map((xp, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full transition-all duration-700"
                style={{
                  height: `${Math.max(2, (xp / maxWeekly) * 48)}px`,
                  background: i === today ? "hsl(var(--foreground))" : "hsl(var(--border))",
                }}
              />
              <span className={`font-mono text-[9px] ${i === today ? "text-foreground" : "text-muted-foreground"}`}>
                {DAYS[i].slice(0, 2).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Learning paths */}
      <div className="space-y-0">
        <div className="flex items-center justify-between mb-3">
          <div className="label-mono">Learning Paths</div>
          <button
            data-testid="link-all-paths"
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
                data-testid={`path-card-${path.id}`}
                onClick={() => onNavigate(`path/${path.id}`)}
                className="w-full bg-card p-4 text-left hover:bg-muted transition-colors duration-150 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg">{path.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-foreground group-hover:text-foreground/80">{path.title}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">{done}/{total} lessons</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-muted-foreground">{pct}%</div>
                    <div className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">→</div>
                  </div>
                </div>
                {/* thin progress bar */}
                <div className="mt-3 h-px bg-border overflow-hidden">
                  <div
                    className="h-full bg-foreground/60 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <button
        data-testid="button-start-learning"
        onClick={() => onNavigate("chat")}
        className="w-full bg-foreground text-background font-mono text-sm font-semibold py-4 hover:opacity-85 transition-opacity flex items-center justify-center gap-2"
      >
        → Talk to {profile.avatar.name}
      </button>
    </div>
  );
}
