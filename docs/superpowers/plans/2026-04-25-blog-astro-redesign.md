# 博客 Astro 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Jekyll/Chirpy 博客完整重构为 Astro 5 + Terminal 风格设计，保留所有原有功能。

**Architecture:** Astro 5 + Content Collections + TypeScript；CSS 直接采用设计稿 5 个文件（tokens / layout / content / pages / terminal）；rehype 插件为代码块注入自定义 chrome；Pagefind 静态全文搜索；GitHub Actions 部署。

**Tech Stack:** Astro 5, TypeScript, Content Collections, Shiki, rehype, Pagefind, Giscus, pnpm, GitHub Actions

**设计稿 CSS 来源：** `/tmp/design-extract/blog/project/styles/`

---

## 文件结构

```
src/
├── content/config.ts + posts/
├── components/layout/{Sidebar,TopBar,RightPanel}.astro
├── components/post/{ArticleCard,PostFooter}.astro
├── components/ui/SearchPanel.astro
├── layouts/{BaseLayout,PostLayout}.astro
├── pages/{index,archive,categories,about,404,feed.xml}.astro
│         page/[page].astro
│         posts/[slug].astro
│         tags/{index,[tag]}.astro
└── utils/{posts,toc}.ts
plugins/rehype-codeblock.mjs
scripts/migrate-posts.mjs
public/styles/{tokens,layout,content,pages,terminal}.css + CNAME
```


---

## Task 1: 初始化 Astro 项目

**Files:** Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `public/CNAME`, `src/pages/index.astro`

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "cherubic-blog",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && pagefind --site dist",
    "preview": "astro preview",
    "check": "astro check"
  },
  "dependencies": {
    "astro": "^5.7.0",
    "@astrojs/mdx": "^4.2.0",
    "@astrojs/sitemap": "^3.2.0",
    "pagefind": "^1.3.0",
    "remark-math": "^6.0.0",
    "rehype-katex": "^7.0.0",
    "unist-util-visit": "^5.0.0"
  },
  "devDependencies": {
    "gray-matter": "^4.0.3",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 创建 `astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeCodeblock from './plugins/rehype-codeblock.mjs';

export default defineConfig({
  site: 'https://xandersu.com',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-dark', wrap: false },
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeCodeblock, rehypeKatex],
  },
});
```

- [ ] **Step 3: 创建 `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

- [ ] **Step 4: 创建目录结构**

```bash
mkdir -p src/content/posts src/components/layout src/components/post src/components/ui
mkdir -p src/layouts src/pages/posts src/pages/page src/pages/tags src/utils
mkdir -p plugins scripts public/styles
```

- [ ] **Step 5: 创建 `public/CNAME`**（内容仅一行）

```
xandersu.com
```

- [ ] **Step 6: 创建临时 `src/pages/index.astro`**

```astro
---
---
<html><body><h1>ok</h1></body></html>
```

- [ ] **Step 7: 安装依赖并验证**

```bash
pnpm install
pnpm dev
```

预期：终端输出 `Local: http://localhost:4321/`。Ctrl+C 停止。

- [ ] **Step 8: 提交**

```bash
git add package.json astro.config.mjs tsconfig.json public/CNAME src/pages/index.astro
git commit -m "feat: 初始化 Astro 项目"
```


---

## Task 2: 设计稿 CSS + rehype-codeblock 插件

**Files:** Create: `public/styles/*.css`, `plugins/rehype-codeblock.mjs`

- [ ] **Step 1: 复制设计稿 CSS**

```bash
cp /tmp/design-extract/blog/project/styles/tokens.css public/styles/
cp /tmp/design-extract/blog/project/styles/layout.css public/styles/
cp /tmp/design-extract/blog/project/styles/content.css public/styles/
cp /tmp/design-extract/blog/project/styles/pages.css public/styles/
cp /tmp/design-extract/blog/project/styles/terminal.css public/styles/
```

- [ ] **Step 2: 在 `public/styles/tokens.css` 第一行插入 Google Fonts**

在文件最顶部（第1行前）插入：
```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap");
```

- [ ] **Step 3: 在 `public/styles/pages.css` 末尾追加 KaTeX 样式**

```css
@import url("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css");
```

- [ ] **Step 4: 创建 `plugins/rehype-codeblock.mjs`**

此插件将 Shiki 输出的 `<pre>` 包裹在 `.codeblock` 结构中，加入语言标签和复制按钮。

```javascript
import { visit } from 'unist-util-visit';

export default function rehypeCodeblock() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre') return;
      const codeEl = node.children?.find(c => c.tagName === 'code');
      if (!codeEl) return;

      const langClass = codeEl.properties?.className?.find(
        c => typeof c === 'string' && c.startsWith('language-')
      );
      const lang = langClass ? langClass.replace('language-', '') : '';

      const wrapper = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['codeblock', 'variant-terminal'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['codeblock-chrome'] },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['codeblock-lang'] },
                children: [{ type: 'text', value: lang.toUpperCase() }],
              },
              {
                type: 'element',
                tagName: 'button',
                properties: { className: ['codeblock-copy'], 'data-copy': 'true' },
                children: [{ type: 'text', value: 'copy' }],
              },
            ],
          },
          node,
        ],
      };

      parent.children.splice(index, 1, wrapper);
    });
  };
}
```

- [ ] **Step 5: 验证并提交**

```bash
pnpm check
git add public/styles/ plugins/rehype-codeblock.mjs
git commit -m "feat: 设计稿 CSS + rehype-codeblock 插件"
```


---

## Task 3: Content Collections Schema + 迁移脚本

**Files:** Create: `src/content/config.ts`, `scripts/migrate-posts.mjs`

- [ ] **Step 1: 创建 `src/content/config.ts`**

```typescript
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    pin: z.boolean().default(false),
    authors: z.array(z.string()).default(['xander']),
    description: z.string().default(''),
    image: z.string().optional(),
    math: z.boolean().default(false),
    mermaid: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

- [ ] **Step 2: 创建 `scripts/migrate-posts.mjs`**

```javascript
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

const SRC = '_posts';
const DEST = 'src/content/posts';

const files = await readdir(SRC);
let ok = 0, skip = 0, errors = [];

for (const file of files) {
  if (!file.endsWith('.md')) { skip++; continue; }
  try {
    const raw = await readFile(join(SRC, file), 'utf-8');
    const { data, content } = matter(raw);

    const dateObj = data.date instanceof Date ? data.date : new Date(String(data.date));
    const dateStr = dateObj.toISOString().slice(0, 10);
    const updatedObj = data.last_modified_at ? new Date(String(data.last_modified_at)) : null;

    const newData = {
      title: String(data.title ?? ''),
      date: dateStr,
      ...(updatedObj ? { updated: updatedObj.toISOString().slice(0, 10) } : {}),
      categories: Array.isArray(data.categories) ? data.categories
        : (data.categories ? [data.categories] : []),
      tags: Array.isArray(data.tags) ? data.tags
        : (data.tags ? [data.tags] : []),
      pin: Boolean(data.pin ?? data.pinned ?? false),
      authors: data.author ? [String(data.author)]
        : (Array.isArray(data.authors) ? data.authors : ['xander']),
      description: String(data.description ?? data.excerpt ?? ''),
      ...(data.image ? { image: String(data.image) } : {}),
      math: Boolean(data.math ?? false),
      mermaid: Boolean(data.mermaid ?? false),
    };

    await writeFile(join(DEST, file), matter.stringify(content, newData), 'utf-8');
    ok++;
    console.log(`OK ${file}`);
  } catch (e) {
    errors.push({ file, error: e.message });
    console.error(`ERR ${file}: ${e.message}`);
  }
}

console.log(`\n迁移完成: ${ok} 成功, ${skip} 跳过, ${errors.length} 错误`);
if (errors.length) process.exit(1);
```

- [ ] **Step 3: 运行迁移脚本**

```bash
node scripts/migrate-posts.mjs
```

预期：`OK` 输出 18 行，最后一行 `迁移完成: 18 成功, 0 跳过, 0 错误`。

- [ ] **Step 4: 类型检查**

```bash
pnpm check
```

预期：无报错。如有 schema 不匹配，根据错误调整迁移脚本后重新运行。

- [ ] **Step 5: 提交**

```bash
git add src/content/config.ts src/content/posts/ scripts/migrate-posts.mjs
git commit -m "feat: Content Collections + 迁移 18 篇文章"
```


---

## Task 4: utils + BaseLayout

**Files:** Create: `src/utils/posts.ts`, `src/utils/toc.ts`, `src/layouts/BaseLayout.astro`

- [ ] **Step 1: 创建 `src/utils/posts.ts`**

```typescript
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function getSortedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function paginatePosts(posts: Post[], page: number, size = 10) {
  const totalPages = Math.ceil(posts.length / size);
  return { items: posts.slice((page - 1) * size, page * size), page, totalPages };
}

export function getReadingTime(body: string): number {
  return Math.max(1, Math.round(body.split(/\s+/).length / 200));
}

export async function getRecentPosts(count = 5): Promise<Post[]> {
  return (await getSortedPosts()).slice(0, count);
}

export async function getPopularTags(count = 10): Promise<Array<{ tag: string; count: number }>> {
  const posts = await getCollection('posts');
  const tagMap = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
  }
  return Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([tag, count]) => ({ tag, count }));
}

