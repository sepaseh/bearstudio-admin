import type { AxiosRequestConfig } from "axios";

export type UploadProgressHandler = NonNullable<
  AxiosRequestConfig["onUploadProgress"]
>;

export type PaginationQuery = { page?: string };
