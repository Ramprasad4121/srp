/**
 * Minimal structural index for Solidity sources.
 *
 * Not a full parser. It strips comments and string contents (keeping offsets and line numbers),
 * finds functions with their visibility, modifiers, parameters and bodies, and lists contract
 * state variables. Detectors use it to reason per function instead of per file.
 */

export interface SolidityFunction {
  name: string;
  kind: "function" | "receive" | "fallback" | "constructor" | "modifier";
  visibility: "public" | "external" | "internal" | "private";
  mutability: "view" | "pure" | "payable" | "nonpayable";
  modifiers: string[];
  params: string[];
  /** Offset of the opening brace of the body in the stripped source. */
  bodyStart: number;
  /** Offset just after the closing brace. */
  bodyEnd: number;
  startLine: number;
  endLine: number;
  body: string;
  /** True when the function sits inside a `library` block. */
  inLibrary: boolean;
}

export interface SolidityIndex {
  /** Source with comments and string contents blanked. Same length and line breaks as the input. */
  code: string;
  functions: SolidityFunction[];
  stateVariables: string[];
  lineAt(offset: number): number;
}

const NON_MODIFIER_WORDS = new Set(["public", "external", "internal", "private", "view", "pure", "payable", "virtual", "override", "returns", "constant", "nonpayable"]);

/** Blank comments and string literal contents, preserving length and newlines. Works for Solidity and Rust. */
export function stripComments(source: string): string {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") { out += " "; index += 1; }
      continue;
    }
    if (char === "/" && next === "*") {
      out += "  ";
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        out += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (index < source.length) { out += "  "; index += 2; }
      continue;
    }
    if (char === '"') {
      out += char;
      index += 1;
      while (index < source.length && source[index] !== '"' && source[index] !== "\n") {
        if (source[index] === "\\" && index + 1 < source.length) { out += "  "; index += 2; continue; }
        out += " ";
        index += 1;
      }
      if (index < source.length) { out += source[index]; index += 1; }
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

export function lineIndex(text: string): (offset: number) => number {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) if (text[index] === "\n") starts.push(index + 1);
  return (offset: number) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if ((starts[mid] ?? 0) <= offset) low = mid; else high = mid - 1;
    }
    return low + 1;
  };
}

export function matchBrace(code: string, open: number): number {
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return code.length;
}

function matchParen(code: string, open: number): number {
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === "(") depth += 1;
    else if (code[index] === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return code.length;
}

export function indexSolidity(source: string): SolidityIndex {
  const code = stripComments(source);
  const lineAt = lineIndex(code);
  const functions: SolidityFunction[] = [];
  const libraries: Array<[number, number]> = [];
  for (const lib of code.matchAll(/\blibrary\s+[A-Za-z_]\w*\s*\{/g)) {
    const open = (lib.index ?? 0) + lib[0].length - 1;
    libraries.push([open, matchBrace(code, open)]);
  }
  const header = /\b(function\s+([A-Za-z_]\w*)|receive|fallback|constructor|modifier\s+([A-Za-z_]\w*))\s*\(/g;
  for (const match of code.matchAll(header)) {
    const start = match.index ?? 0;
    const parenOpen = start + match[0].length - 1;
    const parenClose = matchParen(code, parenOpen);
    // Header runs until the body brace or a ';' (interface / abstract declaration).
    let cursor = parenClose;
    while (cursor < code.length && code[cursor] !== "{" && code[cursor] !== ";") cursor += 1;
    if (code[cursor] !== "{") continue;
    const headerText = code.slice(parenClose, cursor).replace(/returns\s*\([^)]*\)/g, " ");
    const words = [...headerText.matchAll(/([A-Za-z_]\w*)(\s*\([^)]*\))?/g)].map((item) => item[1] ?? "");
    const bodyEnd = matchBrace(code, cursor);
    const keyword = match[1] ?? "";
    const kind: SolidityFunction["kind"] = keyword.startsWith("function") ? "function" : keyword.startsWith("modifier") ? "modifier" : keyword as SolidityFunction["kind"];
    const name = match[2] ?? match[3] ?? keyword;
    const visibility = (words.find((word) => ["public", "external", "internal", "private"].includes(word)) as SolidityFunction["visibility"] | undefined)
      ?? (kind === "receive" || kind === "fallback" ? "external" : kind === "modifier" ? "internal" : "public");
    const mutability = (words.find((word) => ["view", "pure", "payable"].includes(word)) as SolidityFunction["mutability"] | undefined) ?? "nonpayable";
    const params = code.slice(parenOpen + 1, parenClose - 1)
      .split(",")
      .map((param) => param.trim().split(/\s+/).at(-1) ?? "")
      .filter((param) => /^[A-Za-z_]\w*$/.test(param));
    functions.push({
      name,
      kind,
      visibility,
      mutability,
      modifiers: words.filter((word) => word && !NON_MODIFIER_WORDS.has(word)),
      params,
      bodyStart: cursor,
      bodyEnd,
      startLine: lineAt(start),
      endLine: lineAt(bodyEnd - 1),
      body: code.slice(cursor, bodyEnd),
      inLibrary: libraries.some(([open, close]) => start > open && start < close)
    });
  }
  return { code, functions, stateVariables: findStateVariables(code), lineAt };
}

