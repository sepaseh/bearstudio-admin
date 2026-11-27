import { beforeEach, expect, it, vi } from "vitest";

import {
  deleteFile,
  fetchImages,
  fetchVideos,
  uploadFile,
  uploadImage,
  uploadVideo,
} from "./api";

const { del, get, upload } = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/shared/api", () => ({ apiClient: { del, get, upload } }));
beforeEach(() => {
  vi.resetAllMocks();
});

it("only forwards page and the supported image context to their separate lists", async () => {
  const { signal } = new AbortController();
  const extras = { context: "editorial" as const, page: 2, pageSize: 5 };
  await fetchImages(extras, signal);
  await fetchVideos(extras, signal);

  expect(get).toHaveBeenNthCalledWith(1, "/admin/images", {
    params: { context: "editorial", page: 2 },
    signal,
  });
  expect(get).toHaveBeenNthCalledWith(2, "/admin/videos", {
    params: { page: 2 },
    signal,
  });
});

it("sends images and MP4 as multipart with their required metadata", async () => {
  const { signal } = new AbortController();
  const onUploadProgress = vi.fn();
  const image = new File(["image"], "image.webp", { type: "image/webp" });
  const thumbnail = new File(["thumbnail"], "thumbnail.jpg", {
    type: "image/jpeg",
  });
  const video = new File(["video"], "video.mp4", { type: "video/mp4" });
  const imageInput = {
    file: image,
    context: "logo" as const,
  };
  const unexpectedImageName = {
    ...imageInput,
    name: "Studio logo",
  };
  const videoInput = {
    file: video,
    thumbnail,
  };
  const unexpectedVideoName = { ...videoInput, name: "Demo video" };
  await uploadImage(unexpectedImageName, onUploadProgress, signal);
  await uploadVideo(unexpectedVideoName, onUploadProgress, signal);

  expect(upload).toHaveBeenNthCalledWith(1, "/admin/images", imageInput, {
    onUploadProgress,
    signal,
  });
  expect(upload).toHaveBeenNthCalledWith(2, "/admin/videos", videoInput, {
    onUploadProgress,
    signal,
  });
});

it("deletes a file at its UUID path and forwards cancellation", async () => {
  const controller = new AbortController();
  const id = "22222222-2222-4222-8222-222222222222";
  await deleteFile(id, controller.signal);

  expect(del).toHaveBeenCalledExactlyOnceWith(`/files/${id}`, {
    signal: controller.signal,
  });
});

it("keeps upload cancellation, progress and file context together", async () => {
  const controller = new AbortController();
  const file = new File(["synthetic-image"], "synthetic.png", {
    type: "image/png",
  });
  const onUploadProgress = vi.fn();
  const storedFile = {
    id: "synthetic-upload",
    isUsed: false,
    size: file.size,
    url: "https://example.invalid/synthetic.png",
  };
  upload.mockResolvedValue(storedFile);

  await expect(
    uploadFile(file, "contents", onUploadProgress, controller.signal),
  ).resolves.toBe(storedFile);
  expect(upload).toHaveBeenCalledWith(
    "/files",
    { context: "contents", file },
    { onUploadProgress, signal: controller.signal },
  );
});
