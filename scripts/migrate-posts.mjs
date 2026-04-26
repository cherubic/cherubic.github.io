import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

const srcDir  = join(process.cwd(), '_posts');
const destDir = join(process.cwd(), 'src/content/posts');

const files = readdirSync(srcDir).filter(f => f.endsWith('.md'));

let success = 0;
let skipped = 0;
const errors = [];

for (const file of files) {
  try {
    const raw = readFileSync(join(srcDir, file), 'utf8');
    const { data, content } = matter(raw);

    // Normalize date: strip timezone offset, keep YYYY-MM-DD HH:mm:ss
    let date = data.date ?? '';
    if (typeof date === 'object' && date instanceof Date) {
      date = date.toISOString().slice(0, 10);
    } else {
      date = String(date).replace(/\s[+-]\d{4}$/, '').trim();
    }

    // Normalize updated
    let updated;
    if (data.last_modified_at) {
      updated = String(data.last_modified_at).replace(/\s[+-]\d{4}$/, '').trim();
    }

    // Normalize categories/tags to arrays
    const categories = Array.isArray(data.categories)
      ? data.categories
      : data.categories ? [data.categories] : [];
    const tags = Array.isArray(data.tags)
      ? data.tags
      : data.tags ? [data.tags] : [];

    // Author: Jekyll uses scalar 'author', Astro uses 'authors' array
    const authors = data.authors ?? (data.author ? [data.author] : ['xander']);

    // Build clean frontmatter
    const fm = {
      title: data.title ?? '',
      date,
      ...(updated ? { updated } : {}),
      categories,
      tags,
      authors,
      description: data.description ?? data.excerpt ?? '',
      ...(data.pin ? { pin: true } : {}),
      ...(data.image ? { image: data.image } : {}),
      ...(data.math ? { math: true } : {}),
      ...(data.mermaid ? { mermaid: true } : {}),
    };

    const output = matter.stringify(content, fm);
    writeFileSync(join(destDir, file), output, 'utf8');
    success++;
  } catch (err) {
    errors.push({ file, error: err.message });
    skipped++;
  }
}

console.log(`\nMigration complete:`);
console.log(`  ✓ ${success} posts migrated`);
if (skipped > 0) {
  console.log(`  ✗ ${skipped} skipped`);
  errors.forEach(e => console.log(`    - ${e.file}: ${e.error}`));
}
