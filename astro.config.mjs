import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeCodeblock } from './plugins/rehype-codeblock.mjs';

export default defineConfig({
  site: 'https://xandersu.com',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: false,
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeCodeblock, rehypeKatex],
    syntaxHighlight: 'shiki',
  },
  vite: {
    resolve: {
      alias: {
        '@components': '/src/components',
        '@layouts': '/src/layouts',
        '@utils': '/src/utils',
        '@styles': '/src/styles',
      },
    },
  },
});
