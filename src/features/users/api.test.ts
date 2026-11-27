import { beforeEach, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { apiClient } from "@/shared/api";

import {
  createUser,
  fetchUsers,
  updateUser,
  updateUserPassword,
  updateUserRoles,
} from "./api";
import type { ManagedUser } from "./types";

vi.mock("@/shared/api", async (load) => ({
  ...(await load<typeof SharedApi>()),
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

const record: ManagedUser = {
  id: "12345678-1234-4234-8234-123456789abc",
  name: "Synthetic operator",
  isActive: true,
  mobile: "9121234567",
  roles: [],
};

beforeEach(() => vi.resetAllMocks());

it("reads the complete user array without query parameters and forwards cancellation", async () => {
  const { signal } = new AbortController();
  const users = [record];
  vi.mocked(apiClient.get).mockResolvedValue(users);

  await expect(fetchUsers(signal)).resolves.toEqual(users);
  expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/admin/users", {
    signal,
  });
});

it("creates an active-by-default user with an exact password and no role memberships", async () => {
  const { signal } = new AbortController();
  const password = " Synthetic123! ";
  const roleIds = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ];
  const payload = {
    name: record.name,
    mobile: record.mobile,
    password,
  };
  const inputWithMetadata = { ...payload, isActive: false, roleIds };
  await createUser(inputWithMetadata, signal);

  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
    "/admin/users",
    payload,
    { signal },
  );
});

it("sends profile, status and role membership changes to separate PATCH resources", async () => {
  const { signal } = new AbortController();
  const query = {
    mobile: record.mobile,
    name: "Renamed",
    isActive: false,
  };
  await updateUser(record.id, query, signal);
  await updateUserRoles(record.id, { roleIds: [] }, signal);

  const path = "/admin/users/" + record.id;
  expect(apiClient.patch).toHaveBeenNthCalledWith(
    1,
    path,
    { name: "Renamed", isActive: false },
    { signal },
  );
  expect(apiClient.patch).toHaveBeenNthCalledWith(
    2,
    path + "/roles",
    { roleIds: [] },
    { signal },
  );
});

it("sends only the new password to the managed POST operation", async () => {
  const { signal } = new AbortController();
  const newPassword = " Synthetic456! ";
  await updateUserPassword(
    record.id,
    { newPassword, ...{ roleIds: [] } },
    signal,
  );

  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
    "/admin/users/" + record.id + "/password",
    {
      newPassword,
    },
    { signal },
  );
});
