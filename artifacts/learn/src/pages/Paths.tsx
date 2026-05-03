import type { AppState } from "@/lib/store";
import { LEARNING_PATHS } from "@/lib/curriculum";
import { ChevronRight, Lock } from "lucide-react";

interface Props {
  state: AppState;
  onNavigate: (path: string) => void;
}

export default function Paths({ state, onNavigate }: Props) {
  const profile = state.profile!;

  const getPathProgress = (pathId: string) => {
    const path = LEARNING_PATHS.find(p => p.id === pathId)!;
    const done = path.lessons.filter(l => profile.completedLessons.includes(l.id)).length;
    return { done, total: path.lessons.length, pct: Math.round((done / path.lessons.length) * 100) };
  };

  const isPathAccessible = (path: typeof LEARNING_PATHS[0]) => {
    if (path.level === "beginner") return true;
    if (path.level === "intermediate") return profile.xp >= 500;
    return profile.xp >= 1500;
  };

  const chainFilter = profile.chain;

  const filtered = LEARNING_PATHS.filter(p =>
    chainFilter === "both" ? true : p.chain === chainFilter || p.chain === "both"
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-foreground">Learning Paths</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Structured journeys from zero to web3 builder. Complete lessons to unlock the next path.
        </p>
      </div>

      <div className="space-y-4">
        {filtered.map(path => {
          const { done, total, pct } = getPathProgress(path.id);
          const accessible = isPathAccessible(path);

          return (
            <button
              key={path.id}
              data-testid={`path-${path.id}`}
              onClick={() => accessible && onNavigate(`path/${path.id}`)}
              disabled={!accessible}
              className={`w-full rounded-2xl border p-5 text-left transition-all duration-200 group ${
                accessible
                  ? "bg-card border-border hover:border-primary/60 hover:shadow-sm cursor-pointer"
                  : "bg-card/50 border-border/50 cursor-not-allowed opacity-60"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 shrink-0 rounded-xl bg-gradient-to-br ${path.color} flex items-center justify-center text-2xl font-bold text-white`}>
                  {path.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className={`font-bold text-foreground group-hover:text-primary transition-colors ${accessible ? "" : "opacity-60"}`}>
                        {path.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          path.level === "beginner" ? "bg-green-500/20 text-green-400" :
                          path.level === "intermediate" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {path.level}
                        </span>
                        <span className="text-xs text-muted-foreground">{path.totalXP} XP · {total} lessons</span>
                      </div>
                    </div>
                    {!accessible ? (
                      <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mt-2">{path.description}</p>

                  {accessible && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{done}/{total} lessons complete</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${path.color} rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {!accessible && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Requires {path.level === "intermediate" ? "500" : "1,500"} XP to unlock
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
