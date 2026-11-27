// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

import { captureVideoThumbnail } from "./thumbnail";

const file = new File(["synthetic video"], "clip.mp4", { type: "video/mp4" });

const captureFixture = ({ decode = true } = {}) => {
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const crop = vi.fn();
  const seek = vi.fn();
  const createObjectUrl = vi.fn(() => "blob:synthetic-clip");
  const revokeObjectUrl = vi.fn();
  const reset = vi.spyOn(video, "load").mockImplementation(() => undefined);
  const detach = vi.spyOn(video, "removeEventListener");
  const encode = vi.fn<
    (callback: BlobCallback, type?: string, quality?: number) => void
  >((callback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })));

  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectUrl;
      static revokeObjectURL = revokeObjectUrl;
    },
  );
  Object.defineProperties(video, {
    currentTime: {
      get: () => 0,
      set: (seconds: number) => {
        seek(seconds);
        queueMicrotask(() => video.dispatchEvent(new Event("seeked")));
      },
    },
    duration: { value: 0.8 },
    src: {
      set: () => {
        if (decode)
          queueMicrotask(() => video.dispatchEvent(new Event("loadeddata")));
      },
    },
    videoHeight: { value: 90 },
    videoWidth: { value: 160 },
  });
  Object.defineProperties(canvas, {
    getContext: { value: () => ({ drawImage: crop }) },
    toBlob: { value: encode },
  });

  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((name, options) => {
    if (name === "video") return video;
    if (name === "canvas") return canvas;
    return create(name, options);
  });

  return {
    canvas,
    createObjectUrl,
    crop,
    detach,
    encode,
    reset,
    revokeObjectUrl,
    seek,
    video,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("captures a representative frame and center-crops it to the configured thumbnail profile", async () => {
  const {
    canvas,
    createObjectUrl,
    crop,
    encode,
    reset,
    revokeObjectUrl,
    seek,
    video,
  } = captureFixture();
  encode.mockImplementationOnce((callback) => {
    callback(
      new Blob([new Uint8Array(1024 * 1024 + 1)], { type: "image/jpeg" }),
    );
  });
  const { signal } = new AbortController();

  const output = await captureVideoThumbnail(
    file,
    { width: 120, height: 120 },
    signal,
  );

  expect(createObjectUrl).toHaveBeenCalledExactlyOnceWith(file);
  expect(seek).toHaveBeenCalledExactlyOnceWith(0.4);
  expect(canvas.width).toBe(120);
  expect(canvas.height).toBe(120);
  expect(crop).toHaveBeenCalledExactlyOnceWith(
    video,
    35,
    0,
    90,
    90,
    0,
    0,
    120,
    120,
  );
  expect(encode.mock.calls.map(([, type, quality]) => [type, quality])).toEqual(
    [
      ["image/jpeg", 0.82],
      ["image/jpeg", 0.6],
    ],
  );
  expect(output.name).toBe("thumbnail.jpg");
  expect(output.type).toBe("image/jpeg");
  expect(output.size).toBe(4);
  expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith(
    "blob:synthetic-clip",
  );
  expect(reset).toHaveBeenCalledOnce();
});

it("cancels a pending decode and releases the video and listeners", async () => {
  const { crop, detach, reset, revokeObjectUrl } = captureFixture({
    decode: false,
  });
  const controller = new AbortController();
  const pending = captureVideoThumbnail(
    file,
    { width: 200, height: 200 },
    controller.signal,
  );
  controller.abort(new DOMException("Canceled", "AbortError"));

  await expect(pending).rejects.toBe(controller.signal.reason);
  expect(detach).toHaveBeenCalledWith("loadeddata", expect.any(Function));
  expect(detach).toHaveBeenCalledWith("error", expect.any(Function));
  expect(crop).not.toHaveBeenCalled();
  expect(revokeObjectUrl).toHaveBeenCalledOnce();
  expect(reset).toHaveBeenCalledOnce();
});

it("times out when the browser cannot finish decoding", async () => {
  vi.useFakeTimers();
  const { crop, revokeObjectUrl } = captureFixture({ decode: false });
  const { signal } = new AbortController();
  const failure = expect(
    captureVideoThumbnail(file, { width: 200, height: 200 }, signal),
  ).rejects.toHaveProperty("name", "AbortError");

  await vi.advanceTimersByTimeAsync(12_000);
  await failure;
  expect(crop).not.toHaveBeenCalled();
  expect(revokeObjectUrl).toHaveBeenCalledOnce();
});
