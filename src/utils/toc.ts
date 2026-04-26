export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3 | 4;
}

export function buildTocFromHeadings(
  headings: Array<{ depth: number; slug: string; text: string }>,
): TocItem[] {
  return headings
    .filter(h => h.depth >= 2 && h.depth <= 4)
    .map(h => ({ id: h.slug, text: h.text, depth: h.depth as 2 | 3 | 4 }));
}
