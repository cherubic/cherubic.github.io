# 博客重构设计稿：Jekyll/Chirpy → Astro + Terminal 风格

_日期：2026-04-25_

---

## 背景

现有博客基于 Jekyll + Chirpy 主题。用户在 Claude Design 中完成了一套终端风格设计稿（设计文件已解压至 `/tmp/design-extract/blog/`），希望将设计稿实现到博客中。经评估，从 Jekyll/Chirpy 切换到 **Astro 5** 可以获得更干净的实现路径（设计稿为 JSX/CSS，Astro 组件模型高度匹配），避免与 Chirpy 3000+ 行 SCSS 产生大量覆盖冲突。

---

## 视觉设计系统

来源：`/tmp/design-extract/blog/project/styles/tokens.css`

**调色板（浅色）：**
- 背景：`#fafaf7`（暖中性米白）
- 软背景：`#f2f1ec`
- 主文字：`#16150f`（近黑）
- 柔和文字：`#3a3831`
- 静音色：`#706c61`
- 边框：`#e7e5de`
- 强调色：`#16150f`（即近黑，无彩色强调）

**调色板（深色）：**
- 背景：`#0f0e0a`
- 主文字：`#ece9df`
- 边框：`#2a2822`

**字体：**
- 正文：`Inter, PingFang SC, Hiragino Sans GB, system-ui`
- 等宽（终端装饰）：`JetBrains Mono, SF Mono, Menlo, Consolas`
- 衬线（保留未用）：`Source Serif 4, Noto Serif SC, Georgia`

**终端风格叠加（terminal.css）：**
- 侧边栏品牌块：traffic-light 三点 + `$ ~/wuxie` 前缀 + 闪烁光标 `▍`
- 面包屑前加 `$` prompt
- 页面标题用等宽字体 + 尾部闪烁光标
- 文章卡片 hover 显示 `> ` 前缀；置顶标记改为 `@pinned`
- 文章页标题下方加 `$ cat posts/xxx.md --render` session 行
- prose 标题自动加 `## ` `### ` 前缀
- 归档年份前缀 `logs/`
- 右侧面板区块标题前缀 `$`
- 暗色模式 page-head 增加微弱扫描线纹理

---

## 架构

```
cherubic.github.io/
├── src/
│   ├── content/
│   │   ├── config.ts
│   │   └── posts/             # 从 _posts/ 迁移
│   ├── components/
│   │   ├── Sidebar.astro
│   │   ├── TopBar.astro
│   │   ├── RightPanel.astro
│   │   ├── ArticleCard.astro
│   │   └── TOC.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PostLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── posts/[slug].astro
│   │   ├── archive.astro
│   │   ├── categories.astro
│   │   ├── tags/
│   │   │   ├── index.astro    # 标签云总览
│   │   │   └── [tag].astro    # 按标签过滤
│   │   ├── about.astro
│   │   └── 404.astro
│   └── styles/
│       ├── tokens.css
│       ├── layout.css
│       ├── content.css
│       ├── pages.css
│       └── terminal.css
├── scripts/
│   └── migrate-posts.mjs
├── public/
├── astro.config.mjs
├── tsconfig.json
└── .github/workflows/deploy.yml
```

---

## Content Collections Schema

文件：`src/content/config.ts`

```typescript
const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    pin: z.boolean().default(false),
    authors: z.array(z.string()).default(['wuxie']),
    description: z.string().default(''),
    image: z.string().optional(),
  }),
});
```

slug 从文件名 `YYYY-MM-DD-title.md` 自动提取（去掉日期前缀）。

---

## 组件规格

### BaseLayout.astro
- 引入 5 个 CSS 文件（全局）
- 引入 Inter + JetBrains Mono（Google Fonts 或本地 @font-face）
- `<html data-theme>` 属性管理暗黑模式
- 初始化脚本：读 `localStorage('theme')` → 否则 `prefers-color-scheme` → 设置 `data-theme`
- 三栏 `.app` 网格：`var(--sidebar-w) minmax(0,1fr) var(--right-w)`
- 响应式：≤1100px 隐藏右栏，≤760px 折叠侧边栏

### Sidebar.astro
- 品牌块（terminal 面板）：traffic-light dots + `$ ~/wuxie` + tagline + 闪烁 `▍`
- 导航菜单：首页 / 归档 / 分类 / 标签 / 关于，带 SVG 图标，文章计数，当前页高亮
- 底部：
  - Session 状态面板（online · posts 数量 · build 时间 · last 更新）
  - 暗黑模式切换按钮
  - 社交图标：GitHub / Twitter / Email / RSS
- 移动端：`transform: translateX(-100%)` → `.open` 时滑入，遮罩层关闭

