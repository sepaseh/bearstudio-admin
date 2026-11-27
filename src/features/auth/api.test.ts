import { isCancel } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  advanceSession,
  apiClient,
  getSessionSignal,
  setAccessToken,
} from "@/shared/api";

import { fetchSession, login } from "./api.ts";

vi.mock("@/shared/api", async () => ({
  apiClient: {
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
  advanceSession: vi.fn(),
  getSessionSignal: vi.fn(),
  setAccessToken: vi.fn(),
}));

const syntheticCredential = "synthetic-test-credential";
let session: AbortController;

beforeEach(() => {
  session = new AbortController();
  vi.mocked(getSessionSignal).mockReturnValue(session.signal);
  vi.mocked(apiClient.post).mockResolvedValue({});
});

describe("authentication API", () => {
  it("accepts a bodyless login response and advances the session", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);
    const params = { mobile: "9120000000", password: syntheticCredential };

    await expect(login(params)).resolves.toBeUndefined();
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
      "/auth/login",
      params,
      {
        signal: undefined,
      },
    );
    expect(advanceSession).toHaveBeenCalledOnce();
    expect(setAccessToken).not.toHaveBeenCalled();
  });

  it("leaves the session generation unchanged when login fails", async () => {
    const failure = new Error("Invalid credentials");
    vi.mocked(apiClient.post).mockRejectedValueOnce(failure);

    await expect(
      login({ mobile: "9120000000", password: syntheticCredential }),
    ).rejects.toBe(failure);
    expect(advanceSession).not.toHaveBeenCalled();
  });

  it.each(["caller", "session"] as const)(
    "ignores an obsolete login after %s cancellation",
    async (source) => {
      const caller = new AbortController();
      let finish!: () => void;
      vi.mocked(apiClient.post).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => resolve(undefined);
          }),
      );
      const pending = login(
        { mobile: "9120000000", password: syntheticCredential },
        caller.signal,
      );
      finish();
      (source === "caller" ? caller : session).abort();

      expect(isCancel(await pending.catch((error: unknown) => error))).toBe(
        true,
      );
      expect(advanceSession).not.toHaveBeenCalled();
    },
  );

  it("reads current roles and effective permissions from the session endpoint", async () => {
    const caller = new AbortController();
    const payload = {
      id: "user-id",
      mobile: "9120000000",
      name: "Sample Operator",
      roles: [{ id: "role-id", name: "Operator" }],
      permissions: ["content.read"],
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(payload);

    await expect(fetchSession(caller.signal)).resolves.toEqual(payload);
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/auth/session", {
      signal: caller.signal,
    });
  });

  it("does not accept an HTML fallback as a signed-in session", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce("<!doctype html>");

    await expect(fetchSession()).rejects.toThrow();
  });
});