export async function getCategoryTree(): Promise<Map<string, Post[]>> {
  const posts = await getSortedPosts();
  const tree = new Map<string, Post[]>();
  for (const post of posts) {
    const cat = post.data.categories[0] ?? '未分类';
    if (!tree.has(cat)) tree.set(cat, []);
    tree.get(cat)!.push(post);
  }
  return tree;
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  return (await getSortedPosts()).filter(p => p.data.tags.includes(tag));
}

export async function getRelatedPosts(current: Post, count = 3): Promise<Post[]> {
  const posts = await getSortedPosts();
  return posts
    .filter(p => p.slug !== current.slug)
    .map(p => ({
      post: p,
      score: p.data.tags.filter(t => current.data.tags.includes(t)).length * 2
           + p.data.categories.filter(c => current.data.categories.includes(c)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(s => s.post);
}
```

- [ ] **Step 2: 创建 `src/utils/toc.ts`**

```typescript
export interface TocItem { id: string; text: string; depth: 2 | 3 | 4; }

export function buildTocFromHeadings(
  headings: Array<{ depth: number; slug: string; text: string }>
): TocItem[] {
  return headings
    .filter(h => h.depth >= 2 && h.depth <= 4)
    .map(h => ({ id: h.slug, text: h.text, depth: h.depth as 2 | 3 | 4 }));
}
```

- [ ] **Step 3: 创建 `src/layouts/BaseLayout.astro`**

```astro
---
interface Props { title: string; description?: string; }
const { title, description = 'xander 的技术博客' } = Astro.props;
const siteTitle = '无邪的博客';
---
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title === siteTitle ? title : `${title} | ${siteTitle}`}</title>
  <meta name="description" content={description} />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="alternate" type="application/rss+xml" title={siteTitle} href="/feed.xml" />
  <link rel="sitemap" href="/sitemap-index.xml" />

  <script is:inline>
    (function () {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', stored ?? (prefersDark ? 'dark' : 'light'));
    })();
  </script>

  <link rel="stylesheet" href="/styles/tokens.css" />
  <link rel="stylesheet" href="/styles/layout.css" />
  <link rel="stylesheet" href="/styles/content.css" />
  <link rel="stylesheet" href="/styles/pages.css" />
  <link rel="stylesheet" href="/styles/terminal.css" />
</head>
<body>
  <div class="sidebar-scrim" id="sidebar-scrim"></div>
  <div class="app">
    <slot name="sidebar" />
    <main class="main" data-pagefind-body>
      <slot name="topbar" />
      <slot />
    </main>
    <slot name="rightpanel" />
  </div>

  <script>
    // Copy button
    document.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest('[data-copy]') as HTMLElement | null;
      if (!btn) return;
      const pre = btn.closest('.codeblock')?.querySelector('pre');
      if (!pre) return;
      navigator.clipboard.writeText(pre.textContent ?? '').then(() => {
        btn.textContent = 'copied!';
        setTimeout(() => { btn.textContent = 'copy'; }, 1500);
      });
    });
    // Mobile sidebar
    const scrim = document.getElementById('sidebar-scrim');
    const sidebar = document.querySelector('.sidebar');
    document.getElementById('mobile-toggle')?.addEventListener('click', () => {
      sidebar?.classList.add('open'); scrim?.classList.add('open');
    });
    scrim?.addEventListener('click', () => {
      sidebar?.classList.remove('open'); scrim?.classList.remove('open');
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: 验证并提交**

```bash
pnpm check
git add src/utils/ src/layouts/BaseLayout.astro
git commit -m "feat: utils、BaseLayout"
```


---

## Task 5: Sidebar + TopBar + RightPanel

**Files:** Create: `src/components/layout/{Sidebar,TopBar,RightPanel}.astro`, `src/components/ui/SearchPanel.astro` (占位)

- [ ] **Step 1: 创建 `src/components/layout/Sidebar.astro`**

```astro
---
import { getCollection } from 'astro:content';
const posts = await getCollection('posts');
const totalPosts = posts.length;
const sorted = posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
const buildDate = new Date().toISOString().slice(0, 10);
const lastDate = sorted[0]?.data.date.toISOString().slice(0, 10) ?? '-';
const path = Astro.url.pathname;
const navItems = [
  { label: '首页',   href: '/',           icon: 'home',    count: null },
  { label: '归档',   href: '/archive',    icon: 'archive', count: totalPosts },
  { label: '分类',   href: '/categories', icon: 'folder',  count: null },
  { label: '标签',   href: '/tags',       icon: 'tag',     count: null },
  { label: '关于',   href: '/about',      icon: 'user',    count: null },
];
const isActive = (href: string) => href === '/' ? path === '/' : path.startsWith(href);
---
<aside class="sidebar" id="sidebar">
  <a href="/" class="brand">
    <div class="avatar">无</div>
    <div class="brand-text">
      <div class="brand-title">~/wuxie</div>
      <div class="brand-tagline">世界上只有一种真正的英雄主义</div>
    </div>
  </a>
  <nav class="nav">
    {navItems.map(item => (
      <a href={item.href} class={`nav-item${isActive(item.href) ? ' active' : ''}`}>
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          {item.icon === 'home'    && <path d="M2 6.5L8 2l6 4.5V14H10v-3H6v3H2z"/>}
          {item.icon === 'archive' && <><rect x="2" y="2" width="12" height="3" rx="1"/><path d="M3 5v8a1 1 0 001 1h8a1 1 0 001-1V5"/><path d="M6 9h4"/></>}
          {item.icon === 'folder' && <path d="M2 4a1 1 0 011-1h3l2 2h5a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>}
          {item.icon === 'tag'    && <><path d="M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5z"/><circle cx="6" cy="6" r="1" fill="currentColor" stroke="none"/></>}
          {item.icon === 'user'   && <><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></>}
        </svg>
        <span>{item.label}</span>
        {item.count !== null && <span class="nav-count">{item.count}</span>}
      </a>
    ))}
  </nav>
  <div class="sidebar-status">
    <div class="row"><span class="key">status</span><span class="ok">● online</span></div>
    <div class="row"><span class="key">posts</span><span>{totalPosts}</span></div>
    <div class="row"><span class="key">build</span><span>{buildDate}</span></div>
    <div class="row"><span class="key">last</span><span>{lastDate}</span></div>
  </div>
  <div class="sidebar-footer">
    <button class="theme-toggle" id="theme-toggle" aria-label="切换主题">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 12A4 4 0 118 4a4 4 0 010 8zm0-10a1 1 0 100-2 1 1 0 000 2zm0 12a1 1 0 100 2 1 1 0 000-2zM2.05 4.464a1 1 0 101.414-1.414 1 1 0 00-1.414 1.414zm10.1 8.486a1 1 0 101.414-1.414 1 1 0 00-1.414 1.414zm1.4-10.9a1 1 0 10-1.414-1.414 1 1 0 001.414 1.414zM3.464 13.95a1 1 0 10-1.414-1.414 1 1 0 001.414 1.414zM0 8a1 1 0 102 0 1 1 0 00-2 0zm14 0a1 1 0 102 0 1 1 0 00-2 0z"/>
      </svg>
      theme
    </button>
    <div class="social-icons">
      <a href="https://github.com/cherubic" class="social-icon" target="_blank" rel="noopener" aria-label="GitHub">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
      <a href="https://twitter.com/xander_su" class="social-icon" target="_blank" rel="noopener" aria-label="Twitter/X">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg>
      </a>
      <a href="mailto:copyrightcherubic@gmail.com" class="social-icon" aria-label="Email">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 4l7 5 7-5"/></svg>
      </a>
      <a href="/feed.xml" class="social-icon" aria-label="RSS">
        <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="13" r="1.5"/><path d="M2 8.5a5.5 5.5 0 015.5 5.5"/><path d="M2 4a9 9 0 019 9"/></svg>
      </a>
    </div>
  </div>
</aside>
<script>
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.querySelector<HTMLIFrameElement>('.giscus-frame')?.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: next } } }, 'https://giscus.app'
    );
  });
</script>
```

- [ ] **Step 2: 创建 `src/components/layout/TopBar.astro`**

```astro
---
import SearchPanel from '@components/ui/SearchPanel.astro';
interface Props { breadcrumbs?: Array<{ label: string; href?: string }>; }
const { breadcrumbs = [] } = Astro.props;
---
<div class="topbar">
  <button class="mobile-toggle" id="mobile-toggle" aria-label="菜单">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M2 4h12M2 8h12M2 12h12"/>
    </svg>
  </button>
  <nav class="breadcrumb">
    <span>~/wuxie</span>
    {breadcrumbs.map((crumb, i) => (
      <>
        <span class="sep">/</span>
        {i === breadcrumbs.length - 1
          ? <span class="crumb-current">{crumb.label}</span>
          : <a href={crumb.href}>{crumb.label}</a>
        }
      </>
    ))}
  </nav>
  <div class="topbar-pill">deploy: ok</div>
  <div class="search-wrap" id="search-wrap">
    <div class="search-box">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l3.5 3.5"/>
      </svg>
      <input type="text" placeholder="搜索..." id="search-input" autocomplete="off" />
      <kbd class="search-kbd">⌘K</kbd>
    </div>
    <SearchPanel />
  </div>
</div>
<script>
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      (document.getElementById('search-input') as HTMLInputElement)?.focus();
    }
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      (document.getElementById('search-input') as HTMLInputElement)?.focus();
    }
  });
</script>
```

- [ ] **Step 3: 创建 `src/components/layout/RightPanel.astro`**

```astro
---
import { getRecentPosts, getPopularTags } from '@utils/posts';
import type { TocItem } from '@utils/toc';
interface Props { toc?: TocItem[]; }
const { toc } = Astro.props;
const showToc = toc && toc.length > 0;
const recentPosts = showToc ? [] : await getRecentPosts(5);
const popularTags = showToc ? [] : await getPopularTags(10);
---
<aside class="rightpanel">
  {showToc ? (
    <div class="rp-section">
      <h3 class="rp-title">目录</h3>
      <ul class="toc" id="toc-list">
        {toc!.map(item => (
          <li class={`toc-item h${item.depth}`}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <>
      <div class="rp-section">
        <h3 class="rp-title">最近更新</h3>
        <ul class="rp-list">
          {recentPosts.map(post => (
            <li>
              <a href={`/posts/${post.slug}`}>
                {post.data.title}
                <span class="rp-date">{post.data.date.toISOString().slice(0, 10)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div class="rp-section">
        <h3 class="rp-title">热门标签</h3>
        <div class="tag-cloud">
          {popularTags.map(({ tag, count }) => (
            <a href={`/tags/${tag}`} class="tag-pill">
              {tag}<span class="tag-count">{count}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )}
</aside>
{showToc && (
  <script>
    const headings = document.querySelectorAll<HTMLElement>('.prose h2, .prose h3, .prose h4');
    const tocItems = document.querySelectorAll<HTMLElement>('#toc-list .toc-item');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.getAttribute('id');
        tocItems.forEach(li => li.classList.remove('active'));
        document.querySelector(`#toc-list .toc-item a[href="#${id}"]`)
          ?.parentElement?.classList.add('active');
      }
    }, { rootMargin: '-80px 0px -60% 0px' });
    headings.forEach(h => observer.observe(h));
  </script>
)}
```

- [ ] **Step 4: 创建占位 `src/components/ui/SearchPanel.astro`**

```astro
<!-- SearchPanel placeholder — implemented in Task 8 -->
```

- [ ] **Step 5: 验证并提交**

```bash
pnpm check
git add src/components/layout/ src/components/ui/SearchPanel.astro
git commit -m "feat: Sidebar、TopBar、RightPanel 组件"
```


---

## Task 6 — ArticleCard + 首页分页

**目标**：`src/components/ui/ArticleCard.astro`、`src/pages/index.astro`、`src/pages/page/[page].astro`

### Step 1 — ArticleCard.astro

```astro
---
import { getReadingTime } from '@utils/posts';
interface Props { post: { slug: string; data: any }; }
const { post } = Astro.props;
const minutes = getReadingTime(post.body ?? '');
const dateStr = post.data.date.toISOString().slice(0, 10);
---
<article class="article-card">
  {post.data.pin && <span class="card-badge">@pinned</span>}
  <a href={`/posts/${post.slug}`} class="card-link">
    <div class="card-meta">
      <time class="card-date">{dateStr}</time>
      {post.data.categories[0] && (
        <span class="card-cat">{post.data.categories[0]}</span>
      )}
      <span class="card-read">{minutes} min</span>
    </div>
    <h2 class="card-title">{post.data.title}</h2>
    {post.data.description && (
      <p class="card-excerpt">{post.data.description}</p>
    )}
  </a>
