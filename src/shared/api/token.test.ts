// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAccessToken,
  getAccessToken,
  getAccessTokenVersion,
  getSessionSignal,
  setAccessToken,
} from "./token";

beforeEach(clearAccessToken);
afterEach(() => {
  clearAccessToken();
  vi.restoreAllMocks();
});

describe("session tokens", () => {
  it("keeps tokens in memory and invalidates the preceding login generation", () => {
    const localWrite = vi.spyOn(Storage.prototype, "setItem");
    const anonymousGeneration = getAccessTokenVersion();
    const anonymousSession = getSessionSignal();
    const anonymousVersion = getAccessTokenVersion();

    setAccessToken("synthetic-first-token");
    const firstGeneration = getAccessTokenVersion();
    const firstSession = getSessionSignal();
    setAccessToken("synthetic-second-token");

    expect(firstGeneration).toBeGreaterThan(anonymousGeneration);
    expect(getAccessTokenVersion()).toBeGreaterThan(firstGeneration);
    expect(anonymousSession.aborted).toBe(true);
    expect(firstSession.aborted).toBe(true);
    expect(getSessionSignal().aborted).toBe(false);
    expect(getAccessToken()).toBe("synthetic-second-token");
    expect(getAccessTokenVersion()).toBe(anonymousVersion + 2);
    expect(localWrite).not.toHaveBeenCalled();
  });

  it("aborts session work and clears the credential on logout", () => {
    setAccessToken("synthetic-token");
    const generation = getAccessTokenVersion();
    const session = getSessionSignal();

    clearAccessToken();

    expect(session.aborted).toBe(true);
    expect(getAccessToken()).toBeNull();
    expect(getAccessTokenVersion()).toBeGreaterThan(generation);
    expect(getSessionSignal()).not.toBe(session);
  });
});
