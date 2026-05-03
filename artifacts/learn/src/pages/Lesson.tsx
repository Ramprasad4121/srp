import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, X, Zap, MessageSquare } from "lucide-react";
import type { AppState } from "@/lib/store";
import { addXP } from "@/lib/store";
import { getLessonById } from "@/lib/curriculum";
import { Button } from "@/components/ui/button";

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
  if (!found) return <div className="text-muted-foreground text-center p-8">Lesson not found</div>;

  const { lesson, path } = found;
  const profile = state.profile!;
  const alreadyDone = profile.completedLessons.includes(lessonId);

  const [phase, setPhase] = useState<Phase>(alreadyDone ? "complete" : "reading");
  const [quizIdx, setQuizIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [xpGained, setXpGained] = useState(0);

  const currentQ = lesson.quiz[quizIdx];
  const totalQ = lesson.quiz.length;

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
    const score = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 100;
    const bonusXP = score === 100 ? Math.floor(lesson.xpReward * 0.2) : 0;
    const earned = lesson.xpReward + bonusXP;
    setXpGained(earned);

    const newCompleted = [...profile.completedLessons, lessonId];
    const updated = addXP({
      ...state,
      profile: { ...profile, completedLessons: newCompleted },
    }, earned);
    onStateChange(updated);
    setPhase("complete");
  };

  const formatContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0];
        const code = lines.slice(1).join("\n");
        return (
          <div key={i} className="my-4 rounded-xl overflow-hidden border border-border">
            {lang && <div className="bg-muted px-4 py-1.5 text-xs text-muted-foreground font-mono border-b border-border">{lang}</div>}
            <pre className="bg-muted/50 p-4 overflow-x-auto text-xs text-foreground font-mono leading-relaxed">{code}</pre>
          </div>
        );
      }
      const paragraphs = part.split("\n\n");
      return paragraphs.map((para, j) => {
        if (para.startsWith("**") && para.endsWith("**") && !para.slice(2, -2).includes("**")) {
          return <h3 key={`${i}-${j}`} className="font-bold text-foreground text-base mt-4 mb-2">{para.slice(2, -2)}</h3>;
        }
        if (para.startsWith("- ") || para.split("\n").every(l => l.startsWith("- "))) {
          return (
            <ul key={`${i}-${j}`} className="list-disc list-inside space-y-1 text-muted-foreground my-2">
              {para.split("\n").map((line, k) => (
                <li key={k}>{line.replace(/^- /, "").split(/(\*\*[^*]+\*\*)/).map((s, l) =>
                  s.startsWith("**") ? <strong key={l} className="text-foreground">{s.slice(2, -2)}</strong> : s
                )}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`${i}-${j}`} className="text-muted-foreground leading-relaxed my-2">
            {para.split(/(\*\*[^*]+\*\*)/).map((s, k) =>
              s.startsWith("**") ? <strong key={k} className="text-foreground font-semibold">{s.slice(2, -2)}</strong> : s
            )}
          </p>
        );
      });
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button data-testid="button-back-lesson" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${path.color} text-white`}>{path.icon} {path.title}</span>
          </div>
          <h2 className="font-serif font-bold text-foreground mt-1">{lesson.title}</h2>
        </div>
        <div className="flex items-center gap-1 text-accent text-sm font-semibold">
          <Zap className="w-4 h-4" /> {lesson.xpReward} XP
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Reading phase */}
        {phase === "reading" && (
          <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-card border border-border rounded-2xl p-5 space-y-1 prose-sm max-w-none">
              {formatContent(lesson.content)}
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                data-testid="button-ask-avatar"
                variant="outline"
                onClick={() => onChat(`Explain this lesson to me in your own words: "${lesson.title}"\n\n${lesson.content.slice(0, 500)}`)}
                className="flex-1 gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Ask {profile.avatar.name}
              </Button>
              <Button
                data-testid="button-take-quiz"
                onClick={() => totalQ > 0 ? setPhase("quiz") : finishLesson()}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
              >
                {totalQ > 0 ? "Take Quiz" : "Complete Lesson"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Quiz phase */}
        {phase === "quiz" && (
          <motion.div key="quiz" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">QUESTION {quizIdx + 1} OF {totalQ}</span>
                <div className="flex gap-1">
                  {lesson.quiz.map((_, i) => (
                    <div key={i} className={`w-6 h-1.5 rounded-full ${i < quizIdx ? "bg-green-400" : i === quizIdx ? "bg-primary" : "bg-secondary"}`} />
                  ))}
                </div>
              </div>
              <p className="font-semibold text-foreground text-base leading-relaxed">{currentQ.question}</p>
              <div className="space-y-2">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct;
                  const isSelected = i === selected;
                  return (
                    <button
                      key={i}
                      data-testid={`quiz-option-${i}`}
                      onClick={() => handleAnswer(i)}
                      disabled={answered}
                      className={`w-full text-left p-4 rounded-xl border text-sm transition-all duration-200 ${
                        !answered
                          ? "border-border bg-secondary/50 hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                          : isCorrect
                          ? "border-green-500 bg-green-500/10 text-green-400"
                          : isSelected
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-border bg-secondary/30 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0 ${
                          answered && isCorrect ? "border-green-500 bg-green-500 text-white" :
                          answered && isSelected && !isCorrect ? "border-destructive bg-destructive text-white" :
                          "border-current"
                        }`}>
                          {answered && isCorrect ? "✓" : answered && isSelected ? "✗" : String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                    </button>
                  );
                })}
              </div>
              {answered && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <Button
                    data-testid="button-next-question"
                    onClick={handleNext}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
                  >
                    {quizIdx < totalQ - 1 ? "Next Question" : "Finish Lesson"}
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Complete phase */}
        {phase === "complete" && (
          <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
            <div className="relative mx-auto w-24 h-24">
              <div className="w-full h-full rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center glow-accent">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-serif font-bold text-foreground">
                {alreadyDone ? "Already Mastered!" : "Lesson Complete!"}
              </h3>
              {!alreadyDone && (
                <div className="flex items-center justify-center gap-2 mt-2 text-accent font-bold text-xl">
                  <Zap className="w-5 h-5" />+{xpGained} XP
                </div>
              )}
              <p className="text-muted-foreground mt-2 text-sm">
                {alreadyDone ? "You've already completed this lesson. Great job!" : "Keep going — the next lesson awaits."}
              </p>
            </div>
            <div className="flex gap-3">
              <Button data-testid="button-back-path-complete" variant="outline" onClick={onBack} className="flex-1">
                Back to Path
              </Button>
              <Button
                data-testid="button-chat-after"
                onClick={() => onChat(`I just completed the lesson "${lesson.title}". What should I know to go deeper on this topic?`)}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
              >
                Go Deeper with {profile.avatar.name}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