</article>
```

### Step 2 — index.astro（第 1 页）

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import ArticleCard from '@components/ui/ArticleCard.astro';
import { getSortedPosts, paginatePosts } from '@utils/posts';
const allPosts = await getSortedPosts();
const { posts, totalPages } = paginatePosts(allPosts, 1, 10);
---
<BaseLayout title="首页">
  <section class="post-list">
    {posts.map(post => <ArticleCard post={post} />)}
  </section>
  {totalPages > 1 && (
    <nav class="paginator">
      <a href="/page/2" class="btn-page">下一页 →</a>
    </nav>
  )}
</BaseLayout>
```

### Step 3 — page/[page].astro

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import ArticleCard from '@components/ui/ArticleCard.astro';
import { getSortedPosts, paginatePosts } from '@utils/posts';
export async function getStaticPaths() {
  const allPosts = await getSortedPosts();
  const { totalPages } = paginatePosts(allPosts, 1, 10);
  return Array.from({ length: totalPages - 1 }, (_, i) => ({
    params: { page: String(i + 2) },
  }));
}
const page = Number(Astro.params.page);
const allPosts = await getSortedPosts();
const { posts, totalPages } = paginatePosts(allPosts, page, 10);
---
<BaseLayout title={`第 ${page} 页`}>
  <section class="post-list">
    {posts.map(post => <ArticleCard post={post} />)}
  </section>
  <nav class="paginator">
    {page > 1 && <a href={page === 2 ? '/' : `/page/${page - 1}`} class="btn-page">← 上一页</a>}
    {page < totalPages && <a href={`/page/${page + 1}`} class="btn-page">下一页 →</a>}
  </nav>
