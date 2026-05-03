# SRP Learn

A next-gen Web3 smart contract learning platform using addiction-loop mechanics.

## Architecture

Single artifact: `artifacts/learn` — a React 19 + Vite + Tailwind v4 SPA.

**Stack:** React 19, Vite, Tailwind v4, framer-motion, lucide-react, wouter, localStorage only.

## Key Files

- `artifacts/learn/src/App.tsx` — routing shell
- `artifacts/learn/src/pages/Dashboard.tsx` — home with XP, lessons, challenges
- `artifacts/learn/src/pages/Challenge.tsx` — Run→See→Change→Repeat sandbox (789 lines)
- `artifacts/learn/src/pages/Lesson.tsx` — text-based lesson reader
- `artifacts/learn/src/pages/Profile.tsx` — XP progress, badges, history
- `artifacts/learn/src/lib/challenges.ts` — 9 challenges with pre-computed EVM traces
- `artifacts/learn/src/lib/curriculum.ts` — 13 lessons across 4 learning paths
- `artifacts/learn/src/lib/store.ts` — XP/level/streak logic (localStorage)
- `artifacts/learn/src/index.css` — full design system (JetBrains Mono + Inter, #080808 bg)

## Modes

- **Beginner** — fill-in-the-blank Solidity
- **Builder** — implement DeFi contracts from spec
- **Auditor** — exploit live vulnerabilities

## Workflow

`artifacts/learn: web` → `pnpm --filter @workspace/learn run dev`
