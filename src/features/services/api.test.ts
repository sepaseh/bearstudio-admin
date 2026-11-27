import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { apiClient } from "@/shared/api";

import {
  createService,
  deleteService,
  fetchServices,
  sortServices,
  updateService,
} from "./api";
import type { ServiceRequest } from "./types";

vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const input: ServiceRequest = {
  slug: "animation",
  title: "Animation",
  description: "Work across formats.",
  tags: ["2D", "3D"],
  imageIds: [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  ],
};

beforeEach(() => vi.resetAllMocks());

it("reads and writes the complete catalog and sends the full server sort key list", async () => {
  const { signal } = new AbortController();
  await fetchServices(signal);
  const inputWithMetadata = {
    ...input,
    details: ["Retired"],
    id: "unexpected",
    images: [{ id: input.imageIds[0], url: "/unexpected", thumb: null }],
  };
  await createService(inputWithMetadata, signal);
  await updateService("previous-slug", inputWithMetadata, signal);
  await sortServices({ slugs: ["second", input.slug] }, signal);

  expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/admin/services", {
    signal,
  });
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
    "/admin/services",
    input,
    { signal },
  );
  expect(apiClient.patch).toHaveBeenNthCalledWith(
    1,
    "/admin/services/previous-slug",
    input,
    { signal },
  );
  expect(apiClient.patch).toHaveBeenNthCalledWith(
    2,
    "/admin/services/sort",
    { slugs: ["second", input.slug] },
    { signal },
  );
});

it("deletes by slug without a request body", async () => {
  const { signal } = new AbortController();
  await deleteService(input.slug, signal);

  expect(apiClient.del).toHaveBeenCalledExactlyOnceWith(
    "/admin/services/animation",
    { signal },
  );
});
