import type { Role } from "@/features/roles";

import type { userStatuses } from "./constants";

export type User = {
  firstName: string;
  id: string;
  isSystemAdmin: boolean;
  lastName: string;
  mobile: string;
  roles: Array<Pick<Role, "id" | "name">>;
  status: (typeof userStatuses)[number];
};

export type UserRole = { id: string; name: string };

export type ManagedUser = {
  id: string;
  isActive: boolean;
  mobile: string;
  name: string;
  roles: UserRole[];
};

export type UserRoleRequest = { roleIds: string[] };

export type UserRequest = {
  mobile: string;
  name: string;
  password: string;
};

export type UserUpdateRequest = Partial<Pick<ManagedUser, "isActive" | "name">>;

export type UserPasswordRequest = { newPassword: string };

export type LoadUserRoles = (
  signal?: AbortSignal,
) => Promise<(UserRole & { permissions: string[] })[]>;

export type UserViewer = { id: string; permissions: readonly string[] };