</BaseLayout>
```

### Step 4 — 验证并提交

```bash
pnpm check
git add src/components/ui/ArticleCard.astro src/pages/index.astro src/pages/page/
git commit -m "feat: ArticleCard 组件与首页分页"
```


---

## Task 7 — PostFooter + PostLayout + 文章详情页

**目标**：`src/components/post/PostFooter.astro`、`src/layouts/PostLayout.astro`、`src/pages/posts/[slug].astro`

### Step 1 — PostFooter.astro

```astro
---
interface Props {
  slug: string;
  categories: string[];
  tags: string[];
  prevPost?: { slug: string; data: { title: string } };
  nextPost?: { slug: string; data: { title: string } };
  relatedPosts?: Array<{ slug: string; data: any }>;
  giscusRepo: string;
  giscusRepoId: string;
  giscusCategory: string;
  giscusCategoryId: string;
}
const p = Astro.props;
---
<!-- 分类 + 标签 -->
<div class="post-tags-row">
  {p.categories.map(c => <a href={`/categories`} class="tag-pill cat-pill">{c}</a>)}
  {p.tags.map(t => <a href={`/tags/${t}`} class="tag-pill">{t}</a>)}
</div>

<!-- 版权 -->
<aside class="copyright">
  <p>本文采用 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> 协议授权。</p>
