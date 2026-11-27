import { apiClient } from "@/shared/api";

import type { HomeInput, HomeRecord } from "./types";

const homePath = "/admin/pages/home";

export const fetchHome = (signal?: AbortSignal) =>
  apiClient.get<HomeRecord>(homePath, { signal });

export const saveHome = (values: HomeInput, signal?: AbortSignal) =>
  apiClient.put<HomeRecord>(homePath, values, { signal });
