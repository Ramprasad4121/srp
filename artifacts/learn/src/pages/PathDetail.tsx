import { ArrowLeft, CheckCircle2, Circle, Clock, Zap } from "lucide-react";
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
  if (!path) return <div className="text-muted-foreground p-8 text-center">Path not found</div>;

  const profile = state.profile!;
  const completed = path.lessons.filter(l => profile.completedLessons.includes(l.id)).length;
  const pct = Math.round((completed / path.lessons.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button data-testid="button-back-path" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${path.color} flex items-center justify-center text-2xl text-white font-bold`}>
          {path.icon}
        </div>
        <div>
          <h2 className="text-xl font-serif font-bold text-foreground">{path.title}</h2>
          <p className="text-xs text-muted-foreground">{path.level} · {path.lessons.length} lessons · {path.totalXP} XP</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-foreground font-medium">{completed}/{path.lessons.length} lessons complete</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${path.color} rounded-full transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{path.description}</p>
      </div>

      {/* Lesson list */}
      <div className="space-y-2">
        {path.lessons.map((lesson, idx) => {
          const done = profile.completedLessons.includes(lesson.id);
          const prevDone = idx === 0 || profile.completedLessons.includes(path.lessons[idx - 1].id);
          const accessible = prevDone || done;

          return (
            <button
              key={lesson.id}
              data-testid={`lesson-${lesson.id}`}
              onClick={() => accessible && onLesson(lesson.id)}
              disabled={!accessible}
              className={`w-full bg-card border rounded-xl p-4 text-left transition-all duration-200 group flex items-center gap-4 ${
                done
                  ? "border-green-500/40 bg-green-500/5"
                  : accessible
                  ? "border-border hover:border-primary/60 cursor-pointer"
                  : "border-border/40 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="shrink-0">
                {done ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                ) : (
                  <Circle className={`w-6 h-6 ${accessible ? "text-muted-foreground group-hover:text-primary" : "text-border"} transition-colors`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`font-semibold text-sm ${done ? "text-foreground" : accessible ? "text-foreground group-hover:text-primary transition-colors" : "text-muted-foreground"}`}>
                    {idx + 1}. {lesson.title}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{lesson.description}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> {lesson.duration} min
                  </span>
                  <span className="flex items-center gap-1 text-xs text-accent">
                    <Zap className="w-3 h-3" /> {lesson.xpReward} XP
                  </span>
                  <div className="flex gap-1">
                    {lesson.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-xs px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