/** State variables are declarations at depth 1 inside a contract, library, or abstract contract body. */
function findStateVariables(code: string): string[] {
  const vars = new Set<string>();
  for (const contract of code.matchAll(/\b(contract|abstract\s+contract|library)\s+[A-Za-z_]\w*[^{]*\{/g)) {
    const open = (contract.index ?? 0) + contract[0].length - 1;
    const close = matchBrace(code, open);
    let depth = 0;
    let statement = "";
    for (let index = open + 1; index < close - 1; index += 1) {
      const char = code[index];
      if (char === "{") { depth += 1; statement = ""; continue; }
      if (char === "}") { depth -= 1; statement = ""; continue; }
      if (depth > 0) continue;
      if (char === ";") {
        const text = statement.trim();
        statement = "";
        if (!text || /^(using|event|error|import|pragma)\b/.test(text)) continue;
        const left = text.split(/(?<![=!<>])=(?![=>])/)[0]?.trim() ?? "";
        const name = left.split(/\s+/).at(-1);
        if (name && /^[A-Za-z_]\w*$/.test(name) && !/\b(constant|immutable)\b/.test(left)) vars.add(name);
        continue;
      }
      statement += char;
    }
  }
  return [...vars];
}

export interface StateWrite {
  variable: string;
  offset: number;
  /** The written expression up to the operator, e.g. `balances[msg.sender]`. */
  target: string;
}

/** Writes to contract state variables inside a function body (offsets are absolute in the stripped code). */
export function stateWrites(fn: SolidityFunction, stateVariables: string[]): StateWrite[] {
  if (!stateVariables.length) return [];
  const names = stateVariables.map((name) => name.replace(/[$]/g, "\\$")).join("|");
  const assign = new RegExp(`(?<![\\w.])(${names})\\s*((?:\\[[^\\]]*\\]|\\.[A-Za-z_]\\w*)\\s*)*(\\+=|-=|\\*=|/=|\\|=|&=|=(?!=)|\\+\\+|--)`, "g");
  const del = new RegExp(`\\bdelete\\s+(${names})\\b`, "g");
  const prefix = new RegExp(`(\\+\\+|--)\\s*(${names})\\b`, "g");
  const writes: StateWrite[] = [];
  for (const match of fn.body.matchAll(assign)) writes.push({ variable: match[1] ?? "", offset: fn.bodyStart + (match.index ?? 0), target: match[0].replace(/(\+=|-=|\*=|\/=|\|=|&=|=|\+\+|--)$/, "").replace(/\s+/g, "") });
  for (const match of fn.body.matchAll(del)) writes.push({ variable: match[1] ?? "", offset: fn.bodyStart + (match.index ?? 0), target: match[1] ?? "" });
  for (const match of fn.body.matchAll(prefix)) writes.push({ variable: match[2] ?? "", offset: fn.bodyStart + (match.index ?? 0), target: match[2] ?? "" });
  // Local declarations shadowing a state variable name are not state writes.
  return writes
    .filter((write) => !new RegExp(`\\b(uint\\d*|int\\d*|address|bool|bytes\\d*|string|memory|storage)\\s+${write.variable}\\b`).test(fn.body))
    .sort((a, b) => a.offset - b.offset);
}

/** True when a function body checks the caller (require/if/assert on msg.sender, or OZ internal checks). */
/** The innermost function whose body contains offset, if any. */
export function enclosingFunction(index: SolidityIndex, offset: number): SolidityFunction | undefined {
  return index.functions
    .filter((fn) => offset >= fn.bodyStart && offset < fn.bodyEnd)
    .sort((a, b) => (a.bodyEnd - a.bodyStart) - (b.bodyEnd - b.bodyStart))[0];
}

export function checksCaller(fn: SolidityFunction): boolean {
  return /(require|if|assert)\s*\([^;{]*(msg\.sender|_msgSender\s*\(\s*\))|(msg\.sender|_msgSender\s*\(\s*\))\s*!=|\b_check\w*\s*\(|\b_authorize\w*\s*\(|_onlyOwner\s*\(|onlyOwner\s*\(|hasRole\s*\(|\bauth\s*\(/.test(fn.body);
}
