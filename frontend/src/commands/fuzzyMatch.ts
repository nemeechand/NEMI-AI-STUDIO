/**
 * Subsequence fuzzy match (VS Code's own Quick Open/Command Palette use the
 * same core idea): every character of `query`, in order, must appear
 * somewhere in `text` — not necessarily contiguous. Returns null if it
 * doesn't match, or a score (lower is better) favoring earlier and tighter
 * matches so `main.ts` for example ranks "main.ts" above
 * "some/other/main-thing.ts".
 */
export function fuzzyScore(query: string, text: string): number | null {
  if (query.length === 0) return 0;
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  let textIndex = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -1;

  for (let queryIndex = 0; queryIndex < lowerQuery.length; queryIndex++) {
    const char = lowerQuery[queryIndex];
    const foundAt = lowerText.indexOf(char, textIndex);
    if (foundAt === -1) return null;
    if (firstMatchIndex === -1) firstMatchIndex = foundAt;
    lastMatchIndex = foundAt;
    textIndex = foundAt + 1;
  }

  const span = lastMatchIndex - firstMatchIndex + 1;
  return firstMatchIndex + span;
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  limit = 50,
): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
    .filter((entry): entry is { item: T; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}
