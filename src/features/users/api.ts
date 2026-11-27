import { apiClient } from "@/shared/api";

import type {
  ManagedUser,
  UserPasswordRequest,
  UserRequest,
  UserRoleRequest,
  UserUpdateRequest,
} from "./types";

const basePath = "/admin/users";
const userPath = (id: string) => `${basePath}/${id}`;

export const createUser = (
  { mobile, name, password }: UserRequest,
  signal?: AbortSignal,
): Promise<ManagedUser> =>
  apiClient.post<ManagedUser>(basePath, { mobile, name, password }, { signal });

export const fetchUser = (
  id: string,
  signal?: AbortSignal,
): Promise<ManagedUser> => apiClient.get<ManagedUser>(userPath(id), { signal });

export const fetchUsers = (signal?: AbortSignal): Promise<ManagedUser[]> =>
  apiClient.get<ManagedUser[]>(basePath, { signal });

export const updateUser = (
  id: string,
  { isActive, name }: UserUpdateRequest,
  signal?: AbortSignal,
): Promise<ManagedUser> =>
  apiClient.patch<ManagedUser>(
    userPath(id),
    {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(name !== undefined ? { name } : {}),
    },
    { signal },
  );

export const updateUserPassword = (
  id: string,
  { newPassword }: UserPasswordRequest,
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.post<void>(userPath(id) + "/password", { newPassword }, { signal });

export const updateUserRoles = (
  id: string,
  { roleIds }: UserRoleRequest,
  signal?: AbortSignal,
): Promise<ManagedUser> =>
  apiClient.patch<ManagedUser>(
    userPath(id) + "/roles",
    { roleIds },
    { signal },
  );
