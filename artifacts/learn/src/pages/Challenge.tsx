import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppState } from "@/lib/store";
import { addXP } from "@/lib/store";
import { CHALLENGES_BY_MODE, type Challenge, type TraceEvent, type ChallengeMode } from "@/lib/challenges";

interface Props {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onBack: () => void;
  initialMode?: ChallengeMode;
}

// ─── Syntax highlighter (no deps) ───
function highlightSolidity(code: string): string {
  const keywords = /\b(pragma|solidity|contract|interface|library|function|returns|return|external|internal|public|private|view|pure|payable|modifier|event|emit|mapping|address|uint256|uint|int256|int|bool|bytes|bytes32|string|memory|storage|calldata|immutable|constant|constructor|require|revert|assert|if|else|for|while|do|break|continue|new|delete|this|super|msg|block|tx|true|false|struct|enum|import|is)\b/g;
  const types = /\b(uint8|uint16|uint32|uint64|uint128|uint256|int8|int16|int32|int64|int128|address payable)\b/g;
  const comments = /(\/\/[^\n]*)/g;
  const strings = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const numbers = /\b(\d+)\b/g;

  return code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(comments, '<span style="color:#6b7280">$1</span>')
    .replace(strings, '<span style="color:#86efac">$1</span>')
    .replace(keywords, '<span style="color:#c084fc">$1</span>')
    .replace(types, '<span style="color:#67e8f9">$1</span>')
    .replace(numbers, '<span style="color:#fbbf24">$1</span>');
}

// ─── Storage Grid ───
interface StorageState {
  value: string;
  label: string;
  dirty: boolean;
  active: boolean;
}

