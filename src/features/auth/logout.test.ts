import { describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/api";

import { logout } from "./api";

describe("logout API", () => {
  it("posts without a body and resolves to void after the response", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue("");

    await expect(logout()).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledExactlyOnceWith("/auth/logout");
  });

  it("passes a failed logout to the authenticated layout", async () => {
    const failure = new Error("Synthetic offline failure");
    vi.spyOn(apiClient, "post").mockRejectedValue(failure);

    await expect(logout()).rejects.toBe(failure);
  });
});
