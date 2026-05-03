import { useLink } from "wouter";
import type { AppState } from "@/lib/store";
import { xpToLevel } from "@/lib/store";
import { LEARNING_PATHS } from "@/lib/curriculum";
import { Flame, Star, Zap, ChevronRight, Trophy, BookOpen } from "lucide-react";

interface Props {
  state: AppState;
  onNavigate: (path: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Dashboard({ state, onNavigate }: Props) {
  const profile = state.profile!;
  const { level, levelName, progress, toNext } = xpToLevel(profile.xp);
  const today = new Date().getDay();
  const maxWeekly = Math.max(...state.weeklyXp, 1);
  const selectedApp = AVATAR_APPEARANCES.find(a => a.id === profile.avatar.appearance)!;
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

  return (
    <div className="space-y-6">
      {/* Hero stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: <Star className="w-4 h-4 text-primary" />,
            value: profile.xp.toLocaleString(),
            label: "Total XP",
            sub: `${levelName}`,
          },
          {
            icon: <Flame className="w-4 h-4 text-orange-400 flame-icon" />,
            value: profile.streak,
            label: "Day Streak",
            sub: profile.streak > 0 ? "Keep it going!" : "Start today",
          },
          {
            icon: <Zap className="w-4 h-4 text-accent" />,
            value: state.todaysXpEarned,
            label: "Today's XP",
            sub: `Goal: ${profile.hoursPerDay * 100} XP`,
          },
          {
            icon: <BookOpen className="w-4 h-4 text-green-400" />,
            value: totalCompleted,
            label: "Lessons Done",
            sub: `of ${totalLessons} total`,
          },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              {stat.icon}
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-foreground font-serif">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Avatar greeting + XP bar */}
      <div className="bg-card border border-border rounded-2xl p-5 flex gap-4 items-start">
        <div className={`w-14 h-14 shrink-0 rounded-full bg-gradient-to-br ${selectedApp.colors} flex items-center justify-center text-2xl glow-primary`}>
          {selectedApp.symbol}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-foreground">{profile.avatar.name}</span>
            <span className="text-xs text-muted-foreground">Lv.{level} — {levelName}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {profile.streak > 0
              ? `Great momentum, ${profile.name}! ${profile.streak} days strong. Let's make today count.`
              : `Welcome back, ${profile.name}! Ready to continue your web3 journey?`}
          </p>
          {/* XP bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{profile.xp} XP</span>
              <span>{toNext} XP to Lv.{level + 1}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out xp-bar-fill"
                style={{ "--xp-pct": `${progress}%` } as React.CSSProperties}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Weekly activity */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Weekly Activity
        </h3>
        <div className="flex items-end gap-2 h-20">
          {state.weeklyXp.map((xp, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-sm transition-all duration-700 ${
                  i === today ? "bg-primary glow-primary" : "bg-secondary"
                }`}
                style={{ height: `${Math.max(4, (xp / maxWeekly) * 60)}px` }}
              />
              <span className={`text-xs ${i === today ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                {DAYS[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Learning paths */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Your Learning Paths</h3>
          <button
            data-testid="link-all-paths"
            onClick={() => onNavigate("paths")}
            className="text-xs text-primary hover:underline"
          >
            View all
          </button>
        </div>
        <div className="space-y-3">
          {relevantPaths.slice(0, 3).map(path => {
            const { done, total, pct } = getPathProgress(path.id);
            return (
              <button
                key={path.id}
                data-testid={`path-card-${path.id}`}
                onClick={() => onNavigate(`path/${path.id}`)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-lg bg-gradient-to-br ${path.color} flex items-center justify-center text-lg font-bold text-white`}>
                      {path.icon}
                    </span>
                    <div>
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{path.title}</div>
                      <div className="text-xs text-muted-foreground">{path.level} · {total} lessons</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{done}/{total} lessons</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${path.color} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick start button */}
      <button
        data-testid="button-start-learning"
        onClick={() => onNavigate("chat")}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl transition-all duration-200 glow-primary text-lg"
      >
        Talk to {profile.avatar.name}
      </button>
    </div>
  );
}

const AVATAR_APPEARANCES = [
  { id: "nebula" as const, colors: "from-violet-500 to-indigo-600", symbol: "✦" },
  { id: "flame" as const, colors: "from-orange-500 to-red-600", symbol: "◈" },
  { id: "crystal" as const, colors: "from-cyan-400 to-blue-600", symbol: "◆" },
  { id: "aurora" as const, colors: "from-green-400 to-teal-500", symbol: "◉" },
];
