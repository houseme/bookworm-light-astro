import { defineCollection, z } from "astro:content";

const seo = {
  meta_title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  canonical: z.string().url().optional(),
  noindex: z.boolean().optional(),
  keywords: z.string().optional(),
};

const posts = defineCollection({
  type: "content",
  schema: z.object({
    authors: z.array(z.string()),
    title: z.string(),
    categories: z.array(z.string()),
    tags: z.array(z.string()),
    date: z.date().optional(),
    draft: z.boolean().optional(),
    ...seo,
  }),
});

const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()).optional().default([]),
    categories: z.array(z.string()).optional().default([]),
    tags: z.array(z.string()).optional().default([]),
    date: z.date().optional(),
    draft: z.boolean().optional(),
    ...seo,
  }),
});

export const collections = { posts, pages };
