import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('posts'))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(0, 20);

  const base = site?.toString().replace(/\/$/, '') ?? 'https://xandersu.com';

  const items = posts
    .map(
      p => `
    <item>
      <title><![CDATA[${p.data.title}]]></title>
      <link>${base}/posts/${p.slug}</link>
      <guid isPermaLink="true">${base}/posts/${p.slug}</guid>
      <pubDate>${p.data.date.toUTCString()}</pubDate>
      <description><![CDATA[${p.data.description}]]></description>
    </item>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>xander's blog</title>
    <link>${base}</link>
    <description>技术探索与思考 — Go、Kubernetes、系统工程</description>
    <language>zh-CN</language>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