</aside>

<!-- 分享 -->
<div class="share-row">
  <span class="share-label">分享：</span>
  <a class="share-btn" id="share-copy" href="#">复制链接</a>
  <a class="share-btn" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(Astro.url.href)}`} rel="noopener noreferrer">Twitter</a>
</div>

<!-- 上 / 下篇 -->
<nav class="post-nav">
  {p.prevPost && (
    <a href={`/posts/${p.prevPost.slug}`} class="post-nav-prev">
      <span class="nav-label">← 上一篇</span>
      <span class="nav-title">{p.prevPost.data.title}</span>
    </a>
  )}
  {p.nextPost && (
    <a href={`/posts/${p.nextPost.slug}`} class="post-nav-next">
      <span class="nav-label">下一篇 →</span>
      <span class="nav-title">{p.nextPost.data.title}</span>
    </a>
  )}
</nav>

<!-- 相关文章 -->
{p.relatedPosts && p.relatedPosts.length > 0 && (
  <section class="related-posts">
    <h3 class="rp-title">相关文章</h3>
    <div class="related-grid">
      {p.relatedPosts.slice(0, 3).map(r => (
        <a href={`/posts/${r.slug}`} class="related-card">
          <time class="card-date">{r.data.date.toISOString().slice(0,10)}</time>
          <p class="related-title">{r.data.title}</p>
        </a>
      ))}
    </div>
  </section>
)}

<!-- Giscus -->
<div id="giscus-container">
  <script is:inline
    src="https://giscus.app/client.js"
    data-repo={p.giscusRepo}
    data-repo-id={p.giscusRepoId}
    data-category={p.giscusCategory}
    data-category-id={p.giscusCategoryId}
    data-mapping="pathname"
    data-strict="0"
    data-reactions-enabled="1"
    data-emit-metadata="0"
    data-input-position="bottom"
    data-theme="preferred_color_scheme"
    data-lang="zh-CN"
    crossorigin="anonymous"
    async>
  </script>
</div>

<script>
  document.getElementById('share-copy')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(window.location.href).then(() => {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = '链接已复制';
      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2000);
    });
  });
</script>
```

