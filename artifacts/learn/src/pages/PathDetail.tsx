import { ArrowLeft, Clock } from "lucide-react";
import type { AppState } from "@/lib/store";
import { getPathById } from "@/lib/curriculum";

interface Props {
  pathId: string;
  state: AppState;
  onBack: () => void;
  onLesson: (lessonId: string) => void;
}

export default function PathDetail({ pathId, state, onBack, onLesson }: Props) {
  const path = getPathById(pathId);
  if (!path) return (
    <div className="pt-8 text-center">
      <p className="font-mono text-xs text-muted-foreground">Path not found.</p>
    </div>
  );

  const profile = state.profile!;
  const completed = path.lessons.filter(l => profile.completedLessons.includes(l.id)).length;
  const pct = Math.round((completed / path.lessons.length) * 100);

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button data-testid="button-back-path" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-mono text-xl">{path.icon}</span>
        <div>
          <h2 className="font-bold text-foreground">{path.title}</h2>
          <div className="font-mono text-xs text-muted-foreground mt-0.5 uppercase tracking-widest">
            {path.level} · {path.lessons.length} lessons · {path.totalXP} XP
          </div>
        </div>
      </div>

      {/* Progress card */}
      <div className="border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="label-mono">Progress</div>
          <div className="font-mono text-sm font-bold text-foreground">{pct}%</div>
        </div>
        <div className="h-px bg-border overflow-hidden">
          <div
            className="h-full bg-foreground transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{completed} of {path.lessons.length} lessons complete</span>
          {completed === path.lessons.length && (
            <span className="font-mono text-[10px] text-accent uppercase tracking-widest">✓ Complete</span>
          )}
        </div>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">{path.description}</p>
      </div>

      {/* Lesson list */}
      <div>
        <div className="label-mono mb-3">Lessons</div>
        <div className="border border-border divide-y divide-border">
          {path.lessons.map((lesson, idx) => {
            const done       = profile.completedLessons.includes(lesson.id);
            const prevDone   = idx === 0 || profile.completedLessons.includes(path.lessons[idx - 1].id);
            const accessible = prevDone || done;

            return (
              <button
                key={lesson.id}
                data-testid={`lesson-${lesson.id}`}
                onClick={() => accessible && onLesson(lesson.id)}
                disabled={!accessible}
                className={`w-full bg-card p-4 text-left transition-colors duration-150 flex items-start gap-4 group ${
                  accessible && !done ? "hover:bg-muted cursor-pointer" :
                  done ? "cursor-pointer" :
                  "opacity-35 cursor-not-allowed"
                }`}
              >
                {/* Status indicator */}
                <div className="shrink-0 mt-0.5 w-5 text-center">
                  {done
                    ? <span className="font-mono text-xs text-accent">✓</span>
                    : accessible
                    ? <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">○</span>
                    : <span className="font-mono text-xs text-border">—</span>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`font-medium text-sm ${done ? "text-foreground" : accessible ? "text-foreground" : "text-muted-foreground"}`}>
                      <span className="font-mono text-muted-foreground mr-2">{String(idx + 1).padStart(2, "0")}.</span>
                      {lesson.title}
                    </h4>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-1 line-clamp-1">{lesson.description}</p>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5" /> {lesson.duration}m
                    </span>
                    <span className="font-mono text-[10px] text-accent">+{lesson.xpReward} XP</span>
                    {lesson.tags.slice(0, 2).map(t => (
                      <span key={t} className="font-mono text-[10px] border border-border px-1.5 py-px text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>

                {accessible && !done && (
                  <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5">→</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
