export type ArticleCategory = {
  name: string;
  slug: string;
};

export type ArticleCategoryCatalog = { items: ArticleCategory[] };
export type ArticleCategoryRequest = Pick<ArticleCategory, "name" | "slug">;
