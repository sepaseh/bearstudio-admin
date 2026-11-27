import { apiClient } from "@/shared/api";

import type {
  ArticleCategory,
  ArticleCategoryCatalog,
  ArticleCategoryRequest,
} from "./types";

const basePath = "/admin/article-categories";
const categoryPath = (slug: string) => `${basePath}/${slug}`;

export const fetchArticleCategories = (
  signal?: AbortSignal,
): Promise<ArticleCategoryCatalog> =>
  apiClient.get<ArticleCategoryCatalog>(basePath, { signal });

export const fetchArticleCategory = (
  slug: string,
  signal?: AbortSignal,
): Promise<ArticleCategory> =>
  apiClient.get<ArticleCategory>(categoryPath(slug), { signal });

export const createArticleCategory = (
  { name, slug }: ArticleCategoryRequest,
  signal?: AbortSignal,
): Promise<ArticleCategory> =>
  apiClient.post<ArticleCategory>(basePath, { name, slug }, { signal });

export const updateArticleCategory = (
  currentSlug: string,
  { name, slug }: ArticleCategoryRequest,
  signal?: AbortSignal,
): Promise<ArticleCategory> =>
  apiClient.patch<ArticleCategory>(
    categoryPath(currentSlug),
    { name, slug },
    { signal },
  );

export const deleteArticleCategory = (
  slug: string,
  signal?: AbortSignal,
): Promise<void> => apiClient.del<void>(categoryPath(slug), { signal });

export const sortArticleCategories = (
  { slugs }: { slugs: string[] },
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.patch<void>(basePath + "/sort", { slugs }, { signal });
