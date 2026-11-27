import type { ParseKeys } from "i18next";

import type { PermissionKey } from "@/features/roles";

export type AccessRule = "authenticated" | "public" | PermissionKey;
export type RouteLayout = "auth" | "default" | "standalone";

type RoutePermissions = {
  access: AccessRule;
  actions: Record<string, PermissionKey>;
};

type RouteConfig = {
  index?: boolean;
  label?: ParseKeys;
  layout: RouteLayout;
  link?: (...args: never[]) => string;
  path: string;
  routePattern?: string;
  permissions: RoutePermissions;
};

const projectsPath = "/projects";

export const routeTree = {
  articleCategories: {
    label: "articleCategories",
    layout: "default",
    path: "/article-categories",
    permissions: {
      access: "articles.read",
      actions: {
        canCreate: "articles.write",
        canDelete: "articles.write",
        canUpdate: "articles.write",
      },
    },
  },
  articles: {
    label: "articles",
    layout: "default",
    path: "/articles",
    permissions: {
      access: "articles.read",
      actions: {
        canCreate: "articles.write",
        canDelete: "articles.write",
        canUpdate: "articles.write",
      },
    },
  },
  auth: {
    index: true,
    layout: "auth",
    path: "/auth",
    permissions: { access: "public", actions: {} },
  },
  faqs: {
    label: "faqs",
    layout: "default",
    path: "/faqs",
    permissions: {
      access: "content.read",
      actions: {
        canCreate: "content.write",
        canDelete: "content.write",
        canUpdate: "content.write",
      },
    },
  },
  home: {
    label: "homePage",
    layout: "default",
    path: "/pages/home",
    permissions: {
      access: "content.read",
      actions: { canUpdate: "content.write" },
    },
  },
  notFound: {
    layout: "standalone",
    path: "*",
    permissions: { access: "public", actions: {} },
  },
  projects: {
    label: "projects",
    layout: "default",
    link: (slug: string) => projectsPath + "/" + slug,
    path: projectsPath,
    routePattern: projectsPath + "/:slug?",
    permissions: {
      access: "content.read",
      actions: {
        canCreate: "content.write",
        canDelete: "content.write",
        canUpdate: "content.write",
      },
    },
  },
  roles: {
    label: "roles",
    layout: "default",
    path: "/roles",
    permissions: {
      access: "roles.read",
      actions: {
        canCreate: "roles.write",
        canDelete: "roles.write",
        canUpdate: "roles.write",
      },
    },
  },
  root: {
    index: true,
    label: "dashboard",
    layout: "default",
    path: "/",
    permissions: { access: "authenticated", actions: {} },
  },
  services: {
    label: "services",
    layout: "default",
    path: "/services",
    permissions: {
      access: "content.read",
      actions: {
        canCreate: "content.write",
        canDelete: "content.write",
        canUpdate: "content.write",
      },
    },
  },
  settings: {
    label: "settings",
    layout: "default",
    path: "/settings",
    permissions: {
      access: "settings.read",
      actions: { canUpdate: "settings.write" },
    },
  },
  users: {
    label: "users",
    layout: "default",
    path: "/users",
    permissions: {
      access: "users.read",
      actions: {
        canCreate: "users.write",
        canSetPassword: "users.write",
        canUpdate: "users.write",
      },
    },
  },
} satisfies Record<string, RouteConfig>;

export type RouteKey = keyof typeof routeTree;

type NavigationRouteKey = {
  [Key in RouteKey]: (typeof routeTree)[Key] extends { label: ParseKeys }
    ? Key
    : never;
}[RouteKey];

export type NavigationItem =
  | { readonly route: NavigationRouteKey }
  | {
      readonly children: readonly NavigationItem[];
      readonly key: string;
      readonly label: ParseKeys;
    };

export const navigationTree: readonly NavigationItem[] = [
  { route: "root" },
  { route: "services" },
  { route: "projects" },
  {
    children: [{ route: "home" }, { route: "faqs" }],
    key: "content",
    label: "content",
  },
  {
    children: [{ route: "articles" }, { route: "articleCategories" }],
    key: "articleManagement",
    label: "articleManagement",
  },
  {
    children: [{ route: "users" }, { route: "roles" }],
    key: "userManagement",
    label: "userManagement",
  },
  { route: "settings" },
];

export const baseUrl: string = import.meta.env.VITE_APP_BASE_URL ?? "";