function StorageGrid({ slots }: { slots: Record<number, StorageState> }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {Array.from({ length: 16 }, (_, i) => {
        const slot = slots[i];
        return (
          <motion.div
            key={i}
            animate={{
              backgroundColor: slot?.dirty
                ? "rgba(250,204,21,0.15)"
                : slot?.active
                ? "rgba(96,165,250,0.12)"
                : "rgba(255,255,255,0.03)",
              borderColor: slot?.dirty
                ? "rgba(250,204,21,0.5)"
                : slot?.active
                ? "rgba(96,165,250,0.4)"
                : "rgba(255,255,255,0.08)",
            }}
            transition={{ duration: 0.3 }}
            className="border p-1.5 min-h-[52px] flex flex-col justify-between"
          >
            <div className="font-mono text-[9px] text-muted-foreground">[{i}]</div>
            {slot ? (
              <>
                <motion.div
                  key={slot.value}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-mono text-[10px] text-foreground truncate leading-tight"
                >
                  {slot.value.length > 10 ? slot.value.slice(0, 6) + ".." : slot.value}
                </motion.div>
                <div className="font-mono text-[8px] text-muted-foreground truncate">{slot.label}</div>
              </>
            ) : (
              <div className="font-mono text-[10px] text-muted-foreground/30">0x0</div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Call Tree ───
interface CallNode {
  id: string;
  fn: string;
  contract: string;
  value: string;
  parentId: string | null;
  success?: boolean;
  returned?: boolean;
}

function CallTreeNode({
  node,
  allNodes,
  depth,
}: {
  node: CallNode;
  allNodes: CallNode[];
  depth: number;
}) {
  const children = allNodes.filter(n => n.parentId === node.id);
  const isReentry = node.fn.includes("RE-ENTRY");
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="font-mono"
      style={{ paddingLeft: depth * 16 }}
    >
      <div
        className={`flex items-start gap-1.5 py-0.5 text-[10px] leading-tight ${
          isReentry
            ? "text-amber-400"
            : node.success === false
            ? "text-red-400"
            : node.success === true
            ? "text-green-400"
            : "text-foreground"
        }`}
      >
        <span className="text-muted-foreground shrink-0 mt-px">
          {depth === 0 ? "►" : "└─"}
        </span>
        <div className="min-w-0">
          <span className="text-[10px] opacity-60">{node.contract}.</span>
          <span className="font-semibold">{node.fn}</span>
          {node.value !== "0 ETH" && (
            <span className="ml-1 text-amber-400 text-[9px]">[{node.value}]</span>
          )}
          {node.success === false && (
            <span className="ml-1 text-red-400 text-[9px]">✗ REVERT</span>
          )}
          {node.success === true && !isReentry && (
            <span className="ml-1 text-green-400/60 text-[9px]">✓</span>
          )}
        </div>
      </div>
      {children.map(child => (
        <CallTreeNode key={child.id} node={child} allNodes={allNodes} depth={depth + 1} />
      ))}
    </motion.div>
  );
}

function CallTree({ nodes }: { nodes: CallNode[] }) {
  const roots = nodes.filter(n => n.parentId === null);
  if (roots.length === 0) {
    return (
      <div className="font-mono text-xs text-muted-foreground/40 pt-4 text-center">
        Run the contract to see the call tree
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      {roots.map(root => (
        <CallTreeNode key={root.id} node={root} allNodes={nodes} depth={0} />
      ))}
    </div>
  );
}

// ─── Gas Meter ───
function GasMeter({ gas }: { gas: number }) {
  const MAX_GAS = 200000;
  const pct = Math.min((gas / MAX_GAS) * 100, 100);
  const color = pct < 40 ? "#22c55e" : pct < 70 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="label-mono">Gas Used</span>
        <motion.span
          key={gas}
          initial={{ scale: 1.2, color: "#fbbf24" }}
          animate={{ scale: 1, color: "#e8e8e8" }}
          transition={{ duration: 0.3 }}
          className="font-mono text-lg font-bold"
        >
          {gas.toLocaleString()}
        </motion.span>
      </div>
      <div className="h-2 bg-border overflow-hidden">
        <motion.div
          className="h-full"
          animate={{ width: `${pct}%`, backgroundColor: color }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-[9px] text-muted-foreground">0</span>
        <span className="font-mono text-[9px] text-muted-foreground">
          ~${((gas * 30) / 1e9 * 3000).toFixed(4)} at 30 gwei, ETH $3k
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">200k</span>
      </div>
    </div>
  );
}

// ─── Event Log ───
interface LogLine {
  id: string;
  type: "emit" | "sstore" | "sload" | "revert" | "success" | "call";
  text: string;
}

function EventLog({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  if (lines.length === 0) {
    return (
      <div className="font-mono text-xs text-muted-foreground/40 pt-4 text-center">
        Execution log will appear here
      </div>
    );
  }
  return (
    <div ref={ref} className="space-y-0.5 max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed">
      {lines.map(line => (
        <motion.div
          key={line.id}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className={
            line.type === "revert"
              ? "text-red-400"
              : line.type === "success"
              ? "text-green-400"
              : line.type === "emit"
              ? "text-violet-400"
              : line.type === "sstore"
              ? "text-amber-400"
              : "text-muted-foreground"
          }
        >
          <span className="text-muted-foreground/40 mr-1">&gt;</span>
          {line.text}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Challenge Page ───
type VisTab = "storage" | "calls" | "gas" | "log";
type RunState = "idle" | "running" | "success" | "fail";

const BONUS_MESSAGES = [
  "PERFECT EXECUTION — Gas optimal!",
  "FLAWLESS — No wasted opcodes!",
  "EFFICIENCY MASTER — Clean trace!",
  "PRECISION STRIKE — Elite solver!",
];

const SOLVERS_BASE = [2847, 1923, 1654, 743, 521, 389, 312, 189, 267];

export default function Challenge({ state, onStateChange, onBack, initialMode }: Props) {
  const [mode, setMode] = useState<ChallengeMode>(initialMode ?? "beginner");
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [code, setCode] = useState("");
  const [visTab, setVisTab] = useState<VisTab>("calls");
  const [runState, setRunState] = useState<RunState>("idle");
  const [storageSlots, setStorageSlots] = useState<Record<number, StorageState>>({});
  const [callNodes, setCallNodes] = useState<CallNode[]>([]);
  const [gasUsed, setGasUsed] = useState(0);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);
  const [solvedSet, setSolvedSet] = useState<Set<string>>(new Set());
  const [consecutiveSolves, setConsecutiveSolves] = useState(0);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const challenges = CHALLENGES_BY_MODE[mode];
  const challenge = challenges[challengeIdx];

  // Reset when challenge changes
  useEffect(() => {
    setCode(challenge.starterCode);
    setRunState("idle");
    setStorageSlots({});
    setCallNodes([]);
    setGasUsed(0);
    setLogLines([]);
    setShowResult(false);
    setBonusMsg(null);
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }, [challenge.id]);

  const clearTimers = () => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  };

  const addLog = useCallback((id: string, type: LogLine["type"], text: string) => {
    setLogLines(prev => [...prev, { id, type, text }]);
  }, []);

  const playTrace = useCallback((events: TraceEvent[]) => {
    clearTimers();
    let delay = 0;
    const BASE = 350;

    events.forEach((ev, i) => {
      const t = setTimeout(() => {
        if (ev.type === "sstore") {
          setStorageSlots(prev => ({
            ...prev,
            [ev.slot]: { value: ev.to.slice(0, 10), label: ev.label, dirty: true, active: false },
          }));
          addLog(`ev-${i}`, "sstore", `SSTORE [${ev.slot}] ${ev.from.slice(0,8)}→${ev.to.slice(0,8)} (${ev.gasSpent.toLocaleString()} gas) — ${ev.label}`);
          setGasUsed(prev => prev + ev.gasSpent);
          // Un-dirty after 1.5s
          const undirtyT = setTimeout(() => {
            setStorageSlots(prev => ({
              ...prev,
              [ev.slot]: { ...prev[ev.slot], dirty: false },
            }));
          }, 1500);
          timerRefs.current.push(undirtyT);
          setVisTab("storage");
        } else if (ev.type === "sload") {
          setStorageSlots(prev => ({
            ...prev,
            [ev.slot]: {
              value: prev[ev.slot]?.value ?? ev.value.slice(0, 10),
              label: prev[ev.slot]?.label ?? `slot[${ev.slot}]`,
              dirty: false,
              active: true,
            },
          }));
          addLog(`ev-${i}`, "sload", `SLOAD [${ev.slot}] = ${ev.value.slice(0,10)} (${ev.gasSpent} gas)`);
          setGasUsed(prev => prev + ev.gasSpent);
          const unactiveT = setTimeout(() => {
            setStorageSlots(prev => ({
              ...prev,
              [ev.slot]: { ...prev[ev.slot], active: false },
            }));
          }, 800);
          timerRefs.current.push(unactiveT);
        } else if (ev.type === "call") {
          setCallNodes(prev => [...prev, {
            id: ev.id,
            fn: ev.fn,
            contract: ev.contract,
            value: ev.value,
            parentId: ev.parentId,
          }]);
          addLog(`ev-${i}`, "call", `CALL ${ev.contract}.${ev.fn.split("(")[0]}() [${ev.value}]`);
          setVisTab("calls");
        } else if (ev.type === "call_return") {
          setCallNodes(prev =>
            prev.map(n => n.id === ev.id ? { ...n, success: ev.success, returned: true } : n)
          );
          if (!ev.success) {
            addLog(`ev-${i}`, "revert", `RETURN ${ev.id} ✗ REVERTED${ev.data ? ` — ${ev.data}` : ""}`);
          }
        } else if (ev.type === "emit") {
          addLog(`ev-${i}`, "emit", `EVENT ${ev.name}(${ev.args})`);
          setVisTab("log");
        } else if (ev.type === "gas") {
          setGasUsed(ev.total);
        } else if (ev.type === "revert") {
          setRunState("fail");
          addLog(`ev-${i}`, "revert", ev.reason);
          setVisTab("log");
          setShowResult(true);
        } else if (ev.type === "success") {
          addLog(`ev-${i}`, "success", ev.message);
          setVisTab("log");
          // Variable reward — Instagram slot machine effect
          const roll = Math.random();
          const bonus = roll < 0.15
            ? BONUS_MESSAGES[Math.floor(Math.random() * BONUS_MESSAGES.length)]
            : null;
          setBonusMsg(bonus);
          const xpEarned = bonus ? Math.round(challenge.xpReward * 1.2) : challenge.xpReward;
          setEarnedXP(xpEarned);
          setRunState("success");
          if (!solvedSet.has(challenge.id)) {
            setSolvedSet(prev => new Set([...prev, challenge.id]));
            setConsecutiveSolves(prev => prev + 1);
            onStateChange(addXP(state, xpEarned));
          }
          setShowResult(true);
        }
      }, delay);
      timerRefs.current.push(t);
      delay += ev.type === "call" ? BASE : ev.type === "sstore" ? BASE * 1.4 : BASE * 0.6;
    });
  }, [challenge, solvedSet, state, onStateChange, addLog]);

  const handleRun = () => {
    if (runState === "running") return;
    setRunState("running");
    setStorageSlots({});
    setCallNodes([]);
    setGasUsed(0);
    setLogLines([]);
    setShowResult(false);
    setBonusMsg(null);

    const isCorrect = challenge.validate(code);
    const trace = isCorrect ? challenge.successTrace : challenge.failTrace;

    setTimeout(() => playTrace(trace), 300);
  };

  const handleNextChallenge = () => {
    const nextIdx = challengeIdx + 1;
    if (nextIdx < challenges.length) {
      setChallengeIdx(nextIdx);
    } else {
      // All done — go to next mode
      const modes: ChallengeMode[] = ["beginner", "builder", "auditor"];
      const nextModeIdx = modes.indexOf(mode) + 1;
      if (nextModeIdx < modes.length) {
        setMode(modes[nextModeIdx]);
        setChallengeIdx(0);
      } else {
        onBack();
      }
    }
  };

  const alreadySolved = solvedSet.has(challenge.id);
  const modeProgress = challenges.filter(c => solvedSet.has(c.id)).length;
  const socialProof = (SOLVERS_BASE[challenge.index] ?? 400) + Math.floor(consecutiveSolves * 7);

  const MODE_META = {
    beginner: { label: "BEGINNER", color: "#22c55e", badge: "GN", desc: "Fill the blanks, watch it run" },
    builder: { label: "BUILDER", color: "#3b82f6", badge: "BL", desc: "Paste code, test it live" },
    auditor: { label: "AUDITOR", color: "#ef4444", badge: "AU", desc: "Find bugs, exploit them" },
  };

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">
      {/* ── Mode Bar ── */}
      <div className="border-b border-border bg-card/50 px-4 py-2.5 flex items-center gap-2 overflow-x-auto shrink-0">
        <button onClick={onBack} className="font-mono text-xs text-muted-foreground hover:text-foreground mr-1 shrink-0">
          ← back
        </button>
        {(["beginner", "builder", "auditor"] as ChallengeMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setChallengeIdx(0); }}
            className={`font-mono text-[10px] font-bold px-2.5 py-1 border tracking-widest uppercase transition-all shrink-0 ${
              mode === m
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/50"
            }`}
          >
            {MODE_META[m].label}
          </button>
        ))}
        <div className="flex-1" />
        {state.profile?.streak ? (
          <span className="font-mono text-[10px] text-amber-400 shrink-0">{state.profile.streak}d 🔥</span>
        ) : null}
      </div>

      {/* ── Challenge Strip ── */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-3 bg-background shrink-0">
        <div className="flex items-center gap-1.5">
          {challenges.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => setChallengeIdx(idx)}
              className={`font-mono text-[9px] px-1.5 py-0.5 border transition-all ${
                idx === challengeIdx
                  ? "border-foreground bg-foreground text-background"
                  : solvedSet.has(c.id)
                  ? "border-green-500/60 text-green-400"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {solvedSet.has(c.id) ? "✓" : `0${idx + 1}`}
            </button>
          ))}
        </div>
        <div className="flex-1 h-px bg-border overflow-hidden">
          <div
            className="h-full bg-foreground/60 transition-all duration-700"
            style={{ width: `${(modeProgress / challenges.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-[9px] text-muted-foreground shrink-0">
          {modeProgress}/{challenges.length}
        </span>
      </div>

      {/* ── Main Split Layout ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Objective header */}
        <div className="border-b border-border px-4 py-3 bg-card/30 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="font-mono text-[9px] font-bold px-1.5 py-0.5"
                  style={{
                    background: MODE_META[mode].color + "22",
                    color: MODE_META[mode].color,
                    border: `1px solid ${MODE_META[mode].color}44`,
                  }}
                >
                  {MODE_META[mode].badge}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  Challenge {challengeIdx + 1} · {challenge.avgTime}
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground leading-tight">{challenge.title}</h2>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{challenge.subtitle}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-lg font-bold text-foreground">+{challenge.xpReward}</div>
              <div className="label-mono">XP</div>
            </div>
          </div>
          <p className="font-mono text-xs text-muted-foreground mt-2 leading-relaxed border-l-2 border-border pl-3">
            {challenge.objective}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-mono text-[9px] text-muted-foreground">
              {socialProof.toLocaleString()} builders solved this
            </span>
            {alreadySolved && (
              <span className="font-mono text-[9px] text-green-400 border border-green-500/30 px-1.5 py-0.5">
                ✓ SOLVED
              </span>
            )}
          </div>
        </div>

        {/* Code Editor */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card/20 shrink-0">
            <span className="label-mono text-[9px]">EDITOR — Solidity</span>
            <div className="flex items-center gap-2">
              <HintButton hints={challenge.hints} />
              <button
                onClick={handleRun}
                disabled={runState === "running"}
                className={`font-mono text-[10px] font-bold px-3 py-1 border transition-all flex items-center gap-1.5 ${
                  runState === "running"
                    ? "border-amber-500/40 text-amber-400"
                    : "bg-foreground text-background border-foreground hover:opacity-80"
                }`}
              >
                {runState === "running" ? (
                  <>
                    <span className="inline-block w-2 h-2 border border-amber-400 border-t-transparent animate-spin" />
                    RUNNING
                  </>
                ) : "▶ RUN"}
              </button>
            </div>
          </div>

          {/* Code editor area */}
          <div className="relative flex-1 overflow-hidden">
            <div
              className="absolute inset-0 font-mono text-xs p-4 pointer-events-none overflow-hidden whitespace-pre-wrap break-words leading-relaxed"
              style={{ color: "transparent" }}
              dangerouslySetInnerHTML={{ __html: highlightSolidity(code) }}
            />
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              className="absolute inset-0 w-full h-full font-mono text-xs p-4 bg-transparent text-transparent caret-foreground resize-none outline-none leading-relaxed"
              style={{ caretColor: "#e8e8e8" }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Execution Visualizer */}
        <div className="border-t border-border shrink-0" style={{ maxHeight: "320px" }}>
          {/* Visual tab bar */}
          <div className="flex border-b border-border bg-card/20">
            {(["calls", "storage", "gas", "log"] as VisTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setVisTab(tab)}
                className={`flex-1 font-mono text-[9px] uppercase tracking-widest py-1.5 border-r border-border last:border-r-0 transition-colors ${
                  visTab === tab
                    ? "bg-foreground text-background font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "calls" ? "Call Tree" : tab === "storage" ? "Storage" : tab === "gas" ? "Gas" : "Log"}
              </button>
            ))}
          </div>

          <div className="p-3 overflow-y-auto" style={{ maxHeight: "260px" }}>
            {visTab === "storage" && <StorageGrid slots={storageSlots} />}
            {visTab === "calls" && <CallTree nodes={callNodes} />}
            {visTab === "gas" && <GasMeter gas={gasUsed} />}
            {visTab === "log" && <EventLog lines={logLines} />}
          </div>
        </div>
      </div>

      {/* ── Result Overlay ── */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setShowResult(false)}
          >
            <motion.div
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full max-w-lg border-t border-border bg-background p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              {runState === "success" ? (
                <>
                  {/* XP earned */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-xs text-green-400 mb-1 tracking-widest">CHALLENGE SOLVED</div>
                      <h3 className="text-2xl font-bold text-foreground">{challenge.title}</h3>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">{challenge.subtitle}</p>
                    </div>
                    <motion.div
                      initial={{ scale: 0.5, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="text-right"
                    >
                      <div className="font-mono text-3xl font-bold text-foreground">+{earnedXP}</div>
                      <div className="label-mono">XP</div>
                    </motion.div>
                  </div>

                  {/* Variable reward — the slot machine */}
                  {bonusMsg && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="border border-amber-500/40 bg-amber-500/10 px-4 py-3"
                    >
                      <span className="font-mono text-xs text-amber-400 font-bold tracking-wide">
                        ⚡ {bonusMsg}
                      </span>
                    </motion.div>
                  )}

                  {/* Consecutive solve streak hook */}
                  {consecutiveSolves >= 2 && (
                    <div className="border border-violet-500/30 bg-violet-500/10 px-3 py-2">
                      <span className="font-mono text-xs text-violet-400">
                        🔥 On a {consecutiveSolves}-challenge streak! Keep going →
                      </span>
                    </div>
                  )}

                  {/* Cliffhanger — Zeigarnik effect: tease the next challenge */}
                  {challengeIdx + 1 < challenges.length ? (
                    <div className="border border-border p-3 flex items-center justify-between">
                      <div>
                        <div className="label-mono mb-1">Next Challenge</div>
                        <div className="text-sm font-semibold text-foreground">
                          {challenges[challengeIdx + 1].title}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mt-0.5">
                          {challenges[challengeIdx + 1].subtitle}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-bold">+{challenges[challengeIdx + 1].xpReward}</div>
                        <div className="label-mono">XP</div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-green-500/30 bg-green-500/10 p-3">
                      <div className="font-mono text-xs text-green-400 font-bold">
                        ✓ {MODE_META[mode].label} MODE COMPLETE
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mt-1">
                        All 3 challenges solved. {mode !== "auditor" ? "Unlock the next mode →" : "You think like an auditor."}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowResult(false)}
                      className="flex-1 font-mono text-xs py-3 border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Review Code
                    </button>
                    <button
                      onClick={handleNextChallenge}
                      className="flex-1 btn-arrow font-semibold"
                    >
                      {challengeIdx + 1 < challenges.length ? "Next Challenge →" : "Next Mode →"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="font-mono text-xs text-red-400 mb-1 tracking-widest">EXECUTION FAILED</div>
                    <h3 className="text-xl font-bold text-foreground">{challenge.title}</h3>
                    <div className="mt-3 border border-red-500/30 bg-red-500/10 p-3">
                      <p className="font-mono text-xs text-red-300 leading-relaxed">
                        {logLines.find(l => l.type === "revert")?.text ?? "Test failed. Review the objective and try again."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowResult(false); setRunState("idle"); }}
                      className="flex-1 btn-arrow"
                    >
                      Try Again →
                    </button>
                    <HintButton hints={challenge.hints} inline />
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Hint Button ───
function HintButton({ hints, inline }: { hints: string[]; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(0);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`font-mono text-[10px] border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors ${inline ? "w-full py-3 text-xs" : ""}`}
      >
        {inline ? "Show Hint" : "hint"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 bottom-full mb-1 w-64 border border-border bg-background p-3 z-20 shadow-xl"
          >
            <div className="space-y-2">
              {hints.slice(0, revealed + 1).map((h, i) => (
                <div key={i} className="font-mono text-xs text-muted-foreground leading-relaxed border-l border-border pl-2">
                  {h}
                </div>
              ))}
            </div>
            {revealed < hints.length - 1 && (
              <button
                onClick={() => setRevealed(r => r + 1)}
                className="mt-2 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                → next hint ({hints.length - revealed - 1} remaining)
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
