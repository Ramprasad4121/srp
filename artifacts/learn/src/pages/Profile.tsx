import type { AppState } from "@/lib/store";
import { xpToLevel } from "@/lib/store";
import { Flame, Star, BookOpen, Trophy, Zap } from "lucide-react";

const AVATAR_APPEARANCES = [
  { id: "nebula" as const, colors: "from-violet-500 to-indigo-600", symbol: "✦" },
  { id: "flame" as const, colors: "from-orange-500 to-red-600", symbol: "◈" },
  { id: "crystal" as const, colors: "from-cyan-400 to-blue-600", symbol: "◆" },
  { id: "aurora" as const, colors: "from-green-400 to-teal-500", symbol: "◉" },
];

const RANK_BADGES = [
  { minXP: 0, label: "Genesis", color: "text-gray-400" },
  { minXP: 500, label: "Explorer", color: "text-blue-400" },
  { minXP: 1500, label: "Builder", color: "text-green-400" },
  { minXP: 3000, label: "Hacker", color: "text-yellow-400" },
  { minXP: 6000, label: "Architect", color: "text-orange-400" },
  { minXP: 12000, label: "Auditor", color: "text-red-400" },
  { minXP: 25000, label: "Legend", color: "text-purple-400" },
  { minXP: 50000, label: "Ascended", color: "text-pink-400" },
];

interface Props {
  state: AppState;
  onReset: () => void;
}

export default function Profile({ state, onReset }: Props) {
  const profile = state.profile!;
  const { level, levelName, progress, toNext } = xpToLevel(profile.xp);
  const avatarApp = AVATAR_APPEARANCES.find(a => a.id === profile.avatar.appearance)!;
  const totalLessons = 19;
  const completedCount = profile.completedLessons.length;

  const currentBadge = RANK_BADGES.slice().reverse().find(b => profile.xp >= b.minXP)!;
  const nextBadge = RANK_BADGES.find(b => b.minXP > profile.xp);

  const chainLabel = profile.chain === "both" ? "Ethereum + Solana" : profile.chain.charAt(0).toUpperCase() + profile.chain.slice(1);

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarApp.colors} flex items-center justify-center text-3xl glow-primary`}>
            {avatarApp.symbol}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-serif font-bold text-foreground">{profile.name}</h2>
            <div className={`text-sm font-semibold ${currentBadge.color}`}>{currentBadge.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Level {level} · {chainLabel}</div>
          </div>
        </div>

        {/* XP bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{profile.xp.toLocaleString()} XP — {levelName}</span>
            <span>{toNext.toLocaleString()} to Lv.{level + 1}</span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: <Flame className="w-5 h-5 text-orange-400" />, value: `${profile.streak}d`, label: "Streak" },
          { icon: <Star className="w-5 h-5 text-primary" />, value: profile.xp.toLocaleString(), label: "Total XP" },
          { icon: <BookOpen className="w-5 h-5 text-green-400" />, value: `${completedCount}/${totalLessons}`, label: "Lessons" },
          { icon: <Zap className="w-5 h-5 text-accent" />, value: state.todaysXpEarned, label: "Today" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            {s.icon}
            <div>
              <div className="font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Rank ladder */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Rank Ladder
        </h3>
        <div className="space-y-2">
          {RANK_BADGES.map(badge => {
            const unlocked = profile.xp >= badge.minXP;
            const isCurrent = badge.label === currentBadge.label;
            return (
              <div
                key={badge.label}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isCurrent ? "bg-primary/10 border border-primary/30" :
                  unlocked ? "bg-secondary/50" : "opacity-40"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${unlocked ? "bg-green-400" : "bg-border"}`} />
                <div className="flex-1">
                  <span className={`font-semibold text-sm ${badge.color}`}>{badge.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{badge.minXP.toLocaleString()} XP</span>
                </div>
                {isCurrent && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Current</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Avatar info */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-3">Your Tutor</h3>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarApp.colors} flex items-center justify-center text-xl`}>
            {avatarApp.symbol}
          </div>
          <div>
            <div className="font-semibold text-foreground">{profile.avatar.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{profile.avatar.personality} teaching style</div>
            <div className="text-xs text-muted-foreground capitalize">{profile.avatar.appearance} appearance</div>
          </div>
        </div>
      </div>

      {/* Reset */}
      <button
        data-testid="button-reset"
        onClick={() => {
          if (window.confirm("Reset all progress? This cannot be undone.")) {
            onReset();
          }
        }}
        className="w-full text-sm text-destructive/70 hover:text-destructive transition-colors py-2"
      >
        Reset all progress
      </button>
    </div>
  );
}
