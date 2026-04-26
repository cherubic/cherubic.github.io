import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function getSortedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function paginatePosts(
  posts: Post[],
  page: number,
  pageSize: number,
): { posts: Post[]; totalPages: number; currentPage: number } {
  const totalPages = Math.ceil(posts.length / pageSize);
  const start = (page - 1) * pageSize;
  return {
    posts: posts.slice(start, start + pageSize),
    totalPages,
    currentPage: page,
  };
}

export function getReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export async function getRecentPosts(n: number): Promise<Post[]> {
  const posts = await getSortedPosts();
  return posts.slice(0, n);
}

export async function getPopularTags(
  n: number,
): Promise<Array<{ tag: string; count: number }>> {
  const posts = await getCollection('posts');
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag, count]) => ({ tag, count }));
}

interface CatNode {
  name: string;
  count: number;
  children: CatNode[];
}

export async function getCategoryTree(): Promise<CatNode[]> {
  const posts = await getCollection('posts');
  const tree = new Map<string, { count: number; children: Map<string, number> }>();

  for (const post of posts) {
    const [parent, child] = post.data.categories;
    if (!parent) continue;
    const node = tree.get(parent) ?? { count: 0, children: new Map() };
    node.count++;
    if (child) node.children.set(child, (node.children.get(child) ?? 0) + 1);
    tree.set(parent, node);
  }

  return [...tree.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, { count, children }]) => ({
      name,
      count,
      children: [...children.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([n, c]) => ({ name: n, count: c, children: [] })),
    }));
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getSortedPosts();
  return posts.filter(p => p.data.tags.includes(tag));
}

export async function getRelatedPosts(post: Post, n: number): Promise<Post[]> {
  const all = await getSortedPosts();
  const scored = all
    .filter(p => p.slug !== post.slug)
    .map(p => {
      const tagOverlap = p.data.tags.filter(t => post.data.tags.includes(t)).length;
      const catOverlap = p.data.categories.filter(c => post.data.categories.includes(c)).length;
      return { post: p, score: tagOverlap * 2 + catOverlap };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, n).map(x => x.post);
}
