export function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((current[j - 1] ?? 0) + 1, (previous[j] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/**
 * Spelling / alternative suggestions for a failed search (PRD 5.3, edge case 6).
 * Matches vocabulary terms that contain the input or are within a small edit distance of the
 * whole term or of any of its words.
 */
export function findSimilarTerms(input: string, vocabulary: readonly string[], limit = 3): string[] {
  const term = input.trim().toLowerCase();
  if (term.length < 2) return [];

  const seen = new Set<string>();
  const scored: { value: string; score: number }[] = [];

  for (const candidate of vocabulary) {
    const lower = candidate.toLowerCase();
    if (lower === term || seen.has(lower)) continue;
    seen.add(lower);

    if (lower.includes(term)) {
      scored.push({ value: candidate, score: 0 });
      continue;
    }
    if (term.length < 4) continue;

    // Whole-term typos get a looser allowance than single-word matches, so "phones" is not
    // offered "Mens Shoes" just because "shoes" is two edits away.
    const wholeDistance = levenshtein(term, lower);
    const wordDistance = Math.min(...lower.split(/[\s-]+/).map((word) => levenshtein(term, word)));
    const wholeOk = wholeDistance <= Math.ceil(term.length / 3);
    const wordOk = wordDistance <= Math.floor(term.length / 4);
    if (wholeOk || wordOk) scored.push({ value: candidate, score: Math.min(wholeOk ? wholeDistance : Infinity, wordOk ? wordDistance : Infinity) });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map((item) => item.value);
}

/**
 * Reduces a word to a stem so plurals match ("headphones" and "headphone", "watches" and "watch").
 * Deliberately tiny: it only has to treat both sides of a comparison the same way.
 */
export function stemWord(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (/(ch|sh|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Lower-case word stems of a text; apostrophes are dropped so "men's" and "mens" are the same word. */
export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['\u2019`]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stemWord);
}
