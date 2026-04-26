# xander's blog

个人技术博客，记录 Go、Kubernetes、系统工程相关的探索与翻译笔记。

## 技术栈

- **框架**：[Astro 5](https://astro.build) + TypeScript
- **内容**：Markdown / MDX，Content Collections
- **语法高亮**：Shiki（github-dark 主题）
- **搜索**：[Pagefind](https://pagefind.app)（静态全文搜索）
- **评论**：[Giscus](https://giscus.app)（GitHub Discussions）
- **数学公式**：remark-math + rehype-katex
- **部署**：GitHub Actions → GitHub Pages
- **包管理**：pnpm

## 本地开发

```bash
pnpm install
pnpm dev        # 启动开发服务器 http://localhost:4321
pnpm build      # 构建 + 生成 Pagefind 索引
pnpm preview    # 预览构建产物
```

## 目录结构

```
src/
  content/posts/   # Markdown 文章
  layouts/         # BaseLayout、PostLayout
  components/      # Sidebar、TopBar、RightPanel、SearchPanel 等
  pages/           # 路由页面（首页、归档、分类、标签、关于）
  utils/           # posts.ts、toc.ts 工具函数
public/styles/     # CSS 设计系统（tokens / layout / content / pages / terminal）
plugins/           # rehype-codeblock 插件
```

## 文章 frontmatter

```yaml
title: 文章标题
date: 2024-01-01
categories: [分类]
tags: [标签]
description: 摘要
pin: false        # 是否置顶
math: false       # 是否启用 KaTeX
```
