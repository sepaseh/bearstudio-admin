import axios, {
  type AxiosAdapter,
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { advanceSession } from "./session";

const adapter = vi.fn<AxiosAdapter>();
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = adapter;
const { apiClient, setUnauthorizedHandler } = await import("./client");

const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
  headers: AxiosResponse["headers"] = {},
): AxiosResponse => ({
  config,
  data,
  headers,
  status,
  statusText: String(status),
});

const failure = (
  config: InternalAxiosRequestConfig,
  status: number,
  code: string,
  cause?: Record<string, unknown>,
) =>
  new AxiosError(
    "Request failed",
    "ERR_BAD_REQUEST",
    config,
    undefined,
    response(config, { message: "A controlled failure", cause }, status, {
      "X-Error-Code": code,
      "X-Request-Id": "0HREQ:00000001",
    }),
  );

beforeEach(() => {
  advanceSession();
  adapter.mockReset();
});

afterEach(() => {
  setUnauthorizedHandler(null);
});

afterAll(() => {
  axios.defaults.adapter = originalAdapter;
});

it("uses the panel origin, sends the fresh CSRF token and preserves camelCase JSON", async () => {
  adapter.mockImplementation(async (config) => {
    expect(config.baseURL).toBe("/api/v1");
    expect(config.withCredentials).toBe(true);
    expect(config.headers.has("Authorization")).toBe(false);
    if (config.url === "/auth/csrf") {
      expect(config.method).toBe("get");
      expect(config.headers.has("X-CSRF-TOKEN")).toBe(false);
      return response(config, { requestToken: "synthetic-csrf" });
    }

    expect(config.method).toBe("patch");
    expect(config.headers.get("X-CSRF-TOKEN")).toBe("synthetic-csrf");
    expect(JSON.parse(config.data)).toEqual({
      title: "Synthetic project",
      isFeatured: false,
    });
    return response(config, {
      title: "Synthetic project",
      isFeatured: false,
      preview: null,
    });
  });

  await expect(
    apiClient.patch("/admin/projects/synthetic-id", {
      title: "Synthetic project",
      isFeatured: false,
    }),
  ).resolves.toEqual({
    title: "Synthetic project",
    isFeatured: false,
    preview: null,
  });
  expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
    "/auth/csrf",
    "/admin/projects/synthetic-id",
  ]);
});

it("obtains a new token for the signed-in cookie before bodyless logout", async () => {
  let token = "anonymous-csrf";
  adapter.mockImplementation(async (config) => {
    if (config.url === "/auth/csrf") {
      return response(config, { requestToken: token });
    }

    expect(config.headers.get("X-CSRF-TOKEN")).toBe(token);
    if (config.url === "/auth/logout") {
      expect(config.data).toBeUndefined();
      expect(token).toBe("signed-in-csrf");
    }
    return response(config, "", 204);
  });

  await expect(
    apiClient.post("/auth/login", {
      mobile: "9121234567",
      password: "synthetic",
    }),
  ).resolves.toBeUndefined();
  advanceSession();
  token = "signed-in-csrf";
  await expect(apiClient.post("/auth/logout")).resolves.toBeUndefined();
  expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
    "/auth/csrf",
    "/auth/login",
    "/auth/csrf",
    "/auth/logout",
  ]);
});

it("maps validation causes to form errors and does not retry a rejected write", async () => {
  adapter.mockImplementation(async (config) => {
    if (config.url === "/auth/csrf") {
      return response(config, { requestToken: "synthetic-csrf" });
    }
    throw failure(config, 400, "VALIDATION_FAILED", {
      mobile: "Use ten digits.",
      unexpected: ["ignored"],
    });
  });

  await expect(apiClient.post("/auth/login", {})).rejects.toMatchObject({
    status: 400,
    message: "A controlled failure",
    code: "VALIDATION_FAILED",
    errors: { mobile: ["Use ten digits."] },
    requestId: "0HREQ:00000001",
  });
  expect(adapter).toHaveBeenCalledTimes(2);
});

