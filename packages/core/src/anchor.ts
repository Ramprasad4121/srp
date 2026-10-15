/**
 * Anchor (Solana) structural detectors. Parses #[derive(Accounts)] structs and #[account] data
 * structs and checks the account constraints that Anchor exploits usually come down to.
 */
import type { Evidence, FindingContext, Severity, SourceFile } from "./types.ts";
import { evidenceAt } from "./utils.ts";
import { lineIndex, matchBrace, stripComments } from "./solidity.ts";

export interface AnchorField {
  name: string;
  type: string;
  /** Joined text of #[account(...)] attributes on the field. */
  constraints: string;
  line: number;
}

export interface AnchorAccountsStruct {
  name: string;
  line: number;
  fields: AnchorField[];
}

export interface AnchorIndex {
  accounts: AnchorAccountsStruct[];
  /** #[account] data structs: name -> Pubkey field names. */
  dataStructs: Map<string, string[]>;
  instructions: string[];
}

export interface AnchorDraft {
  detector: string;
  title: string;
  severity: Severity;
  impact: string;
  remediation: string;
  confidence: number;
  evidence: Evidence[];
  context?: FindingContext;
  attackPath?: string[];
}

const AUTHORITY_NAME = /^(authority|owner|admin|signer|creator|manager|operator|withdrawer)$/;
const UNCHECKED = /^(AccountInfo|UncheckedAccount)\b/;

