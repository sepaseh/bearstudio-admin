export type PermissionKey =
  | "articles.read"
  | "articles.write"
  | "content.read"
  | "content.write"
  | "faqs.create"
  | "faqs.delete"
  | "faqs.read"
  | "faqs.update"
  | "files.delete"
  | "files.read"
  | "media.read"
  | "media.write"
  | "roles.create"
  | "roles.delete"
  | "roles.read"
  | "roles.write"
  | "roles.update"
  | "settings.update"
  | "settings.read"
  | "settings.write"
  | "users.create"
  | "users.delete"
  | "users.read"
  | "users.write"
  | "users.update";

export type Role = {
  id: string;
  name: string;
  permissions: PermissionKey[];
};

export type ManagedRole = Pick<Role, "id" | "name"> & {
  permissions: string[];
};

export type RoleRequest = Pick<ManagedRole, "name" | "permissions">;

export type PermissionDefinition = { id: string; name: string; group: string };

export type PermissionGroup = {
  name: string;
  permissions: { name: PermissionKey; title: string }[];
  title: string;
};
