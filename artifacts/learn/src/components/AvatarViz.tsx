import { motion } from "framer-motion";

type Appearance = "nebula" | "flame" | "crystal" | "aurora";

interface Props {
  appearance: Appearance;
  size?: number;
  className?: string;
}

function Nebula({ s }: { s: number }) {
  const cx = s / 2, cy = s / 2, r = s * 0.42;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="neb-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      {/* Outer pulse glow */}
      <motion.circle cx={cx} cy={cy} r={r * 1.1} fill="#7c3aed"
        animate={{ opacity: [0.06, 0.14, 0.06], scale: [1, 1.12, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Orbit ring 1 — CW */}
      <motion.g style={{ transformOrigin: `${cx}px ${cy}px` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}>
        <ellipse cx={cx} cy={cy} rx={r * 0.96} ry={r * 0.28}
          fill="none" stroke="#7c3aed" strokeWidth={s * 0.016} opacity={0.55} />
        <circle cx={cx + r * 0.96} cy={cy} r={s * 0.042} fill="#c084fc" />
      </motion.g>
      {/* Orbit ring 2 — CCW */}
      <motion.g style={{ transformOrigin: `${cx}px ${cy}px` }}
        animate={{ rotate: -360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
        <ellipse cx={cx} cy={cy} rx={r * 0.38} ry={r * 0.92}
          fill="none" stroke="#a855f7" strokeWidth={s * 0.012} opacity={0.38} />
        <circle cx={cx} cy={cy - r * 0.92} r={s * 0.03} fill="#a855f7" />
      </motion.g>
      {/* Core orb */}
      <circle cx={cx} cy={cy} r={r * 0.36} fill="url(#neb-core)" />
      <circle cx={cx} cy={cy} r={r * 0.14} fill="#e9d5ff" opacity={0.7} />
      {/* Symbol */}
      <text x={cx} y={cy + s * 0.05} textAnchor="middle"
        fill="white" fontSize={s * 0.2} fontWeight="bold"
        style={{ userSelect: "none" }}>✦</text>
    </svg>
  );
}

function Flame({ s }: { s: number }) {
  const cx = s / 2;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <defs>
        <radialGradient id="flame-out" cx="50%" cy="75%" r="55%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="60%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#9a3412" stopOpacity="0.1" />
        </radialGradient>
        <radialGradient id="flame-in" cx="50%" cy="65%" r="45%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Glow */}
      <motion.circle cx={cx} cy={s * 0.62} r={s * 0.3} fill="#ea580c"
        animate={{ opacity: [0.07, 0.16, 0.07] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Outer flame body */}
      <motion.path
        d={`M${cx} ${s*0.1} C${s*0.72} ${s*0.18} ${s*0.88} ${s*0.52} ${s*0.82} ${s*0.72} C${s*0.75} ${s*0.9} ${s*0.6} ${s*0.95} ${cx} ${s*0.95} C${s*0.4} ${s*0.95} ${s*0.25} ${s*0.9} ${s*0.18} ${s*0.72} C${s*0.12} ${s*0.52} ${s*0.28} ${s*0.18} ${cx} ${s*0.1}Z`}
        fill="url(#flame-out)"
        animate={{ scaleY: [1, 1.06, 0.96, 1.04, 1], scaleX: [1, 0.96, 1.04, 0.98, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: `${cx}px ${s * 0.9}px` }}
      />
      {/* Inner flame */}
      <motion.path
        d={`M${cx} ${s*0.3} C${s*0.63} ${s*0.36} ${s*0.73} ${s*0.57} ${s*0.68} ${s*0.72} C${s*0.62} ${s*0.85} ${s*0.55} ${s*0.89} ${cx} ${s*0.89} C${s*0.45} ${s*0.89} ${s*0.38} ${s*0.85} ${s*0.32} ${s*0.72} C${s*0.27} ${s*0.57} ${s*0.37} ${s*0.36} ${cx} ${s*0.3}Z`}
        fill="url(#flame-in)"
        animate={{ scaleY: [1, 1.1, 0.93, 1.06, 1], scaleX: [1, 0.93, 1.06, 0.97, 1] }}
        transition={{ duration: 0.65, repeat: Infinity, ease: "easeInOut", delay: 0.12 }}
        style={{ transformOrigin: `${cx}px ${s * 0.82}px` }}
      />
      {/* Symbol */}
      <text x={cx} y={s * 0.7} textAnchor="middle"
        fill="white" fontSize={s * 0.18} fontWeight="bold"
        style={{ userSelect: "none" }}>◈</text>
    </svg>
  );
}

function Crystal({ s }: { s: number }) {
  const cx = s / 2, cy = s / 2, r = s * 0.4;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * Math.PI / 180;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
  const innerHex = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * Math.PI / 180;
    return `${cx + r * 0.48 * Math.cos(a)},${cy + r * 0.48 * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <defs>
        <linearGradient id="cryst-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="50%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      {/* Pulse glow */}
      <motion.polygon points={hex} fill="#0ea5e9"
        animate={{ opacity: [0.07, 0.15, 0.07], scale: [1, 1.14, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Rotating crystal */}
      <motion.g style={{ transformOrigin: `${cx}px ${cy}px` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}>
        <polygon points={hex} fill="url(#cryst-g)" opacity={0.9} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * 60 - 90) * Math.PI / 180;
          return (
            <line key={i} x1={cx} y1={cy}
              x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)}
              stroke="white" strokeWidth={s * 0.009} opacity={0.28} />
          );
        })}
        <polygon points={innerHex} fill="white" opacity={0.18} />
        <circle cx={cx} cy={cy} r={r * 0.18} fill="white" opacity={0.5} />
      </motion.g>
      {/* Symbol counter-rotates to stay upright */}
      <motion.g style={{ transformOrigin: `${cx}px ${cy}px` }}
        animate={{ rotate: -360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}>
        <text x={cx} y={cy + s * 0.05} textAnchor="middle"
          fill="white" fontSize={s * 0.19} fontWeight="bold"
          style={{ userSelect: "none" }}>◆</text>
      </motion.g>
    </svg>
  );
}

function Aurora({ s }: { s: number }) {
  const cx = s / 2, cy = s / 2;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <defs>
        <radialGradient id="aur-g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="65%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" stopOpacity="0.15" />
        </radialGradient>
      </defs>
      {/* Pulse rings */}
      {([s * 0.45, s * 0.35, s * 0.25] as number[]).map((r, i) => (
        <motion.circle key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke="#16a34a" strokeWidth={s * 0.014}
          animate={{ opacity: [0.3 - i * 0.07, 0.04, 0.3 - i * 0.07], scale: [1, 1.1, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.45 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
      {/* Core */}
      <circle cx={cx} cy={cy} r={s * 0.19} fill="url(#aur-g)" />
      <circle cx={cx} cy={cy} r={s * 0.09} fill="#86efac" opacity={0.65} />
      {/* Symbol */}
      <text x={cx} y={cy + s * 0.048} textAnchor="middle"
        fill="white" fontSize={s * 0.17} fontWeight="bold"
        style={{ userSelect: "none" }}>◉</text>
    </svg>
  );
}

export default function AvatarViz({ appearance, size = 80, className = "" }: Props) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      {appearance === "nebula" && <Nebula s={size} />}
      {appearance === "flame"  && <Flame  s={size} />}
      {appearance === "crystal" && <Crystal s={size} />}
      {appearance === "aurora" && <Aurora  s={size} />}
    </div>
  );
}
