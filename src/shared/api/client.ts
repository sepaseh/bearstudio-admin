import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  CanceledError,
} from "axios";

import { i18n } from "@/shared/i18n";

import { apiUrl } from "./config";
import { getSessionSignal } from "./session";

type ApiErrorMetadata = {
  code?: string;
  errors?: Record<string, string[]>;
  requestId?: string;
};

type Method = "get" | "post" | "put" | "patch" | "delete";

const api = axios.create({ baseURL: apiUrl, withCredentials: true });
const csrfTimeout = 15_000;
let onUnauthorized: (() => void) | null = null;
let reportedUnauthorized: AbortSignal | undefined;

export class AdminApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly errors?: Record<string, string[]>;
  readonly requestId?: string;

  constructor(message: string, status?: number, metadata?: ApiErrorMetadata) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = metadata?.code;
    this.errors = metadata?.errors;
    this.requestId = metadata?.requestId;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const safeRequestId = (value: unknown): string | undefined =>
  typeof value === "string" && /^[\w=:-]{1,128}$/.test(value)
    ? value
    : undefined;

const readResponseHeader = (headers: AxiosResponse["headers"], name: string) =>
  headers instanceof AxiosHeaders
    ? headers.get(name)
    : Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];

const createResponseError = (response: AxiosResponse<unknown>) => {
  const { data, headers, status } = response;
  const body = isRecord(data) ? data : {};
  const code = readResponseHeader(headers, "x-error-code");
  const errors = isRecord(body.cause)
    ? Object.fromEntries(
        Object.entries(body.cause)
          .filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          )
          .map(([field, message]): [string, string[]] => [field, [message]]),
      )
    : undefined;

  return new AdminApiError(
    typeof body.message === "string" && body.message.trim()
      ? body.message
      : i18n.t("unexpectedError"),
    status,
    {
      code: typeof code === "string" ? code : undefined,
      errors,
      requestId: safeRequestId(readResponseHeader(headers, "x-request-id")),
    },
  );
};

const normalizeTransportError = (error: unknown): AdminApiError => {
  if (error instanceof AdminApiError) return error;

  if (axios.isAxiosError<unknown>(error)) {
    if (error.response) return createResponseError(error.response);
    if (
      [AxiosError.ETIMEDOUT, AxiosError.ECONNABORTED].includes(error.code ?? "")
    )
      return new AdminApiError(i18n.t("requestTimeout"));

    if (error.request) return new AdminApiError(i18n.t("networkError"));
  }

  return new AdminApiError(i18n.t("unexpectedError"));
};

const readCsrfToken = async (signal: AbortSignal): Promise<string> => {
  const { data } = await api.get<unknown>("/auth/csrf", {
    signal,
    timeout: csrfTimeout,
  });
  if (
    !isRecord(data) ||
    typeof data.requestToken !== "string" ||
    !data.requestToken.trim()
  ) {
    throw new AdminApiError(i18n.t("unexpectedError"));
  }

  return data.requestToken;
};

const assertActive = (signal: AbortSignal) => {
  if (signal.aborted) throw new CanceledError();
};

const request = async <T>(
  method: Method,
  url: string,
  config?: AxiosRequestConfig,
  data?: unknown,
  multipart = false,
): Promise<T> => {
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) {
    throw new TypeError("Use a path relative to the panel API.");
  }

  const generation = getSessionSignal();
  const signal = config?.signal
    ? AbortSignal.any([generation, config.signal as AbortSignal])
    : generation;

  try {
    assertActive(signal);
    const headers: AxiosRequestConfig["headers"] = { ...config?.headers };
    if (method !== "get") headers["X-CSRF-TOKEN"] = await readCsrfToken(signal);
    if (multipart) headers["Content-Type"] = "multipart/form-data";

    assertActive(signal);
    const response = await api.request<T>({
      ...config,
      baseURL: apiUrl,
      data,
      headers,
      method,
      signal,
      url,
      withCredentials: true,
    });
    assertActive(signal);
    return response.status === 204 ? (undefined as T) : response.data;
  } catch (error) {
    assertActive(signal);
    if (axios.isCancel(error)) throw error;

    const failure = normalizeTransportError(error);
    if (
      failure.status === 401 &&
      url.startsWith("/admin/") &&
      reportedUnauthorized !== generation
    ) {
      reportedUnauthorized = generation;
      onUnauthorized?.();
    }

    throw failure;
  }
};

export const apiClient = {
  del: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>("delete", url, config),
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>("get", url, config),
  patch: <T>(
    url: string,
    data?: Record<string, unknown>,
    config?: AxiosRequestConfig,
  ) => request<T>("patch", url, config, data),
  post: <T>(
    url: string,
    data?: Record<string, unknown> | Blob,
    config?: AxiosRequestConfig,
  ) => request<T>("post", url, config, data),
  put: <T>(
    url: string,
    data?: Record<string, unknown>,
    config?: AxiosRequestConfig,
  ) => request<T>("put", url, config, data),
  upload: <T>(
    url: string,
    data: Record<string, unknown>,
    config?: AxiosRequestConfig,
  ) => request<T>("post", url, config, data, true),
};

export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};
