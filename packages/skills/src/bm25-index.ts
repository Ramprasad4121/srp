/**
 * BM25 (Okapi BM25) full-text index — no external dependencies.
 * Standard parameters: k1=1.5, b=0.75.
 */

const K1 = 1.5;
const B = 0.75;

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","up","about","into","is","are","was","were","be","been",
  "being","have","has","had","do","does","did","will","would","could",
  "should","may","might","can","not","no","so","that","this","those",
  "these","then","there","when","where","who","which","what","how","any",
  "all","some","more","most","very","just","also","as","it","its","if",
]);

export interface IndexedDoc {
  readonly skillId: string;
  readonly termFreqs: ReadonlyMap<string, number>;
  readonly docLen: number;
}

export interface Bm25Index {
  readonly docs: readonly IndexedDoc[];
  readonly idf: ReadonlyMap<string, number>;
  readonly avgDocLen: number;
}

export interface ScoredSkill {
  readonly skillId: string;
  readonly score: number;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

export function buildBm25Index(
  skills: ReadonlyArray<{
    id: string;
    content: string;
    description?: string;
    name?: string;
    tags?: readonly string[];
  }>
): Bm25Index {
  const docs: IndexedDoc[] = [];

  for (const skill of skills) {
    const text = [
      skill.name ?? "",
      skill.description ?? "",
      (skill.tags ?? []).join(" "),
      skill.content,
    ].join(" ");

    const tokens = tokenize(text);
    const termFreqs = new Map<string, number>();
    for (const token of tokens) {
      termFreqs.set(token, (termFreqs.get(token) ?? 0) + 1);
    }
    docs.push({ skillId: skill.id, termFreqs, docLen: tokens.length });
  }

  const N = docs.length;
  const avgDocLen = docs.reduce((s, d) => s + d.docLen, 0) / (N || 1);

  const docFreq = new Map<string, number>();
  for (const doc of docs) {
    for (const term of doc.termFreqs.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }

  return { docs, idf, avgDocLen };
}

export function queryBm25(
  index: Bm25Index,
  query: string,
  topK: number
): ScoredSkill[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const scores = new Map<string, number>();

  for (const doc of index.docs) {
    let score = 0;
    for (const term of queryTerms) {
      const termIdf = index.idf.get(term) ?? 0;
      if (termIdf === 0) continue;
      const tf = doc.termFreqs.get(term) ?? 0;
      if (tf === 0) continue;
      const numerator = tf * (K1 + 1);
      const denominator =
        tf + K1 * (1 - B + B * (doc.docLen / index.avgDocLen));
      score += termIdf * (numerator / denominator);
    }
    if (score > 0) scores.set(doc.skillId, score);
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([skillId, score]) => ({ skillId, score }));
}
