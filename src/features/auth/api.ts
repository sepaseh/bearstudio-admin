import { CanceledError } from "axios";

import { advanceSession, apiClient, getSessionSignal } from "@/shared/api";
import { i18n } from "@/shared/i18n";

import type { AdministratorSession, LoginParams } from "./types";

const basePath = "/auth";

const isNamedRecord = (value: unknown): value is { id: string; name: string } =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "string" &&
  value.id.length > 0 &&
  "name" in value &&
  typeof value.name === "string";

export const login = async (
  params: LoginParams,
  signal?: AbortSignal,
): Promise<void> => {
  const session = getSessionSignal();
  await apiClient.post<void>(`${basePath}/login`, params, {
    signal,
  });
  if (signal?.aborted || session.aborted) {
    throw new CanceledError();
  }
  advanceSession();
};

export const fetchSession = async (
  signal?: AbortSignal,
): Promise<AdministratorSession> => {
  const data = await apiClient.get<unknown>(`${basePath}/session`, { signal });
  if (
    !isNamedRecord(data) ||
    !("mobile" in data) ||
    typeof data.mobile !== "string" ||
    !("roles" in data) ||
    !Array.isArray(data.roles) ||
    !data.roles.every(isNamedRecord) ||
    !("permissions" in data) ||
    !Array.isArray(data.permissions) ||
    !data.permissions.every((permission) => typeof permission === "string")
  ) {
    throw new Error(i18n.t("currentUserLoadFailed"));
  }

  return {
    id: data.id,
    mobile: data.mobile,
    name: data.name,
    roles: data.roles,
    permissions: data.permissions,
  };
};

export const logout = async (): Promise<void> => {
  await apiClient.post<void>(`${basePath}/logout`);
};
