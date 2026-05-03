import type { AppState } from "@/lib/store";
import { xpToLevel } from "@/lib/store";
import AvatarViz from "@/components/AvatarViz";
import type { Avatar } from "@/lib/store";

const AVATAR_COLORS: Record<string, string> = {
  nebula: "#7c3aed", flame: "#ea580c", crystal: "#0ea5e9", aurora: "#16a34a",
};

const RANKS = [
  { minXP: 0,      label: "Genesis",   tag: "GEN" },
  { minXP: 500,    label: "Explorer",  tag: "EXP" },
  { minXP: 1500,   label: "Builder",   tag: "BLD" },
  { minXP: 3000,   label: "Hacker",    tag: "HCK" },
  { minXP: 6000,   label: "Architect", tag: "ARC" },
  { minXP: 12000,  label: "Auditor",   tag: "AUD" },
  { minXP: 25000,  label: "Legend",    tag: "LGD" },
  { minXP: 50000,  label: "Ascended",  tag: "ASC" },
];

interface Props {
  state: AppState;
  onReset: () => void;
  onNavigate: (route: string) => void;
}

export default function Profile({ state, onReset, onNavigate }: Props) {
  const profile = state.profile!;
  const { level, levelName, progress, toNext } = xpToLevel(profile.xp);
  const avatarColor = AVATAR_COLORS[profile.avatar.appearance] ?? "#7c3aed";
  const totalLessons = 19;
  const completedCount = profile.completedLessons.length;
  const chainLabel = profile.chain === "both" ? "ETH + Solana" : profile.chain.charAt(0).toUpperCase() + profile.chain.slice(1);
  const currentRank = RANKS.slice().reverse().find(r => profile.xp >= r.minXP)!;
  const nextRank = RANKS.find(r => r.minXP > profile.xp);

  return (
    <div className="space-y-6 pt-4">

      {/* Identity card with big avatar */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-start gap-5">
          <AvatarViz
            appearance={profile.avatar.appearance as Avatar["appearance"]}
            size={80}
            className="shrink-0"
          />
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">{profile.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="font-mono text-[10px] border px-1.5 py-0.5 uppercase tracking-widest"
                style={{ borderColor: avatarColor, color: avatarColor }}
              >
                {currentRank.tag}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{currentRank.label}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
              Level {level} · {chainLabel}
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between">
            <span className="font-mono text-xs text-muted-foreground">{profile.xp.toLocaleString()} XP — {levelName}</span>
            <span className="font-mono text-xs text-muted-foreground">{toNext.toLocaleString()} to Lv.{level + 1}</span>
          </div>
          <div className="h-[2px] bg-border overflow-hidden">
            <div className="h-full bg-foreground transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Stats — x402 style */}
      <div className="border border-border grid grid-cols-4 divide-x divide-border">
        {[
          { value: profile.xp.toLocaleString(),          label: "Total XP" },
          { value: `${profile.streak}d`,                  label: "Streak"   },
          { value: `${completedCount}/${totalLessons}`,   label: "Lessons"  },
          { value: state.todaysXpEarned || 0,             label: "Today"    },
        ].map((s, i) => (
          <div key={i} className="p-4">
            <div className="font-mono text-xl font-bold text-foreground leading-none">{s.value}</div>
            <div className="label-mono mt-1.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tutor info */}
      <div className="border border-border bg-card p-5">
        <div className="label-mono mb-3">Your AI Tutor</div>
        <div className="flex items-center gap-4">
          <AvatarViz
            appearance={profile.avatar.appearance as Avatar["appearance"]}
            size={48}
            className="shrink-0"
          />
          <div>
            <div className="font-semibold text-sm text-foreground">{profile.avatar.name}</div>
            <div className="font-mono text-xs text-muted-foreground capitalize mt-0.5">
              {profile.avatar.personality} style
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5 capitalize">
              {profile.avatar.appearance} avatar
            </div>
          </div>
        </div>
      </div>

      {/* Rank ladder */}
      <div className="border border-border bg-card p-5">
        <div className="label-mono mb-4">Rank Ladder</div>
        <div className="divide-y divide-border">
          {RANKS.map(rank => {
            const unlocked  = profile.xp >= rank.minXP;
            const isCurrent = rank.label === currentRank.label;
            return (
              <div
                key={rank.label}
                className={`flex items-center gap-3 py-2.5 transition-opacity ${
                  isCurrent ? "opacity-100" : unlocked ? "opacity-60" : "opacity-20"
                }`}
              >
                <span className={`font-mono text-[10px] border px-1.5 py-0.5 uppercase tracking-widest ${
                  isCurrent ? "border-foreground text-foreground" : "border-border text-muted-foreground"
                }`}>
                  {rank.tag}
                </span>
                <span className="font-semibold text-xs text-foreground flex-1">{rank.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{rank.minXP.toLocaleString()} XP</span>
                {isCurrent && <span className="font-mono text-[10px] text-green-600">← you</span>}
                {unlocked && !isCurrent && <span className="font-mono text-[10px] text-green-600">✓</span>}
              </div>
            );
          })}
        </div>
        {nextRank && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="font-mono text-xs text-muted-foreground">
              {(nextRank.minXP - profile.xp).toLocaleString()} XP to unlock {nextRank.label}
            </span>
          </div>
        )}
      </div>

      {/* Reset */}
      <button
        data-testid="button-reset"
        onClick={() => { if (window.confirm("Reset all progress? This cannot be undone.")) onReset(); }}
        className="w-full font-mono text-xs text-muted-foreground hover:text-destructive transition-colors py-3 border border-border hover:border-destructive/30"
      >
        Reset all progress
      </button>

      {/* Admin access — subtle */}
      <div className="flex justify-center pt-2 pb-1">
        <button
          onClick={() => onNavigate("admin")}
          className="font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors tracking-widest uppercase"
        >
          Admin Panel
        </button>
      </div>
    </div>
  );
}