export function indexAnchor(source: string): AnchorIndex {
  const code = stripComments(source);
  const lineAt = lineIndex(code);
  const accounts: AnchorAccountsStruct[] = [];
  const dataStructs = new Map<string, string[]>();
  for (const match of code.matchAll(/#\[derive\(([^)]*)\)\]\s*pub\s+struct\s+([A-Za-z_]\w*)(<[^>{]*>)?\s*\{/g)) {
    if (!/\bAccounts\b/.test(match[1] ?? "")) continue;
    const open = (match.index ?? 0) + match[0].length - 1;
    const close = matchBrace(code, open);
    accounts.push({ name: match[2] ?? "", line: lineAt(match.index ?? 0), fields: parseFields(code, open + 1, close - 1, lineAt) });
  }
  for (const match of code.matchAll(/#\[account(\([^)]*\))?\]\s*(?:#\[[^\]]*\]\s*)*pub\s+struct\s+([A-Za-z_]\w*)\s*\{/g)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    const close = matchBrace(code, open);
    const body = code.slice(open + 1, close - 1);
    const keys = [...body.matchAll(/pub\s+([A-Za-z_]\w*)\s*:\s*Pubkey\b/g)].map((item) => item[1] ?? "");
    dataStructs.set(match[2] ?? "", keys);
  }
  const instructions = [...code.matchAll(/pub\s+fn\s+([A-Za-z_]\w*)\s*(<[^>]*>)?\s*\(\s*ctx\s*:\s*Context/g)].map((item) => item[1] ?? "");
  return { accounts, dataStructs, instructions };
}

function parseFields(code: string, start: number, end: number, lineAt: (offset: number) => number): AnchorField[] {
  const fields: AnchorField[] = [];
  let attrs: string[] = [];
  const body = code.slice(start, end);
  const token = /#\[account(\((?:[^()]|\([^()]*\))*\))?\]|(?:pub(?:\([^)]*\))?\s+)?([A-Za-z_]\w*)\s*:\s*([^,]+?(?:<[^>]*>)?)\s*(,|$)/g;
  for (const match of body.matchAll(token)) {
    if (match[0].startsWith("#[")) { attrs.push(match[1] ?? ""); continue; }
    fields.push({ name: match[2] ?? "", type: (match[3] ?? "").replace(/\s+/g, " ").trim(), constraints: attrs.join(" "), line: lineAt(start + (match.index ?? 0)) });
    attrs = [];
  }
  return fields;
}

function typeArg(type: string): string | undefined {
  const match = type.match(/^(?:Box<\s*)?Account(?:Loader)?\s*<\s*'info\s*,\s*([A-Za-z_]\w*)/);
  return match?.[1];
}

export function discoverAnchor(source: SourceFile): AnchorDraft[] {
  const raw = source.content;
  const code = stripComments(raw);
  if (!/anchor_lang|#\[derive\([^)]*Accounts/.test(code)) return [];
  const index = indexAnchor(raw);
  const drafts: AnchorDraft[] = [];
  const ev = (line: number, rationale: string, operation: string, kind: "observed" | "derived" = "observed") => evidenceAt(source.path, raw, line, rationale, "srp-anchor", operation, kind);
  const checksSignerManually = /\.is_signer\b/.test(code);

  for (const struct of index.accounts) {
    const names = new Set(struct.fields.map((field) => field.name));
    for (const field of struct.fields) {
      // 1. Authority-looking account that is never required to sign.
      // A signer check done by hand, or an account handed to a CPI whose callee (e.g. SPL Token) enforces the signature.
      const manualSigner = new RegExp(`accounts\\.${field.name}\\.is_signer\\b`).test(code)
        || (/\binvoke(_signed)?\s*\(/.test(code) && new RegExp(`invoke(_signed)?\\s*\\([\\s\\S]*accounts\\.${field.name}\\.(clone|key|to_account_info)`).test(code));
      if (AUTHORITY_NAME.test(field.name) && UNCHECKED.test(field.type) && !/\bsigner\b/.test(field.constraints) && !manualSigner) {
        drafts.push({
          detector: "solana-missing-signer",
          title: `Missing signer: ${struct.name}.${field.name} is ${field.type.split("<")[0]}, not Signer`,
          severity: "critical",
          impact: "Anyone can pass the real authority's public key without its signature and act as that authority.",
          remediation: `Declare ${field.name} as Signer<'info> (or add the signer constraint) and bind it to stored state with has_one.`,
          confidence: checksSignerManually ? 0.5 : 0.8,
          evidence: [ev(field.line, `${field.name} is typed ${field.type} with no signer constraint.`, "solana-missing-signer")],
          context: { function: struct.name, facts: [`${struct.name}.${field.name} at L${field.line} is ${field.type}`, "no signer constraint on the field", checksSignerManually ? "code checks is_signer somewhere; confirm it covers this account" : "no is_signer check anywhere in the file"] },
          attackPath: ["Attacker reads the victim authority pubkey from the vault account", `Attacker builds the ${struct.name} instruction passing that pubkey as ${field.name}`, "Program never checks the signature", "Attacker withdraws or reconfigures as the authority"]
        });
      }
      // 2. Account data has an authority key, the instruction has a matching account, but nothing ties them together.
      const dataType = typeArg(field.type);
      const keys = dataType ? index.dataStructs.get(dataType) ?? [] : [];
      for (const key of keys) {
        if (!AUTHORITY_NAME.test(key) || !names.has(key) || /\binit\b/.test(field.constraints)) continue;
        const bound = new RegExp(`has_one\\s*=\\s*${key}\\b|constraint\\s*=[^,]*\\b${key}\\b`).test(field.constraints)
          || new RegExp(`${field.name}\\.${key}\\s*[!=]=|require_keys_eq!\\([^)]*${key}`).test(code);
        if (bound) continue;
        const authorityField = struct.fields.find((item) => item.name === key);
        drafts.push({
          detector: "solana-missing-has-one",
          title: `Missing has_one: ${struct.name}.${field.name}.${key} is never compared to the ${key} account`,
          severity: "high",
          impact: `A signer can pass someone else's ${dataType} account and act on it as if they were its ${key}.`,
          remediation: `Add has_one = ${key} to the #[account(...)] constraint on ${field.name}.`,
          confidence: 0.72,
          evidence: [
            ev(field.line, `${field.name} holds ${dataType}, which stores ${key}: Pubkey.`, "solana-missing-has-one"),
            ...(authorityField ? [ev(authorityField.line, `${key} is passed separately and never bound to ${field.name}.${key}.`, "solana-missing-has-one", "derived")] : [])
          ],
          context: { function: struct.name, facts: [`${dataType} stores ${key}: Pubkey`, `${struct.name} takes a ${key} account (L${authorityField?.line})`, `no has_one = ${key} or constraint on ${field.name} (L${field.line})`] },
          attackPath: ["Attacker signs with their own key as the authority", `Attacker passes the victim's ${dataType} account as ${field.name}`, `Program never checks ${field.name}.${key} == ${key}`, "Attacker moves the victim's funds"]
        });
      }
      // 3. init_if_needed lets an attacker hit the init branch's assumptions on an existing account.
      if (/\binit_if_needed\b/.test(field.constraints) && !/is_initialized|initialized\s*==|already_initialized/i.test(code)) {
        drafts.push({
          detector: "solana-init-if-needed-reinit",
          title: `Reinitialization risk: ${struct.name}.${field.name} uses init_if_needed`,
          severity: "medium",
          impact: "If the handler writes initial state unconditionally, a second call resets the account (authority, balances, counters).",
          remediation: "Use init, or guard the handler with an is_initialized flag before writing initial values.",
          confidence: 0.55,
          evidence: [ev(field.line, "init_if_needed with no is_initialized guard in the file.", "solana-init-if-needed-reinit")],
          context: { function: struct.name, facts: [`init_if_needed on ${field.name} (L${field.line})`, "no is_initialized check found"] }
        });
      }
      // 4. Program account taken as AccountInfo with no address pin, used for CPI.
      if (/program/i.test(field.name) && UNCHECKED.test(field.type) && !/\baddress\s*=/.test(field.constraints) && /\binvoke(_signed)?\s*\(|CpiContext::new/.test(code)) {
        const pinned = new RegExp(`${field.name}\\.key(\\s*\\(\\))?\\s*[!=]=|[!=]=\\s*&?\\s*ctx\\.accounts\\.${field.name}\\.key\\b|require_keys_eq!\\([^)]*${field.name}`).test(code);
        if (!pinned) {
          drafts.push({
            detector: "solana-arbitrary-cpi",
            title: `Arbitrary CPI: ${struct.name}.${field.name} is not pinned to a program id`,
            severity: "high",
            impact: "The caller supplies the program that receives the CPI, so the signed accounts and seeds go to attacker code.",
            remediation: `Type ${field.name} as Program<'info, T> or add address = <PROGRAM_ID>.`,
            confidence: 0.7,
            evidence: [ev(field.line, `${field.name} is ${field.type} with no address constraint and the file performs CPI.`, "solana-arbitrary-cpi")],
            context: { function: struct.name, facts: [`${field.name} typed ${field.type} (L${field.line})`, "no address constraint or key comparison", "file calls invoke/invoke_signed/CpiContext"] }
          });
        }
      }
    }
  }
  for (const struct of index.accounts) {
    // 9. Two accounts of the same type that are never required to differ.
    const byType = new Map<string, AnchorField[]>();
    for (const field of struct.fields) {
      const dataType = typeArg(field.type);
      if (dataType && !/\binit\b/.test(field.constraints)) byType.set(dataType, [...(byType.get(dataType) ?? []), field]);
    }
    for (const [dataType, group] of byType) {
      if (group.length < 2) continue;
      const [a, b] = group as [AnchorField, AnchorField];
      const compared = new RegExp(`${a.name}\\.key\\(\\)\\s*[!=]=\\s*[^;\\n]*${b.name}|${b.name}\\.key\\(\\)\\s*[!=]=\\s*[^;\\n]*${a.name}`).test(code)
        || new RegExp(`constraint\\s*=[^\\]]*(${a.name}|${b.name})\\.key\\(\\)\\s*!=`).test(a.constraints + " " + b.constraints);
      const written = new RegExp(`accounts\\.(${a.name}|${b.name})\\b`).test(code);
      const allConstraints = struct.fields.map((field) => field.constraints).join(" ");
      const pinnedByHasOne = [a, b].every((field) => new RegExp(`has_one\\s*=\\s*${field.name}\\b`).test(allConstraints));
      if (compared || !written || pinnedByHasOne) continue;
      drafts.push({
        detector: "solana-duplicate-mutable-accounts",
        title: `Duplicate mutable accounts: ${struct.name}.${a.name} and ${b.name} can be the same ${dataType}`,
        severity: "medium",
        impact: "Passing the same account twice makes later writes overwrite earlier ones or double-counts balances.",
        remediation: `Add constraint = ${a.name}.key() != ${b.name}.key() or check it in the handler.`,
        confidence: 0.58,
        evidence: [ev(a.line, `${a.name} is ${dataType}.`, "solana-duplicate-mutable-accounts"), ev(b.line, `${b.name} is also ${dataType}, and nothing requires them to differ.`, "solana-duplicate-mutable-accounts", "derived")],
        context: { function: struct.name, facts: [`${a.name} (L${a.line}) and ${b.name} (L${b.line}) are both ${dataType}`, "no key inequality check"] }
      });
    }
    for (const field of struct.fields) {
      // 10. Sysvar taken as AccountInfo with no address check.
      if (/^(rent|clock|instructions|instructions_sysvar|recent_blockhashes|slot_hashes|stake_history|epoch_schedule)$/.test(field.name) && UNCHECKED.test(field.type) && !/\baddress\s*=/.test(field.constraints)
        && !new RegExp(`(require_(keys_)?eq!\\([^)]*${field.name}|${field.name}\\.key(\\(\\))?\\s*[!=]=|sysvar::\\w+::check_id\\([^)]*${field.name})`).test(code)) {
        drafts.push({
          detector: "solana-sysvar-address-unchecked",
          title: `Sysvar spoofing: ${struct.name}.${field.name} is not checked against the sysvar id`,
          severity: "high",
          impact: "An attacker passes a fake account with forged sysvar data (e.g. a fake instructions sysvar, the Wormhole exploit pattern).",
          remediation: `Use Sysvar<'info, T>, add address = sysvar::${field.name}::ID, or require_keys_eq! against the id.`,
          confidence: 0.7,
          evidence: [ev(field.line, `${field.name} is ${field.type} with no address check.`, "solana-sysvar-address-unchecked")],
          context: { function: struct.name, facts: [`${field.name} typed ${field.type} (L${field.line})`, "no address constraint or key comparison"] }
        });
      }
    }
  }
  // 11. Manual close that zeroes lamports but leaves data and discriminator (revival attack).
  const closeLine = code.split(/\r?\n/).findIndex((line) => /lamports\.borrow_mut\(\)\s*=\s*0\b/.test(line));
  if (closeLine >= 0 && !/CLOSED_ACCOUNT_DISCRIMINATOR|\.close\s*\(|\bclose\s*=|assign\s*\(\s*&system_program|realloc\s*\(\s*0/.test(code)) {
    drafts.push({
      detector: "solana-manual-close-revival",
      title: "Account closed by zeroing lamports only",
      severity: "medium",
      impact: "Within the same transaction the account can be refunded and reused with its old data, or its discriminator still passes checks.",
      remediation: "Use Anchor's close = destination constraint, or zero the data, set CLOSED_ACCOUNT_DISCRIMINATOR, and assign to the system program.",
      confidence: 0.6,
      evidence: [ev(closeLine + 1, "Lamports set to 0 with no data wipe or close constraint.", "solana-manual-close-revival")]
    });
  }
  // 6-8. Raw AccountInfo data read by hand: owner, type, and field binding checks Anchor would otherwise do.
  const fieldTypes = new Map(index.accounts.flatMap((struct) => struct.fields.map((field) => [field.name, field] as const)));
  const lineAt = lineIndex(code);
  for (const match of code.matchAll(/(?:let\s+(\w+)\s*(?::[^=]+)?=\s*)?([A-Za-z_]\w*)::(unpack|try_from_slice|try_deserialize|deserialize)\s*\(\s*&(?:mut\s+)?(?:\*\s*)?ctx\.accounts\.(\w+)\.(?:data|try_borrow_data)/g)) {
    const variable = match[1];
    const typeName = match[2] ?? "";
    const accountName = match[4] ?? "";
    const field = fieldTypes.get(accountName);
    if (!field || !UNCHECKED.test(field.type)) continue;
    const line = lineAt(match.index ?? 0);
    const ownerChecked = /\bowner\s*=/.test(field.constraints) || new RegExp(`accounts\\.${accountName}\\.owner\\s*[!=]=|[!=]=\\s*&?\\s*ctx\\.accounts\\.${accountName}\\.owner\\b`).test(code);
    if (!ownerChecked) {
      drafts.push({
        detector: "solana-unchecked-account-owner",
        title: `Missing owner check: ${accountName} is deserialized without checking which program owns it`,
        severity: "high",
        impact: "An attacker passes an account they created with the same layout, so the program trusts fake balances or authorities.",
        remediation: `Type ${accountName} as Account<'info, T> (Anchor checks the owner) or compare ctx.accounts.${accountName}.owner to the expected program id before reading.`,
        confidence: 0.74,
        evidence: [ev(line, `${typeName}::${match[3]} reads ${accountName}.data; ${accountName} is ${field.type} with no owner check.`, "solana-unchecked-account-owner"), ev(field.line, `${accountName} declared as ${field.type}.`, "solana-unchecked-account-owner", "derived")],
        context: { function: accountName, facts: [`L${line}: ${typeName}::${match[3]} on ctx.accounts.${accountName}`, `${accountName} is ${field.type} (L${field.line})`, `no owner constraint or .owner comparison on ${accountName}`] },
        attackPath: [`Attacker creates an account owned by their own program with ${typeName} layout`, `Attacker passes it as ${accountName}`, "Program deserializes without checking the owner", "Program acts on attacker-written data"]
      });
    }
    if (match[3] === "try_from_slice" && !/discriminant|discriminator/i.test(code)) {
      drafts.push({
        detector: "solana-type-cosplay",
        title: `Type cosplay: ${typeName} is read from ${accountName} with no discriminator`,
        severity: "medium",
        impact: "Another account type of the same program with a compatible layout can be passed in its place.",
        remediation: `Use #[account] types (8-byte discriminator) or store and check a discriminant field on ${typeName}.`,
        confidence: 0.6,
        evidence: [ev(line, `Borsh try_from_slice of ${typeName} without a discriminator check.`, "solana-type-cosplay")],
        context: { function: accountName, facts: [`L${line}: ${typeName}::try_from_slice`, "no discriminant/discriminator anywhere in the file"] }
      });
    }
    if (variable && match[3] === "unpack" && /Token/i.test(typeName) && !new RegExp(`\\b${variable}\\.owner\\b`).test(code)) {
      drafts.push({
        detector: "solana-account-data-matching",
        title: `Account data matching: ${variable}.owner is never compared to the signer`,
        severity: "high",
        impact: "Anyone can pass someone else's token account and the program treats it as theirs.",
        remediation: `Check ${variable}.owner == authority.key (or use Account<'info, TokenAccount> with token::authority = authority).`,
        confidence: 0.68,
        evidence: [ev(line, `${variable} is unpacked from ${accountName} and its owner is never checked.`, "solana-account-data-matching")],
        context: { function: accountName, facts: [`L${line}: ${variable} = ${typeName}::unpack(${accountName})`, `${variable}.owner is not referenced`] }
      });
    }
  }
  // 5. Non-canonical bump: create_program_address with a caller-supplied bump.
  const lines = code.split(/\r?\n/);
  const createLine = lines.findIndex((line) => /create_program_address\s*\(/.test(line));
  if (createLine >= 0 && !/find_program_address\s*\(/.test(code)) {
    drafts.push({
      detector: "solana-pda-noncanonical-bump",
      title: "PDA derived with create_program_address and a supplied bump",
      severity: "medium",
      impact: "Several bumps can yield valid PDAs. Accepting any of them lets one logical account exist at several addresses.",
      remediation: "Derive with find_program_address (canonical bump) or use Anchor seeds + bump constraints and store the canonical bump.",
      confidence: 0.55,
      evidence: [ev(createLine + 1, "create_program_address with no find_program_address in the file.", "solana-pda-noncanonical-bump")]
    });
  }
  return drafts;
}
