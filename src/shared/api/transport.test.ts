// @vitest-environment node
import axios, { isCancel } from "axios";
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { deferred } from "@/test/deferred";

import { advanceSession } from "./session";

const originalEnv = axios.defaults.env;
const originalAdapter = axios.defaults.adapter;
// In this test process there is no browser origin for relative API URLs.
const nodeAdapter = axios.getAdapter("http");
axios.defaults.adapter = (config) =>
  nodeAdapter({ ...config, baseURL: "http://localhost" + config.baseURL });
axios.defaults.env = { ...originalEnv, FormData };
const { apiClient } = await import("./client");
const server = setupServer(
  http.get("http://localhost/api/v1/auth/csrf", () =>
    HttpResponse.json({ requestToken: "synthetic-csrf" }),
  ),
);

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  advanceSession();
});
afterAll(() => {
  server.close();
  axios.defaults.adapter = originalAdapter;
  axios.defaults.env = originalEnv;
});

it("sends the MP4 payload unchanged as raw bytes with CSRF", async () => {
  const bytes = Uint8Array.of(0, 255, 47, 160);
  const file = new File([bytes], "synthetic.mp4", { type: "video/mp4" });
  server.use(
    http.post("http://localhost/api/v1/admin/videos", async ({ request }) => {
      expect(request.headers.get("x-csrf-token")).toBe("synthetic-csrf");
      expect(request.headers.get("content-type")).toBe("video/mp4");
      expect(new Uint8Array(await request.arrayBuffer())).toEqual(bytes);
      return HttpResponse.json({
        id: "synthetic-video",
        sizeBytes: bytes.length,
      });
    }),
  );

  await expect(
    apiClient.post("/admin/videos", file, {
      headers: { "Content-Type": "video/mp4" },
    }),
  ).resolves.toEqual({ id: "synthetic-video", sizeBytes: bytes.length });
});

describe("multipart HTTP boundary", () => {
  it("sends the CSRF header and preserves file bytes and context", async () => {
    const file = new File([Uint8Array.of(0, 17, 255)], "synthetic.bin", {
      type: "application/octet-stream",
    });
    server.use(
      http.post("http://localhost/api/v1/admin/images", async ({ request }) => {
        expect(request.headers.get("x-csrf-token")).toBe("synthetic-csrf");
        expect(request.headers.get("content-type")).toMatch(
          /^multipart\/form-data;\s*boundary=.+/,
        );
        const data = await request.formData();
        expect([...data.keys()].sort()).toEqual(["context", "file"]);
        expect(data.get("context")).toBe("contents");
        const received = data.get("file");
        if (received === null || typeof received === "string")
          throw new Error("Expected the serialized upload to contain a file");

        expect(received.name).toBe(file.name);
        expect(received.type).toBe(file.type);
        expect(new Uint8Array(await received.arrayBuffer())).toEqual(
          Uint8Array.of(0, 17, 255),
        );
        return HttpResponse.json({
          id: "synthetic-image",
          sizeBytes: file.size,
        });
      }),
    );

    await expect(
      apiClient.upload("/admin/images", { context: "contents", file }),
    ).resolves.toEqual({ id: "synthetic-image", sizeBytes: file.size });
  });

  it.each(["caller", "session"] as const)(
    "cancels a pending upload when its %s becomes obsolete",
    async (scope) => {
      const entered = deferred<void>();
      const release = deferred<void>();
      const returned = deferred<void>();
      let requestEntered = false;
      server.use(
        http.post("http://localhost/api/v1/admin/images", async () => {
          requestEntered = true;
          entered.resolve();
          try {
            await release.promise;
            return HttpResponse.json({ id: "late-image", sizeBytes: 1 });
          } finally {
            returned.resolve();
          }
        }),
      );
      const controller = new AbortController();
      const pending = apiClient.upload(
        "/admin/images",
        { context: "contents", file: new File(["x"], "synthetic.bin") },
        { signal: controller.signal },
      );
      const settled = pending.catch((error: unknown) => error);

      try {
        await Promise.race([entered.promise, pending]);
        if (scope === "caller") controller.abort();
        else advanceSession();
        release.resolve();
        expect(isCancel(await settled)).toBe(true);
      } finally {
        release.resolve();
        await settled;
        if (requestEntered) await returned.promise;
      }
    },
  );
});
