import { apiClient, type UploadProgressHandler } from "@/shared/api";

import type {
  FileContext,
  ImageContext,
  ImageFilter,
  ImageRecord,
  StoredFile,
  VideoRecord,
} from "./types";

export const deleteFile = (
  id: StoredFile["id"],
  signal?: AbortSignal,
): Promise<void> => apiClient.del<void>(`/files/${id}`, { signal });

export const uploadFile = (
  file: File,
  context: FileContext,
  onUploadProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): Promise<StoredFile> =>
  apiClient.upload<StoredFile>(
    "/files",
    { context, file },
    { onUploadProgress, signal },
  );

export const fetchImages = (
  { page = 1, context }: { page?: number; context?: ImageFilter } = {},
  signal?: AbortSignal,
) =>
  apiClient.get<{ items: ImageRecord[]; total: number }>("/admin/images", {
    params: { page, ...(context === undefined ? {} : { context }) },
    signal,
  });

export const uploadImage = (
  { context, file }: { context: ImageContext; file: File },
  onUploadProgress?: UploadProgressHandler,
  signal?: AbortSignal,
) =>
  apiClient.upload<ImageRecord>(
    "/admin/images",
    { context, file },
    {
      onUploadProgress,
      signal,
    },
  );

export const fetchVideos = (
  { page = 1 }: { page?: number } = {},
  signal?: AbortSignal,
) =>
  apiClient.get<{ items: VideoRecord[]; total: number }>("/admin/videos", {
    params: { page },
    signal,
  });

export const uploadVideo = (
  { file, thumbnail }: { file: File; thumbnail: File },
  onUploadProgress?: UploadProgressHandler,
  signal?: AbortSignal,
) =>
  apiClient.upload<VideoRecord>(
    "/admin/videos",
    { file, thumbnail },
    {
      onUploadProgress,
      signal,
    },
  );