### Step 2 — PostLayout.astro

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import RightPanel from '@components/layout/RightPanel.astro';
import PostFooter from '@components/post/PostFooter.astro';
import { getReadingTime } from '@utils/posts';
import type { TocItem } from '@utils/toc';
interface Props {
  title: string; date: Date; updated?: Date;
  categories: string[]; tags: string[];
  authors: string[]; image?: string;
  toc: TocItem[];
  slug: string;
  prevPost?: any; nextPost?: any; relatedPosts?: any[];
}
const p = Astro.props;
const minutes = getReadingTime('');
const catSlug = p.categories[0] ?? '';
const giscusRepo    = 'cherubic/cherubic.github.io';
const giscusRepoId  = 'R_kgDONhqxXA';
const giscusCat     = 'Announcements';
const giscusCatId   = 'DIC_kwDONhqxXM4Cl1k3';
---
<BaseLayout title={p.title} toc={p.toc}>
  <article class="post-wrap" data-pagefind-body>
    <!-- 文章头 -->
    <header class="post-header">
      {catSlug && <p class="post-cat-label"># {catSlug}</p>}
      <h1 class="post-title">{p.title}</h1>
      <p class="post-session-line">
        $ cat posts/{p.slug}.md --render
      </p>
      <div class="post-meta-bar">
        <time>{p.date.toISOString().slice(0,10)}</time>
        {p.updated && <span>· 更新 {p.updated.toISOString().slice(0,10)}</span>}
        <span>· {p.authors.join(', ')}</span>
        <span>· {minutes} min read</span>
      </div>
    </header>

    {p.image && <img src={p.image} alt={p.title} class="post-hero-img" loading="lazy" />}

    <!-- prose 内容由 slot 注入 -->
    <div class="prose">
      <slot />
    </div>

    <PostFooter
      slug={p.slug}
      categories={p.categories}
      tags={p.tags}
      prevPost={p.prevPost}
      nextPost={p.nextPost}
      relatedPosts={p.relatedPosts}
      giscusRepo={giscusRepo}
      giscusRepoId={giscusRepoId}
      giscusCategory={giscusCat}
      giscusCategoryId={giscusCatId}
    />
  </article>
</BaseLayout>
```

### Step 3 — posts/[slug].astro

```astro
---
import PostLayout from '@layouts/PostLayout.astro';
import { getCollection } from 'astro:content';
import { buildTocFromHeadings } from '@utils/toc';
import { getSortedPosts, getRelatedPosts } from '@utils/posts';
export async function getStaticPaths() {
  const posts = await getCollection('posts');
  const sorted = posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  return sorted.map((post, idx) => ({
    params: { slug: post.slug },
    props: {
      post,
      prevPost: sorted[idx + 1] ?? null,
      nextPost: sorted[idx - 1] ?? null,
    },
  }));
}
const { post, prevPost, nextPost } = Astro.props;
const { Content, headings } = await post.render();
const toc = buildTocFromHeadings(headings);
const related = await getRelatedPosts(post, 3);
---
<PostLayout
  title={post.data.title}
  date={post.data.date}
  updated={post.data.updated}
  categories={post.data.categories}
  tags={post.data.tags}
  authors={post.data.authors}
  image={post.data.image}
  toc={toc}
  slug={post.slug}
  prevPost={prevPost}
  nextPost={nextPost}
  relatedPosts={related}
>
  <Content />
</PostLayout>
```

### Step 4 — 验证并提交

```bash
pnpm check
git add src/components/post/ src/layouts/PostLayout.astro src/pages/posts/
git commit -m "feat: PostLayout 与文章详情页"
```


---

## Task 8 — 独立页面（归档 / 分类 / 标签 / 关于 / 404）

**目标**：6 个页面文件。

### Step 1 — archive.astro

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import { getSortedPosts } from '@utils/posts';
const posts = await getSortedPosts();
const byYear = posts.reduce<Record<number, typeof posts>>((acc, p) => {
  const y = p.data.date.getFullYear();
  (acc[y] ??= []).push(p);
  return acc;
}, {});
const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
---
<BaseLayout title="归档">
  {years.map(year => (
    <div class="archive-year">
      <div class="archive-year-head">
        <span class="archive-year-prefix">logs/</span>
        <span class="archive-year-num">{year}</span>
        <span class="archive-year-count">{byYear[year].length} posts</span>
      </div>
      <ul class="archive-list">
        {byYear[year].map(post => (
          <li class="archive-item" onclick={`location.href='/posts/${post.slug}'`}>
            <time class="archive-date">{post.data.date.toISOString().slice(5,10)}</time>
            <span class="archive-title">{post.data.title}</span>
          </li>
        ))}
      </ul>
    </div>
  ))}
</BaseLayout>
```

### Step 2 — categories.astro

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import { getCategoryTree } from '@utils/posts';
const tree = await getCategoryTree();
---
<BaseLayout title="分类">
  <ul class="cat-tree">
    {tree.map(node => (
      <li class="cat-node">
        <div class="cat-row" data-cat={node.name}>
          <span class={`cat-caret ${node.children.length ? '' : 'leaf'}`}>▶</span>
          <span class="cat-name">{node.name}</span>
          <span class="cat-count">{node.count}</span>
        </div>
        {node.children.length > 0 && (
          <ul class="cat-children" hidden>
            {node.children.map(child => (
              <li class="cat-node">
                <div class="cat-row">
                  <span class="cat-caret leaf"></span>
                  <span class="cat-name">{child.name}</span>
                  <span class="cat-count">{child.count}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </li>
    ))}
  </ul>
  <script>
    document.querySelectorAll('.cat-row[data-cat]').forEach(row => {
      row.addEventListener('click', () => {
        const children = row.nextElementSibling as HTMLElement | null;
        const caret = row.querySelector('.cat-caret') as HTMLElement | null;
        if (!children) return;
        const hidden = children.hasAttribute('hidden');
        hidden ? children.removeAttribute('hidden') : children.setAttribute('hidden', '');
        caret?.classList.toggle('open', hidden);
      });
    });
  </script>
</BaseLayout>
```

### Step 3 — tags/index.astro（标签云总览）

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import { getPopularTags } from '@utils/posts';
const tags = await getPopularTags(100);
---
<BaseLayout title="标签">
  <div class="tag-cloud-big">
    {tags.map(({ tag, count }) => (
      <a href={`/tags/${tag}`} class="tag-big">
        <span class="tc-name">{tag}</span>
        <span class="tc-count">{count}</span>
      </a>
    ))}
  </div>
</BaseLayout>
```

### Step 4 — tags/[tag].astro（按标签过滤）

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import ArticleCard from '@components/ui/ArticleCard.astro';
import { getCollection } from 'astro:content';
import { getPostsByTag } from '@utils/posts';
export async function getStaticPaths() {
  const posts = await getCollection('posts');
  const tagSet = new Set(posts.flatMap(p => p.data.tags));
  return [...tagSet].map(tag => ({
    params: { tag },
    props: { tag },
  }));
}
const { tag } = Astro.props;
const posts = await getPostsByTag(tag);
---
<BaseLayout title={`#${tag}`}>
  <h2 class="page-heading">#{tag}</h2>
  <section class="post-list">
    {posts.map(post => <ArticleCard post={post} />)}
  </section>
</BaseLayout>
```

### Step 5 — about.astro

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
import { getSortedPosts } from '@utils/posts';
const posts = await getSortedPosts();
const totalPosts = posts.length;
const firstYear = posts.at(-1)?.data.date.getFullYear() ?? new Date().getFullYear();
const yearsActive = new Date().getFullYear() - firstYear + 1;
const allTags = new Set(posts.flatMap(p => p.data.tags));
---
<BaseLayout title="关于">
  <div class="about-page">
    <div class="about-hero">
      <div class="about-avatar">X</div>
      <div>
        <h1 class="about-name">@ xander</h1>
        <p class="about-role">software engineer · blogger</p>
        <div class="about-links">
          <a href="https://github.com/cherubic" class="about-link" rel="noopener noreferrer">GitHub</a>
          <a href="mailto:copyrightcherubic@gmail.com" class="about-link">Email</a>
          <a href="/feed.xml" class="about-link">RSS</a>
        </div>
      </div>
    </div>
    <div class="about-facts">
      <div class="about-fact"><div class="fact-num">{totalPosts}</div><div class="fact-label">POSTS</div></div>
      <div class="about-fact"><div class="fact-num">{yearsActive}</div><div class="fact-label">YEARS</div></div>
      <div class="about-fact"><div class="fact-num">{allTags.size}</div><div class="fact-label">TAGS</div></div>
    </div>
    <div class="prose">
      <slot>
        <p>这里是个人博客，记录技术探索与思考。</p>
      </slot>
    </div>
  </div>
</BaseLayout>
```

### Step 6 — 404.astro

```astro
---
import BaseLayout from '@layouts/BaseLayout.astro';
---
<BaseLayout title="404 Not Found">
  <div class="err-page">
    <div class="err-glyph">404</div>
    <h1 class="err-title">页面不存在</h1>
    <p class="err-msg">你访问的地址不存在或已被删除。</p>
    <div class="err-terminal">
      <div><span class="prompt">$ </span>ls ./not-found</div>
      <div class="err-line">ls: cannot access './not-found': No such file or directory</div>
      <div><span class="prompt">$ </span>cd ~</div>
    </div>
    <a href="/" class="btn-page">回到首页</a>
  </div>
</BaseLayout>
```

### Step 7 — 验证并提交

```bash
pnpm check
git add src/pages/archive.astro src/pages/categories.astro src/pages/tags/ src/pages/about.astro src/pages/404.astro
git commit -m "feat: 归档、分类、标签、关于、404 页面"
```


---

## Task 9 — SearchPanel + RSS feed + Pagefind 集成

**目标**：完整搜索面板（安全 DOM 构建）、RSS feed、Pagefind 构建钩子。

### Step 1 — 更新 astro.config.mjs 添加 Pagefind 构建集成

在 `astro.config.mjs` 中添加 `vite.plugins` 运行 Pagefind（作为 vite 构建后钩子），
或使用独立 npm script：

```json
// package.json scripts
"build": "astro build && pagefind --site dist",
"preview": "astro preview"
```

### Step 2 — src/pages/feed.xml.ts（RSS）

```typescript
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('posts'))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(0, 20);

  const base = site?.toString().replace(/\/$/, '') ?? '';
  const items = posts.map(p => `
    <item>
      <title><![CDATA[${p.data.title}]]></title>
      <link>${base}/posts/${p.slug}</link>
      <guid>${base}/posts/${p.slug}</guid>
      <pubDate>${p.data.date.toUTCString()}</pubDate>
      <description><![CDATA[${p.data.description}]]></description>
    </item>`).join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>xander's blog</title>
    <link>${base}</link>
    <description>技术探索与思考</description>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
};
```

### Step 3 — SearchPanel.astro（安全 DOM 构建，无 innerHTML）

```astro
---
// SearchPanel.astro — rendered via TopBar, uses Pagefind JS API
---
<div id="search-panel" class="search-panel" hidden aria-modal="true" role="dialog">
  <div class="search-panel-head">
    <span>搜索</span>
    <button id="search-close" class="search-close">Esc</button>
  </div>
  <div id="search-results" class="search-results"></div>
  <div class="search-panel-foot">
    <span><kbd class="mini">↑↓</kbd> 导航</span>
    <span><kbd class="mini">↵</kbd> 打开</span>
    <span><kbd class="mini">Esc</kbd> 关闭</span>
  </div>
</div>

<script>
(async () => {
  const panel    = document.getElementById('search-panel') as HTMLElement;
  const resultsEl = document.getElementById('search-results') as HTMLElement;
  const input    = document.getElementById('search-input') as HTMLInputElement;
  const closeBtn = document.getElementById('search-close');

  function openPanel() { panel.removeAttribute('hidden'); input?.focus(); }
  function closePanel() { panel.setAttribute('hidden', ''); clearResults(); }
  function clearResults() { while (resultsEl.firstChild) resultsEl.removeChild(resultsEl.firstChild); }

  closeBtn?.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanel();
    if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !e.isComposing) {
      e.preventDefault();
      openPanel();
    }
  });
  input?.addEventListener('click', openPanel);

  let pagefind: any = null;
  async function ensurePagefind() {
    if (pagefind) return pagefind;
    pagefind = await import('/pagefind/pagefind.js');
    await pagefind.init();
    return pagefind;
  }

  function buildResultNode(r: any): HTMLElement {
    const a = document.createElement('a');
    a.className = 'search-result';
    a.href = r.url;

    const meta = document.createElement('div');
    meta.className = 'search-result-meta';
    if (r.meta?.category) {
      const cat = document.createElement('span');
      cat.className = 'sr-cat';
      cat.textContent = r.meta.category;
      meta.appendChild(cat);
    }

    const title = document.createElement('div');
    title.className = 'search-result-title';
    title.textContent = r.meta?.title ?? '';

    const excerpt = document.createElement('div');
    excerpt.className = 'search-result-excerpt';
    excerpt.textContent = r.excerpt ?? '';

    a.appendChild(meta);
    a.appendChild(title);
    a.appendChild(excerpt);
    return a;
  }

  input?.addEventListener('input', async () => {
    const q = input.value.trim();
    clearResults();
    if (!q) return;
    const pf = await ensurePagefind();
    const res = await pf.search(q);
    const top = await Promise.all(res.results.slice(0, 8).map((r: any) => r.data()));
    if (top.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = `没有找到 "${q}" 的结果`;
      resultsEl.appendChild(empty);
      return;
    }
    top.forEach((r: any) => resultsEl.appendChild(buildResultNode(r)));
  });
})();
</script>
```

### Step 4 — 验证并提交

```bash
pnpm check
git add src/components/ui/SearchPanel.astro src/pages/feed.xml.ts package.json
git commit -m "feat: SearchPanel、RSS feed、Pagefind 集成"
```


---

## Task 10 — GitHub Actions 部署

**目标**：`.github/workflows/deploy.yml`，使用官方 `upload-pages-artifact` + `deploy-pages`。

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build site
        run: pnpm build   # astro build && pagefind --site dist

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**注意**：在 GitHub 仓库 Settings → Pages → Source 选择 "GitHub Actions"（而非 branch deploy）。CNAME 文件放在 `public/CNAME` 即可，Astro build 会自动复制到 `dist/`。

### 提交

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Actions 部署工作流"
```

---

## Task 11 — 内容迁移

**目标**：运行 `scripts/migrate-posts.mjs`，将 `_posts/` 迁移至 `src/content/posts/`。

```bash
node scripts/migrate-posts.mjs
# 输出：迁移报告（成功数 / 跳过数 / 错误列表）
pnpm check   # 确认 content schema 全部通过
git add src/content/posts/
git commit -m "feat: 迁移历史文章至 Astro Content Collections"
```

如有 frontmatter 不合规的文件，脚本会列出错误列表，逐一修复后重新运行。

---

## 验收清单（对照设计稿）

| 功能 | 对应 Task | 状态 |
|---|---|---|
| 视觉 token（颜色 / 字体 / 间距）| Task 2 | - |
| 三栏响应式布局（≥1100 / 850-1099 / ≤760）| Task 2 | - |
| 暗黑模式（anti-FOUC + localStorage）| Task 3 | - |
| Sidebar terminal 面板 + 导航 + 社交 | Task 5 | - |
| TopBar 面包屑 + `deploy: ok` + 搜索框 | Task 5 | - |
| RightPanel TOC scrollspy + 最近/标签 | Task 5 | - |
| ArticleCard（`@pinned` / `> ` hover / 阅读时间）| Task 6 | - |
| 首页分页（每页 10 篇）| Task 6 | - |
| 文章详情 prose（`## ` 前缀 / 反引号 / 锚点）| Task 4 | - |
| 代码块（Shiki + 语言标签 + 复制按钮 + terminal variant）| Task 4 | - |
| Giscus 评论（跟随暗黑模式）| Task 7 | - |
| 文章上下篇导航 + 相关文章 | Task 7 | - |
| 归档（`logs/YYYY` 前缀）| Task 8 | - |
| 分类树（折叠展开 + `# ` 前缀）| Task 8 | - |
| 标签云（总览 + 按标签过滤）| Task 8 | - |
| 关于页（facts 统计卡片）| Task 8 | - |
| 404 页（大字 `404_` 闪烁光标）| Task 8 | - |
| SearchPanel（Pagefind，安全 DOM）| Task 9 | - |
| RSS feed | Task 9 | - |
| GitHub Actions 部署 | Task 10 | - |
| 历史文章迁移 | Task 11 | - |

