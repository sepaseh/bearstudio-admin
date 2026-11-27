import { apiClient } from "@/shared/api";

import type {
  Article,
  ArticlePage,
  ArticleRequest,
  ArticleSummary,
} from "./types";

const basePath = "/admin/articles";
const articlePath = (id: string) => `${basePath}/${id}`;

export const fetchArticles = async (
  signal?: AbortSignal,
): Promise<ArticleSummary[]> => {
  const articles: ArticleSummary[] = [];
  for (let page = 1; ; page += 1) {
    signal?.throwIfAborted();
    const { items, total } = await apiClient.get<ArticlePage>(basePath, {
      params: { page },
      signal,
    });
    articles.push(...items);
    if (articles.length >= total || items.length === 0) return articles;
  }
};

export const fetchArticle = (
  id: string,
  signal?: AbortSignal,
): Promise<Article> => apiClient.get<Article>(articlePath(id), { signal });

export const createArticle = (
  { title, slug, excerpt, body, category, cover }: ArticleRequest,
  signal?: AbortSignal,
): Promise<Article> =>
  apiClient.post<Article>(
    basePath,
    {
      title,
      slug,
      excerpt,
      body,
      category: { slug: category.slug },
      cover: { id: cover.id },
    },
    { signal },
  );

export const updateArticle = (
  id: string,
  { title, slug, excerpt, body, category, cover }: Partial<ArticleRequest>,
  signal?: AbortSignal,
): Promise<Article> =>
  apiClient.patch<Article>(
    articlePath(id),
    {
      title,
      slug,
      excerpt,
      ...(body === undefined ? {} : { body }),
      ...(category === undefined ? {} : { category: { slug: category.slug } }),
      ...(cover === undefined ? {} : { cover: { id: cover.id } }),
    },
    { signal },
  );

export const deleteArticle = (
  id: string,
  signal?: AbortSignal,
): Promise<void> => apiClient.del<void>(articlePath(id), { signal });
