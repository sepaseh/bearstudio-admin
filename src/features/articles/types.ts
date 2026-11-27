export type ArticleRequest = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: { slug: string };
  cover: { id: string };
};

export type ArticleSummary = Omit<
  ArticleRequest,
  "body" | "category" | "cover"
> & {
  id: string;
  category: { slug: string; name: string };
  cover:
    | { id: string; thumb: string | null; url: string }
    | { id: null; thumb: null; url: null };
};

export type Article = ArticleSummary & Pick<ArticleRequest, "body">;
export type ArticleQuery = {
  page?: number;
  title?: string;
  category?: string;
};
export type ArticlePage = { items: ArticleSummary[]; total: number };