### TopBar.astro
- 移动端汉堡按钮（≤760px 显示）
- 面包屑（等宽字体，`$` 前缀）
- 右侧：`● deploy: ok` 状态丸 + 搜索框（`/` 前缀，`⌘K` 触发）

### RightPanel.astro
- 普通页：最近更新 5 篇 + 热门标签 10 个
- 文章页：TOC 目录（h2-h4，IntersectionObserver scrollspy）
- ≤1100px 隐藏整个面板

### ArticleCard.astro
- 无封面图，纯文字卡片
- 元信息：日期（等宽）+ 分类 badge + 阅读时间
- 标题：等宽字体，hover 时 `> ` 前缀
- 置顶：`@pinned` badge（terminal 风格）
- 摘要：2 行截断

### PostLayout.astro（文章页）
- 文章头：`# category` → 标题（等宽）→ `$ cat posts/xxx.md --render` session 行
- 元信息栏：发布日期 + 最后修改日期 + 作者 + 阅读时间
- 预览图（可选，支持 lqip 占位）
- prose 内容区：
  - 标题自动加 `## ` `### ` 前缀（CSS ::before）
  - 行内代码包裹反引号（CSS ::before/::after）
  - 代码块：Shiki 高亮 + 语言标签 + 复制按钮，默认使用 `terminal` 变体
  - 任务列表美化（checked/unchecked 自定义图标）
  - 表格横向滚动
  - 图片懒加载 + 点击放大（lightbox）
  - 标题锚点链接（h2-h5，`#` 图标 hover 显示）
  - Mermaid 流程图（跟随暗黑模式）
- 文章底部：
  - 分类 + 标签行
  - 版权声明（左侧 ink 竖线）
  - 分享按钮（Twitter / Facebook / Telegram / 复制链接）
  - 上一篇 / 下一篇导航
  - 相关文章推荐（3 篇卡片）
  - Giscus 评论（跟随 data-theme）

---

## 独立页面

| 页面 | 路由 | 实现要点 |
|---|---|---|
| 首页 | `/` | `getCollection('posts')` 排序 + 分页（每页 10 篇） |
| 文章详情 | `/posts/[slug]` | getEntry + render，传 TOC 给 RightPanel |
| 归档 | `/archive` | 按年份分组，`logs/YYYY` 前缀，date + title 列表 |
| 分类 | `/categories` | 树形结构（父子分类折叠展开），`# ` 前缀，文章计数 |
| 标签云 | `/tags` | 标签云总览（按文章数排序），`#tag` 格式，显示文章数 |
| 标签过滤 | `/tags/[tag]` | 按指定标签过滤文章列表 |
| 关于 | `/about` | 个人介绍，`@ name` 前缀，facts 统计卡片 |
| 404 | `404.astro` | 大字 `404_`（blinking cursor），terminal 错误输出面板 |

---

## 搜索

- **引擎**：Pagefind（静态全文检索，无服务端依赖）
- **构建**：`pagefind --site dist` 在 Astro build 之后运行
- **UI**：自定义搜索面板（不用 Pagefind 默认 UI），调用 Pagefind JS API
- **结果**：显示标题 / 分类 / 标签 / 摘要，关键词高亮（`<mark>`）
- **触发**：搜索框点击 / `⌘K` / `/` 键，`Esc` 关闭

---

## 暗黑模式

- 存储：`localStorage` key `'theme'`，值 `'light'` | `'dark'`
- 初始化：inline `<script>` 在 `<head>` 最前（避免 FOUC）
- 切换：写 `localStorage` + 设置 `document.documentElement.dataset.theme`
- Giscus：`data-theme` 变化时 postMessage 给 iframe
- Mermaid：重新渲染（传入对应主题配置）

---

## 内容迁移

脚本 `scripts/migrate-posts.mjs`：
1. 读取 `_posts/*.md` 所有文件
2. 解析 Jekyll frontmatter（gray-matter）
3. 规范化字段：
   - `date`：保留，确保为 `YYYY-MM-DD` 格式
   - `last_modified_at` → `updated`
   - `categories`：保持数组格式
   - `tags`：保持数组格式
   - `description` / `excerpt` → `description`
   - 删除 Jekyll 专属字段（`layout`, `math`, `mermaid` 等移至 astro.config）
4. 写入 `src/content/posts/`，文件名保持不变
5. 输出迁移报告（成功数 / 跳过数 / 错误列表）

---

## 部署

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install
      - run: pnpm build           # astro build
      - run: pnpm pagefind        # pagefind --site dist
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: <custom-domain>   # 从现有 CNAME 文件读取
```

---

## 不在范围内

- 后台 CMS / 写作界面
- 服务端渲染（SSR）
- 评论系统切换（继续用 Giscus）
- 多语言支持