it("shows a local fallback for non-JSON failures and keeps the request ID", async () => {
  adapter.mockImplementation(async (config) => {
    throw new AxiosError(
      "Request failed",
      "ERR_BAD_RESPONSE",
      config,
      undefined,
      response(config, "<html>Upstream failure</html>", 502, {
        "X-Request-Id": "synthetic-proxy-request",
      }),
    );
  });

  await expect(apiClient.get("/admin/roles")).rejects.toMatchObject({
    status: 502,
    message: i18n.t("unexpectedError"),
    requestId: "synthetic-proxy-request",
  });
});

it("distinguishes a failed login and forbidden response from loss of an admin session", async () => {
  const onUnauthorized = vi.fn();
  setUnauthorizedHandler(onUnauthorized);
  adapter.mockImplementation(async (config) => {
    switch (config.url) {
      case "/auth/csrf":
        return response(config, { requestToken: "synthetic-csrf" });
      case "/auth/login":
        throw failure(config, 401, "INVALID_CREDENTIALS");
      case "/auth/session":
        throw failure(config, 401, "UNAUTHENTICATED");
      case "/admin/roles":
        throw failure(config, 403, "FORBIDDEN");
      default:
        throw failure(config, 401, "UNAUTHENTICATED");
    }
  });

  await expect(apiClient.post("/auth/login", {})).rejects.toMatchObject({
    status: 401,
    code: "INVALID_CREDENTIALS",
  });
  await expect(apiClient.get("/auth/session")).rejects.toMatchObject({
    status: 401,
    code: "UNAUTHENTICATED",
  });
  await expect(apiClient.get("/admin/roles")).rejects.toMatchObject({
    status: 403,
    code: "FORBIDDEN",
  });
  expect(onUnauthorized).not.toHaveBeenCalled();

  const results = await Promise.allSettled([
    apiClient.get("/admin/users"),
    apiClient.get("/admin/users"),
  ]);
  expect(results).toMatchObject([
    { status: "rejected", reason: { status: 401 } },
    { status: "rejected", reason: { status: 401 } },
  ]);
  expect(onUnauthorized).toHaveBeenCalledOnce();
  expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
    "/auth/csrf",
    "/auth/login",
    "/auth/session",
    "/admin/roles",
    "/admin/users",
    "/admin/users",
  ]);
});

it("fails closed if a CSRF response does not contain a request token", async () => {
  adapter.mockImplementation(async (config) =>
    response(config, { requestToken: "" }),
  );

  await expect(apiClient.post("/auth/login", {})).rejects.toMatchObject({
    name: "AdminApiError",
  });
  expect(adapter).toHaveBeenCalledOnce();
  expect(adapter.mock.calls[0]?.[0].url).toBe("/auth/csrf");
});

it("does not dispatch a write if its caller cancels during CSRF acquisition", async () => {
  const entered = deferred<void>();
  const token = deferred<string>();
  adapter.mockImplementation(async (config) => {
    entered.resolve();
    return response(config, { requestToken: await token.promise });
  });
  const controller = new AbortController();
  const write = apiClient.post(
    "/auth/login",
    {},
    { signal: controller.signal },
  );
  const canceled = expect(write).rejects.toSatisfy(axios.isCancel);

  await entered.promise;
  controller.abort();
  token.resolve("late-csrf");
  await canceled;
  expect(adapter).toHaveBeenCalledOnce();
});

it("cancels an obsolete 401 without invalidating a newer session", async () => {
  const onUnauthorized = vi.fn();
  setUnauthorizedHandler(onUnauthorized);
  const entered = deferred<void>();
  const release = deferred<void>();
  adapter.mockImplementation(async (config) => {
    entered.resolve();
    await release.promise;
    throw failure(config, 401, "UNAUTHENTICATED");
  });
  const oldRequest = apiClient.get("/admin/roles");
  const canceled = expect(oldRequest).rejects.toSatisfy(axios.isCancel);

  await entered.promise;
  advanceSession();
  release.resolve();
  await canceled;
  expect(onUnauthorized).not.toHaveBeenCalled();
});

it("rejects paths outside the API before reading a CSRF token", async () => {
  await expect(
    apiClient.post("https://other.example.test/auth/login", {}),
  ).rejects.toBeInstanceOf(TypeError);
  expect(adapter).not.toHaveBeenCalled();
});
