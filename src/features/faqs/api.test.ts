import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";

import { createFaq, deleteFaq, fetchFaqs, sortFaqs, updateFaq } from "./api";

const { del, get, patch, post } = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: {
    del,
    get,
    patch,
    post,
    put: vi.fn(),
    upload: vi.fn(),
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
});

const id = "11111111-1111-4111-8111-111111111111";
const fields = {
  question: "Question",
  answer: "Answer",
} as const;

it("deletes by FAQ ID and forwards cancellation", async () => {
  const { signal } = new AbortController();
  await deleteFaq(id, signal);

  expect(del).toHaveBeenCalledExactlyOnceWith(`/admin/faqs/${id}`, { signal });
});

it("reads the whole catalog and keeps the server's envelope", async () => {
  const data = { items: [] };
  get.mockResolvedValue(data);
  await expect(fetchFaqs()).resolves.toEqual(data);
  expect(get).toHaveBeenCalledWith("/admin/faqs", { signal: undefined });
});

it("sends only mutable FAQ fields and the full order", async () => {
  const { signal } = new AbortController();
  const form = { ...fields, id };
  await createFaq(form, signal);
  await updateFaq(id, form, signal);
  await sortFaqs({ ids: [id] }, signal);

  expect(post).toHaveBeenCalledExactlyOnceWith("/admin/faqs", fields, {
    signal,
  });
  expect(patch).toHaveBeenNthCalledWith(1, `/admin/faqs/${id}`, fields, {
    signal,
  });
  expect(patch).toHaveBeenNthCalledWith(
    2,
    "/admin/faqs/sort",
    { ids: [id] },
    { signal },
  );
});
