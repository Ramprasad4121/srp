import type { AppState } from "@/lib/store";
import { xpToLevel } from "@/lib/store";

const AVATAR_COLORS: Record<string, string> = {
  nebula: "#7c3aed", flame: "#ea580c", crystal: "#0ea5e9", aurora: "#16a34a",
};
const AVATAR_SYMBOLS: Record<string, string> = {
  nebula: "✦", flame: "◈", crystal: "◆", aurora: "◉",
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
}

export default function Profile({ state, onReset }: Props) {
  const profile     = state.profile!;
  const { level, levelName, progress, toNext } = xpToLevel(profile.xp);
  const avatarColor  = AVATAR_COLORS[profile.avatar.appearance]  ?? "#7c3aed";
  const avatarSymbol = AVATAR_SYMBOLS[profile.avatar.appearance] ?? "✦";
  const totalLessons = 19;
  const completedCount = profile.completedLessons.length;
  const chainLabel   = profile.chain === "both" ? "ETH + Solana" : profile.chain.charAt(0).toUpperCase() + profile.chain.slice(1);

<<<<<<< HEAD
  const currentRank  = RANKS.slice().reverse().find(r => profile.xp >= r.minXP)!;
  const nextRank     = RANKS.find(r => r.minXP > profile.xp);
=======
  const currentBadge = RANK_BADGES.slice().reverse().find(b => profile.xp >= b.minXP)!;

  const chainLabel = profile.chain === "both" ? "Ethereum + Solana" : profile.chain.charAt(0).toUpperCase() + profile.chain.slice(1);
>>>>>>> 5b30ea217fbf44279a12ee58f333dba99cc658e7

  return (
    <div className="space-y-6 pt-4">
      {/* Identity card */}
      <div className="border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 flex items-center justify-center text-2xl font-bold shrink-0"
            style={{ background: avatarColor, color: "#fff" }}
          >
            {avatarSymbol}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">{profile.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs border border-border px-1.5 py-px text-muted-foreground uppercase tracking-widest">
                {currentRank.tag}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{currentRank.label}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
              Level {level} · {chainLabel}
            </div>
          </div>
        </div>

        {/* XP progress */}
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between">
            <span className="font-mono text-xs text-muted-foreground">{profile.xp.toLocaleString()} XP — {levelName}</span>
            <span className="font-mono text-xs text-muted-foreground">{toNext.toLocaleString()} to Lv.{level + 1}</span>
          </div>
          <div className="h-px bg-border overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Big stats — x402 style */}
      <div className="border border-border divide-x divide-border flex">
        {[
          { value: profile.xp.toLocaleString(), label: "Total XP" },
          { value: `${profile.streak}d`,         label: "Streak" },
          { value: `${completedCount}/${totalLessons}`, label: "Lessons" },
          { value: state.todaysXpEarned,          label: "Today" },
        ].map((s, i) => (
          <div key={i} className="flex-1 p-4">
            <div className="font-mono text-xl font-bold text-foreground leading-none">{s.value}</div>
            <div className="label-mono mt-1.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tutor info */}
      <div className="border border-border bg-card p-4">
        <div className="label-mono mb-3">Your Tutor</div>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: avatarColor, color: "#fff" }}
          >
            {avatarSymbol}
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">{profile.avatar.name}</div>
            <div className="font-mono text-xs text-muted-foreground capitalize mt-0.5">
              {profile.avatar.personality} style · {profile.avatar.appearance}
            </div>
          </div>
        </div>
      </div>

      {/* Rank ladder */}
      <div className="border border-border bg-card p-4">
        <div className="label-mono mb-3">Rank Ladder</div>
        <div className="divide-y divide-border">
          {RANKS.map(rank => {
            const unlocked  = profile.xp >= rank.minXP;
            const isCurrent = rank.label === currentRank.label;
            return (
              <div
                key={rank.label}
                className={`flex items-center gap-3 py-2.5 ${isCurrent ? "opacity-100" : unlocked ? "opacity-70" : "opacity-25"}`}
              >
                <span className={`font-mono text-[10px] border px-1.5 py-px uppercase tracking-widest ${
                  isCurrent ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground"
                }`}>
                  {rank.tag}
                </span>
                <span className="font-semibold text-xs text-foreground flex-1">{rank.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{rank.minXP.toLocaleString()} XP</span>
                {isCurrent && (
                  <span className="font-mono text-[10px] text-accent uppercase">← you</span>
                )}
                {unlocked && !isCurrent && (
                  <span className="font-mono text-[10px] text-accent">✓</span>
                )}
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
    </div>
  );
}
