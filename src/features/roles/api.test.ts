import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as SharedApi from "@/shared/api";
import { apiClient } from "@/shared/api";

import {
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRole,
  fetchRoles,
  updateRole,
} from "./api";
import type { RoleRequest } from "./types";

vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

const roleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

describe("roles HTTP contract", () => {
  it("forwards one caller signal to list, detail and permissions reads", async () => {
    const controller = new AbortController();
    await fetchRoles(controller.signal);
    await fetchPermissions(controller.signal);
    await fetchRole(roleId, controller.signal);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/admin/roles", {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/admin/permissions", {
      signal: controller.signal,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(3, `/admin/roles/${roleId}`, {
      signal: controller.signal,
    });
  });

  it("creates and updates permission arrays without changing their vocabulary", async () => {
    const controller = new AbortController();
    const request: RoleRequest = {
      name: "Operators",
      permissions: ["users.read", "roles.write"],
    };
    const response = { id: roleId, ...request };
    vi.mocked(apiClient.post).mockResolvedValue(response);
    vi.mocked(apiClient.patch).mockResolvedValue(response);

    await expect(createRole(request, controller.signal)).resolves.toBe(
      response,
    );
    await expect(updateRole(roleId, request, controller.signal)).resolves.toBe(
      response,
    );
    expect(apiClient.post).toHaveBeenCalledWith("/admin/roles", request, {
      signal: controller.signal,
    });
    expect(apiClient.patch).toHaveBeenCalledWith(
      `/admin/roles/${roleId}`,
      request,
      {
        signal: controller.signal,
      },
    );
  });

  it("deletes by role ID and retains the failure for the confirmation", async () => {
    const controller = new AbortController();
    const error = new Error("Synthetic role still assigned");
    vi.mocked(apiClient.del).mockRejectedValue(error);

    await expect(deleteRole(roleId, controller.signal)).rejects.toBe(error);
    expect(apiClient.del).toHaveBeenCalledWith(`/admin/roles/${roleId}`, {
      signal: controller.signal,
    });
  });

  it("sends only supplied mutable fields in a partial patch", async () => {
    const changes = {
      permissions: [],
    };
    await updateRole(roleId, changes);

    const [, body] = vi.mocked(apiClient.patch).mock.calls[0];
    expect(JSON.parse(JSON.stringify(body))).toEqual({
      permissions: [],
    });
  });
});
