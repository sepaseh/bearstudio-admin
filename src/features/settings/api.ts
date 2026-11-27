import { apiClient } from "@/shared/api";

import type {
  AdminSettings,
  AdminSettingsInput,
  PanelAppearance,
  Settings,
  SettingsRequest,
} from "./types.ts";

const basePath = "/settings";

export const fetchSettings = (signal?: AbortSignal): Promise<Settings> =>
  apiClient.get<Settings>(basePath, { signal, timeout: 15_000 });

export const fetchLanguages = (
  signal?: AbortSignal,
): Promise<Settings["language"][]> =>
  apiClient.get<Settings["language"][]>("/languages", { signal });

export const updateSettings = (
  params: SettingsRequest,
  signal?: AbortSignal,
): Promise<Settings> => apiClient.put<Settings>(basePath, params, { signal });

const adminPath = "/admin/settings";

export const fetchPanelAppearance = (signal?: AbortSignal) =>
  apiClient.get<PanelAppearance>("/public/settings", {
    signal,
    timeout: 15_000,
  });

export const fetchAdminSettings = (signal?: AbortSignal) =>
  apiClient.get<AdminSettings>(adminPath, { signal });

export const saveAdminSettings = (
  values: AdminSettingsInput,
  signal?: AbortSignal,
) => apiClient.put<AdminSettings>(adminPath, values, { signal });
