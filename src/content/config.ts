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
