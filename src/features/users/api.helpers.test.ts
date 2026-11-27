import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { apiClient } from "@/shared/api";

import {
  fetchUser,
  updateUser,
  updateUserPassword,
  updateUserRoles,
} from "./api";

vi.mock("@/shared/api", async (load) => ({
  ...(await load<typeof SharedApi>()),
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

beforeEach(() => vi.resetAllMocks());

it("targets the same user ID for profile, role and password requests", async () => {
  const id = "12345678-1234-4234-8234-123456789abc";
  const path = `/admin/users/${id}`;
  const { signal } = new AbortController();
  await fetchUser(id, signal);
  await updateUser(id, { name: "Synthetic" }, signal);
  await updateUserRoles(id, { roleIds: [] }, signal);
  await updateUserPassword(id, { newPassword: "Synthetic123!" }, signal);

  expect(apiClient.get).toHaveBeenCalledExactlyOnceWith(path, { signal });
  expect(apiClient.patch).toHaveBeenNthCalledWith(
    1,
    path,
    { name: "Synthetic" },
    { signal },
  );
  expect(apiClient.patch).toHaveBeenNthCalledWith(
    2,
    path + "/roles",
    { roleIds: [] },
    { signal },
  );
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
    path + "/password",
    { newPassword: "Synthetic123!" },
    { signal },
  );
});
