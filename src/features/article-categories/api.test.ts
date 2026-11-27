import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { apiClient } from "@/shared/api";

import {
  deleteArticleCategory,
  sortArticleCategories,
  updateArticleCategory,
} from "./api";

const { del } = vi.hoisted(() => ({ del: vi.fn() }));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: {
    del,
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
}));
beforeEach(() => {
  del.mockReset();
});

it("deletes by category slug and forwards cancellation", async () => {
  const { signal } = new AbortController();
  await deleteArticleCategory("motion-design", signal);

  expect(del).toHaveBeenCalledExactlyOnceWith(
    "/admin/article-categories/motion-design",
    {
      signal,
    },
  );
});

it("addresses a slug rename by its previous key, orders by slugs", async () => {
  const { signal } = new AbortController();
  const values = {
    name: "Revised",
    slug: "revised",
  };
  await updateArticleCategory("old-slug", values, signal);
  await sortArticleCategories({ slugs: ["first", "revised"] }, signal);

  expect(apiClient.patch).toHaveBeenCalledWith(
    "/admin/article-categories/old-slug",
    values,
    { signal },
  );
  expect(apiClient.patch).toHaveBeenCalledWith(
    "/admin/article-categories/sort",
    { slugs: ["first", "revised"] },
    { signal },
  );
});
