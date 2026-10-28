export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isHit(haystack: string, term: string): boolean {
  const h = normalizeText(haystack);
  const t = normalizeText(term);
  if (!t) return false;
  return h.includes(t) || h.includes(t.replace(/\s+/g, ''));
}

export function computeHits(text: string, terms: string[]): { hits: string[]; missing: string[]; coveragePct: number } {
  const hits: string[] = [];
  const missing: string[] = [];
  for (const t of terms) (isHit(text, t) ? hits : missing).push(t);
  const total = terms.length;
  return { hits, missing, coveragePct: total === 0 ? 0 : Math.round((hits.length / total) * 100) };
}