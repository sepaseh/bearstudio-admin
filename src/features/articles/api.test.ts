import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { apiClient } from "@/shared/api";

import {
  createArticle,
  deleteArticle,
  fetchArticles,
  updateArticle,
} from "./api";

const { del, get } = vi.hoisted(() => ({ del: vi.fn(), get: vi.fn() }));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: {
    del,
    get,
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
}));
beforeEach(() => {
  del.mockReset();
  get.mockReset();
});

it("deletes by article ID and forwards cancellation", async () => {
  const { signal } = new AbortController();
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  await deleteArticle(id, signal);

  expect(del).toHaveBeenCalledExactlyOnceWith(`/admin/articles/${id}`, {
    signal,
  });
});

it("reads every article page in order and forwards cancellation", async () => {
  const first = { id: "guide-1" };
  const second = { id: "guide-2" };
  get
    .mockResolvedValueOnce({ items: [first], total: 2 })
    .mockResolvedValueOnce({ items: [second], total: 2 });
  const { signal } = new AbortController();
  await expect(fetchArticles(signal)).resolves.toEqual([first, second]);
  expect(get).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenNthCalledWith(1, "/admin/articles", {
    params: { page: 1 },
    signal,
  });
  expect(get).toHaveBeenNthCalledWith(2, "/admin/articles", {
    params: { page: 2 },
    signal,
  });
});

it("writes article fields only", async () => {
  const { signal } = new AbortController();
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const payload = {
    title: "Sample article",
    slug: "sample",
    excerpt: "Preview",
    body: "<ul><li>Point</li></ul>",
    category: { slug: "guides" },
    cover: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" },
  };
  const inputWithMetadata = {
    ...payload,
    id: "unexpected",
    category: { ...payload.category, name: "Read-only category name" },
    cover: {
      ...payload.cover,
      url: "/api/v1/public/images/" + payload.cover.id,
      thumb: "/api/v1/public/images/" + payload.cover.id + "/thumbnail",
    },
  };
  await createArticle(inputWithMetadata, signal);
  await updateArticle(id, inputWithMetadata, signal);

  expect(apiClient.post).toHaveBeenCalledWith("/admin/articles", payload, {
    signal,
  });
  expect(apiClient.patch).toHaveBeenCalledWith(
    "/admin/articles/" + id,
    payload,
    { signal },
  );
});
