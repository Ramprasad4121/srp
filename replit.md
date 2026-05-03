# SRP Learn

A next-gen Web3 smart contract learning platform using addiction-loop mechanics.

## Architecture

Single artifact: `artifacts/learn` — a React 19 + Vite + Tailwind v4 SPA. No backend. All state in `localStorage`.

**Stack:** React 19, Vite, Tailwind v4, framer-motion, lucide-react, wouter.

## Key Files

- `artifacts/learn/src/App.tsx` — routing shell (dashboard, chat, paths, profile, admin)
- `artifacts/learn/src/pages/Dashboard.tsx` — home: AvatarViz hero, x402-style stats, challenges, paths, custom topics
- `artifacts/learn/src/pages/Challenge.tsx` — Run→See→Change→Repeat sandbox (789 lines)
- `artifacts/learn/src/pages/Lesson.tsx` — text-based lesson reader
- `artifacts/learn/src/pages/Profile.tsx` — XP progress, rank ladder, admin link
- `artifacts/learn/src/pages/Admin.tsx` — password-gated admin panel (password: srp2024), CRUD for custom topics
- `artifacts/learn/src/components/AvatarViz.tsx` — 4 animated SVG avatars (Nebula/Flame/Crystal/Aurora)
- `artifacts/learn/src/lib/challenges.ts` — 9 challenges with pre-computed EVM traces
- `artifacts/learn/src/lib/curriculum.ts` — 13 lessons across 4 learning paths
- `artifacts/learn/src/lib/store.ts` — XP/level/streak logic (localStorage)
- `artifacts/learn/src/index.css` — full design system (white/light x402-inspired, JetBrains Mono + Inter)

## Design System

- **Theme:** Pure white background, near-black text, light gray borders — x402.org inspired
- **Typography:** Inter for headings (large, bold), JetBrains Mono for labels/code
- **Buttons:** Black bg, white text, `→` arrows (`btn-arrow`)
- **Dot grid:** Subtle dark dots on white background
- **Avatars:** 4 animated SVG characters — Nebula (purple orbits), Flame (flickering), Crystal (rotating hexagon), Aurora (pulse rings)

## Admin Panel

- Access: Profile → "Admin Panel" link (very bottom)
- Password: `srp2024`
- Auth stored in `localStorage` under `srp_admin_auth`
- Custom topics stored in `localStorage` under `srp_custom_topics`
- Topics appear on Dashboard under "Custom Topics" section

## Challenge Modes

- **Beginner** — fill-in-the-blank Solidity, 100–150 XP
- **Builder** — implement DeFi contracts from spec, 300–400 XP
- **Auditor** — exploit live vulnerabilities, 500–600 XP

## Workflow

`artifacts/learn: web` → `pnpm --filter @workspace/learn run dev`
