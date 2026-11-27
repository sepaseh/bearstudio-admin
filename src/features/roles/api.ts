import { apiClient } from "@/shared/api";

import type { ManagedRole, PermissionDefinition, RoleRequest } from "./types";

const basePath = "/admin/roles";
const rolePath = (id: ManagedRole["id"]) => `${basePath}/${id}`;

export const fetchRoles = (signal?: AbortSignal): Promise<ManagedRole[]> =>
  apiClient.get<ManagedRole[]>(basePath, { signal });

export const fetchRole = (
  id: ManagedRole["id"],
  signal?: AbortSignal,
): Promise<ManagedRole> => apiClient.get<ManagedRole>(rolePath(id), { signal });

export const fetchPermissions = (
  signal?: AbortSignal,
): Promise<PermissionDefinition[]> =>
  apiClient.get<PermissionDefinition[]>("/admin/permissions", { signal });

export const createRole = (
  { name, permissions }: RoleRequest,
  signal?: AbortSignal,
): Promise<ManagedRole> =>
  apiClient.post<ManagedRole>(basePath, { name, permissions }, { signal });

export const updateRole = (
  id: ManagedRole["id"],
  { name, permissions }: Partial<RoleRequest>,
  signal?: AbortSignal,
): Promise<ManagedRole> =>
  apiClient.patch<ManagedRole>(rolePath(id), { name, permissions }, { signal });

export const deleteRole = (
  id: ManagedRole["id"],
  signal?: AbortSignal,
): Promise<void> => apiClient.del<void>(rolePath(id), { signal });

export const sortRoles = (
  { ids }: { ids: string[] },
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.patch<void>(`${basePath}/sort`, { ids }, { signal });
