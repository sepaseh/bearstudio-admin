import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteRole } from "@/features/roles/api";
import { fetchUser } from "@/features/users/api";

const { client } = vi.hoisted(() => ({
  client: {
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
}));
vi.mock("@/shared/api", () => ({ apiClient: client }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe.each([
  ["users", fetchUser, client.get],
  ["roles", deleteRole, client.del],
] as const)("%s resource paths", (resource, request, transport) => {
  it("uses the canonical identifier returned by the API", async () => {
    const id = "916e7dc9-4690-4a3a-8ae3-1a75291b5f68";
    const controller = new AbortController();
    await request(id, controller.signal);

    expect(transport).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledWith("/admin/" + resource + "/" + id, {
      signal: controller.signal,
    });
  });
});
