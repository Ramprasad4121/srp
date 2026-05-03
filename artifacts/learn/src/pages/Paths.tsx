import type { AppState } from "@/lib/store";
import { LEARNING_PATHS } from "@/lib/curriculum";

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

  const isAccessible = (path: typeof LEARNING_PATHS[0]) => {
    if (path.level === "beginner") return true;
    if (path.level === "intermediate") return profile.xp >= 500;
    return profile.xp >= 1500;
  };

  const filtered = LEARNING_PATHS.filter(p =>
    profile.chain === "both" ? true : p.chain === profile.chain || p.chain === "both"
  );

  return (
    <div className="space-y-6 pt-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Learning Paths</h2>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Structured journeys from zero to web3 builder.
        </p>
      </div>

      {/* Stats strip */}
      <div className="border border-border divide-x divide-border flex">
        <div className="flex-1 p-3">
          <div className="font-mono text-lg font-bold text-foreground">{filtered.length}</div>
          <div className="label-mono mt-1">Paths</div>
        </div>
        <div className="flex-1 p-3">
          <div className="font-mono text-lg font-bold text-foreground">
            {filtered.reduce((acc, p) => acc + p.lessons.length, 0)}
          </div>
          <div className="label-mono mt-1">Lessons</div>
        </div>
        <div className="flex-1 p-3">
          <div className="font-mono text-lg font-bold text-foreground">
            {filtered.reduce((acc, p) => acc + p.totalXP, 0).toLocaleString()}
          </div>
          <div className="label-mono mt-1">Total XP</div>
        </div>
      </div>

      {/* Path list */}
      <div className="border border-border divide-y divide-border">
        {filtered.map(path => {
          const { done, total, pct } = getPathProgress(path.id);
          const accessible = isAccessible(path);
          const xpNeeded = path.level === "intermediate" ? 500 : 1500;

          return (
            <button
              key={path.id}
              data-testid={`path-${path.id}`}
              onClick={() => accessible && onNavigate(`path/${path.id}`)}
              disabled={!accessible}
              className={`w-full bg-card p-5 text-left transition-colors duration-150 ${
                accessible ? "hover:bg-muted cursor-pointer group" : "opacity-40 cursor-not-allowed"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <span className="font-mono text-2xl shrink-0 mt-0.5">{path.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{path.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 border ${
                          path.level === "beginner"     ? "border-accent/40 text-accent" :
                          path.level === "intermediate" ? "border-amber-500/40 text-amber-400" :
                                                          "border-destructive/40 text-destructive"
                        }`}>
                          {path.level}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{path.totalXP} XP · {total} lessons</span>
                      </div>
                    </div>
                    {accessible
                      ? <span className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors shrink-0">→</span>
                      : <span className="font-mono text-[10px] text-muted-foreground shrink-0">[ LOCKED ]</span>
                    }
                  </div>

                  <p className="font-mono text-xs text-muted-foreground mt-2 leading-relaxed">{path.description}</p>

                  {accessible ? (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-mono text-[10px] text-muted-foreground">{done}/{total} complete</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-px bg-border overflow-hidden">
                        <div
                          className="h-full bg-foreground/60 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="font-mono text-[10px] text-muted-foreground mt-2">
                      Requires {xpNeeded.toLocaleString()} XP — you have {profile.xp.toLocaleString()}
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
