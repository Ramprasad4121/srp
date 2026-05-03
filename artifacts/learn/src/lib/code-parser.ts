export interface VisualEvent {
  type:
    | "vault_change"
    | "logic_gate"
    | "emit_event"
    | "call"
    | "reentrancy"
    | "loop"
    | "store"
    | "success";
  value?: number;
  label?: string;
  delay: number;
}

export type SimMode = "evm" | "solana";

export function parseCode(code: string, _mode: SimMode): VisualEvent[] {
  const events: VisualEvent[] = [];
  let delay = 0;

  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith("//") || t.startsWith("///") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("#[")) continue;

    // Balance increase
    if (/balances.*\+=|total_staked\s*\+=|amount.*\+|deposit/.test(t)) {
      events.push({ type: "vault_change", value: 22, label: "SSTORE: balance += amount", delay });
      delay += 700;
    }

    // Balance decrease
    if (/balances.*-=|total_staked\s*-=|withdraw|transfer\s*\(/.test(t)) {
      events.push({ type: "vault_change", value: -18, label: "SSTORE: balance -= amount", delay });
      delay += 700;
    }

    // Require / checks
    if (/require\s*[!(]|require!/.test(t)) {
      events.push({ type: "logic_gate", label: t.replace(/require[!]?\s*\(/, "CHECK: ").slice(0, 55), delay });
      delay += 650;
    }

    // Emit events
    if (/\bemit\s+[A-Z]|emit!\s*\(/.test(t)) {
      const name = t.match(/emit[!\s]+(\w+)/)?.[1] ?? "Event";
      events.push({ type: "emit_event", label: name, delay });
      delay += 400;
    }

    // External calls — check for reentrancy (call before state update)
    if (/\.call\s*\{/.test(t)) {
      const afterCode = lines.slice(i + 1).join("\n");
      const isRisky = /balances.*-=/.test(afterCode.slice(0, 200));
      events.push({
        type: isRisky ? "reentrancy" : "call",
        label: isRisky
          ? "⚠ DANGER: external call before state update!"
          : "External call — crossing contract boundary",
        delay,
      });
      delay += 1100;
    }

    // SPL / Solana token ops
    if (/token::transfer|transfer_ctx|spl_token|invoke_signed/.test(t)) {
      events.push({ type: "call", label: "SPL token transfer via CPI", delay });
      delay += 750;
    }

    // Storage writes
    if (/mapping\s*\(|\.push\s*\(|stakers\.push|storage/.test(t) && !/\/\//.test(t)) {
      events.push({ type: "store", label: "SSTORE — persistent storage write", delay });
      delay += 300;
    }

    // Loops
    if (/\bfor\s*\(|\bwhile\s*\(/.test(t)) {
      events.push({ type: "loop", label: "LOOP — gas scales O(n)", delay });
      delay += 500;
    }
  }

  if (events.length > 0) {
    events.push({ type: "success", label: "Execution complete — state finalized", delay: delay + 600 });
  }

  return events;
}
