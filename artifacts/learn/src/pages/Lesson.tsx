import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
<<<<<<< HEAD
import { ArrowLeft, MessageSquare } from "lucide-react";
=======
import { ArrowLeft, CheckCircle2, Zap, MessageSquare } from "lucide-react";
>>>>>>> 5b30ea217fbf44279a12ee58f333dba99cc658e7
import type { AppState } from "@/lib/store";
import { addXP } from "@/lib/store";
import { getLessonById } from "@/lib/curriculum";

interface Props {
  lessonId: string;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onBack: () => void;
  onChat: (context?: string) => void;
}

type Phase = "reading" | "quiz" | "complete";

export default function Lesson({ lessonId, state, onStateChange, onBack, onChat }: Props) {
  const found = getLessonById(lessonId);
  if (!found) return (
    <div className="pt-8 text-center">
      <p className="font-mono text-xs text-muted-foreground">Lesson not found.</p>
    </div>
  );

  const { lesson, path } = found;
  const profile     = state.profile!;
  const alreadyDone = profile.completedLessons.includes(lessonId);

  const [phase, setPhase]     = useState<Phase>(alreadyDone ? "complete" : "reading");
  const [quizIdx, setQuizIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect]   = useState(0);
  const [xpGained, setXpGained] = useState(0);

  const currentQ = lesson.quiz[quizIdx];
  const totalQ   = lesson.quiz.length;

  const handleAnswer = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === currentQ.correct) setCorrect(c => c + 1);
  };

  const handleNext = () => {
    if (quizIdx < totalQ - 1) {
      setQuizIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      finishLesson();
    }
  };

  const finishLesson = () => {
    if (alreadyDone) { setPhase("complete"); return; }
    const score    = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 100;
    const bonusXP  = score === 100 ? Math.floor(lesson.xpReward * 0.2) : 0;
    const earned   = lesson.xpReward + bonusXP;
    setXpGained(earned);
    const updated  = addXP({
      ...state,
      profile: { ...profile, completedLessons: [...profile.completedLessons, lessonId] },
    }, earned);
    onStateChange(updated);
    setPhase("complete");
  };

  const formatContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang  = lines[0];
        const code  = lines.slice(1).join("\n");
        return (
          <div key={i} className="my-4 border border-border overflow-hidden">
            {lang && (
              <div className="bg-muted border-b border-border px-4 py-1.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{lang}</span>
              </div>
            )}
            <pre className="bg-card p-4 overflow-x-auto font-mono text-xs text-foreground leading-relaxed">{code}</pre>
          </div>
        );
      }
      const paragraphs = part.split("\n\n");
      return paragraphs.map((para, j) => {
        if (para.startsWith("**") && para.endsWith("**") && !para.slice(2, -2).includes("**")) {
          return (
            <h3 key={`${i}-${j}`} className="font-bold text-foreground text-sm mt-5 mb-2 uppercase tracking-wide">
              {para.slice(2, -2)}
            </h3>
          );
        }
        if (para.startsWith("- ") || para.split("\n").every(l => l.startsWith("- "))) {
          return (
            <ul key={`${i}-${j}`} className="my-3 space-y-1.5">
              {para.split("\n").map((line, k) => (
                <li key={k} className="flex gap-2 font-mono text-xs text-muted-foreground">
                  <span className="text-foreground/40 shrink-0">→</span>
                  <span>{line.replace(/^- /, "").split(/(\*\*[^*]+\*\*)/).map((s, l) =>
                    s.startsWith("**") ? <strong key={l} className="text-foreground">{s.slice(2, -2)}</strong> : s
                  )}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`${i}-${j}`} className="text-sm text-muted-foreground leading-relaxed my-2">
            {para.split(/(\*\*[^*]+\*\*)/).map((s, k) =>
              s.startsWith("**") ? <strong key={k} className="text-foreground font-semibold">{s.slice(2, -2)}</strong> : s
            )}
          </p>
        );
      });
    });
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button data-testid="button-back-lesson" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-[10px] border border-border px-1.5 py-px text-muted-foreground uppercase tracking-widest">
              {path.icon} {path.title}
            </span>
          </div>
          <h2 className="font-bold text-foreground text-sm leading-tight">{lesson.title}</h2>
        </div>
        <div className="font-mono text-xs text-accent shrink-0">+{lesson.xpReward} XP</div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Reading ── */}
        {phase === "reading" && (
          <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="border border-border bg-card p-5 space-y-1">
              {formatContent(lesson.content)}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                data-testid="button-ask-avatar"
                onClick={() => onChat(`Explain this lesson: "${lesson.title}"\n\n${lesson.content.slice(0, 500)}`)}
                className="flex-1 border border-border bg-card text-foreground font-mono text-xs py-3 flex items-center justify-center gap-2 hover:border-foreground/20 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                Ask Tutor
              </button>
              <button
                data-testid="button-take-quiz"
                onClick={() => totalQ > 0 ? setPhase("quiz") : finishLesson()}
                className="flex-1 bg-foreground text-background font-mono text-xs font-semibold py-3 flex items-center justify-center gap-2 hover:opacity-85 transition-opacity"
              >
                {totalQ > 0 ? "Take Quiz →" : "Complete →"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Quiz ── */}
        {phase === "quiz" && (
          <motion.div key="quiz" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <div className="border border-border bg-card p-5 space-y-5">
              {/* Progress */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Question {quizIdx + 1} / {totalQ}
                </span>
                <div className="flex gap-1">
                  {lesson.quiz.map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-0.5"
                      style={{
                        background: i < quizIdx ? "hsl(var(--accent))" : i === quizIdx ? "hsl(var(--foreground))" : "hsl(var(--border))"
                      }}
                    />
                  ))}
                </div>
              </div>

              <p className="font-semibold text-foreground text-sm leading-relaxed">{currentQ.question}</p>

              <div className="space-y-1.5">
                {currentQ.options.map((opt, i) => {
                  const isCorrect  = i === currentQ.correct;
                  const isSelected = i === selected;
                  return (
                    <button
                      key={i}
                      data-testid={`quiz-option-${i}`}
                      onClick={() => handleAnswer(i)}
                      disabled={answered}
                      className={`w-full text-left border p-4 text-sm transition-all duration-150 ${
                        !answered
                          ? "border-border bg-muted hover:border-foreground/20 cursor-pointer"
                          : isCorrect
                          ? "border-accent/50 bg-accent/5 text-accent"
                          : isSelected
                          ? "border-destructive/50 bg-destructive/5 text-destructive"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-xs w-5 h-5 border flex items-center justify-center shrink-0 ${
                          answered && isCorrect  ? "border-accent text-accent" :
                          answered && isSelected ? "border-destructive text-destructive" :
                          "border-current text-muted-foreground"
                        }`}>
                          {answered && isCorrect ? "✓" : answered && isSelected && !isCorrect ? "✗" : String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                    </button>
                  );
                })}
              </div>

              {answered && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <button
                    data-testid="button-next-question"
                    onClick={handleNext}
                    className="w-full bg-foreground text-background font-mono text-xs font-semibold py-3 hover:opacity-85 transition-opacity"
                  >
                    {quizIdx < totalQ - 1 ? "Next Question →" : "Finish Lesson →"}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Complete ── */}
        {phase === "complete" && (
          <motion.div key="complete" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="border border-border bg-card p-8 text-center space-y-4">
              <div className="font-mono text-4xl text-accent">✓</div>
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {alreadyDone ? "Already mastered." : "Lesson complete."}
                </h3>
                {!alreadyDone && (
                  <div className="font-mono text-sm text-accent font-bold mt-2">
                    +{xpGained} XP earned
                  </div>
                )}
                <p className="font-mono text-xs text-muted-foreground mt-2">
                  {alreadyDone ? "You've already completed this one." : "Keep the momentum going."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                data-testid="button-back-path-complete"
                onClick={onBack}
                className="flex-1 border border-border bg-card text-foreground font-mono text-xs py-3 hover:border-foreground/20 transition-colors"
              >
                ← Back to Path
              </button>
              <button
                data-testid="button-chat-after"
                onClick={() => onChat(`I just completed "${lesson.title}". What should I know to go deeper?`)}
                className="flex-1 bg-foreground text-background font-mono text-xs font-semibold py-3 hover:opacity-85 transition-opacity"
              >
                Go Deeper →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
