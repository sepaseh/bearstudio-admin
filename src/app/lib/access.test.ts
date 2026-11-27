import { describe, expect, it } from "vitest";

import type { AdministratorSession } from "@/features/auth";

import {
  getAllowedNavigation,
  getRoutePermissions,
  hasRouteAccess,
} from "./access";

const createUser = (
  overrides: Partial<AdministratorSession> = {},
): AdministratorSession => ({
  id: "user-1",
  mobile: "9120000000",
  name: "Test User",
  permissions: [],
  roles: [],
  ...overrides,
});

describe("access policy", () => {
  it("allows only public routes without a user", () => {
    expect(hasRouteAccess("auth")).toBe(true);
    expect(hasRouteAccess("root")).toBe(false);
    expect(hasRouteAccess("users")).toBe(false);
  });

  it("allows authenticated routes without granting permission routes", () => {
    const user = createUser();

    expect(hasRouteAccess("root", user)).toBe(true);
    expect(hasRouteAccess("settings", user)).toBe(false);
    expect(hasRouteAccess("users", user)).toBe(false);
  });

  it("does not use a legacy administrator flag to grant permissions", () => {
    const user = { ...createUser(), isSystemAdmin: true };

    expect(hasRouteAccess("users", user)).toBe(false);
    expect(getRoutePermissions("roles", user)).toEqual({
      canCreate: false,
      canDelete: false,
      canUpdate: false,
    });
  });

  it("uses the Bear Studio access write permissions", () => {
    expect(
      getRoutePermissions(
        "users",
        createUser({ permissions: ["users.create", "users.update"] }),
      ),
    ).toEqual({ canCreate: false, canSetPassword: false, canUpdate: false });

    expect(
      getRoutePermissions("users", { permissions: ["users.write"] }),
    ).toEqual({
      canCreate: true,
      canSetPassword: true,
      canUpdate: true,
    });
    expect(
      getRoutePermissions("roles", { permissions: ["roles.write"] }),
    ).toEqual({
      canCreate: true,
      canDelete: true,
      canUpdate: true,
    });
  });

  it("removes empty navigation groups", () => {
    expect(getAllowedNavigation(createUser())).toEqual([{ route: "root" }]);
  });

  it.each([
    { permissions: ["users.read"], children: [{ route: "users" }] },
    { permissions: ["roles.read"], children: [{ route: "roles" }] },
    {
      permissions: ["users.read", "roles.read"],
      children: [{ route: "users" }, { route: "roles" }],
    },
  ])(
    "shows permitted user management links for $permissions",
    ({ permissions, children }) => {
      expect(getAllowedNavigation({ permissions })).toEqual([
        { route: "root" },
        { children, key: "userManagement", label: "userManagement" },
      ]);
    },
  );

  it("requires content.read for Home page and FAQ routes and navigation", () => {
    const user = { permissions: ["content.read"] };
    const legacyUser = { permissions: ["faqs.read"] };

    expect(hasRouteAccess("faqs", user)).toBe(true);
    expect(hasRouteAccess("home", user)).toBe(true);
    expect(getAllowedNavigation(user)).toEqual([
      { route: "root" },
      { route: "services" },
      { route: "projects" },
      {
        children: [{ route: "home" }, { route: "faqs" }],
        key: "content",
        label: "content",
      },
    ]);
    expect(hasRouteAccess("faqs", legacyUser)).toBe(false);
    expect(hasRouteAccess("home", legacyUser)).toBe(false);
    expect(getAllowedNavigation(legacyUser)).toEqual([{ route: "root" }]);
  });

  it("uses dedicated article permissions for both article routes", () => {
    const reader = { permissions: ["articles.read"] };
    const writer = { permissions: ["articles.read", "articles.write"] };
    const contentEditor = { permissions: ["content.read", "content.write"] };
    for (const route of ["articles", "articleCategories"] as const) {
      expect(hasRouteAccess(route, reader)).toBe(true);
      expect(hasRouteAccess(route, contentEditor)).toBe(false);
      expect(getRoutePermissions(route, writer)).toEqual({
        canCreate: true,
        canDelete: true,
        canUpdate: true,
      });
      expect(getRoutePermissions(route, contentEditor)).toEqual({
        canCreate: false,
        canDelete: false,
        canUpdate: false,
      });
    }
    expect(getAllowedNavigation(reader)).toEqual([
      { route: "root" },
      {
        children: [{ route: "articles" }, { route: "articleCategories" }],
        key: "articleManagement",
        label: "articleManagement",
      },
    ]);
  });

  it.each([
    { permissions: ["media.read"] },
    { permissions: ["media.read", "media.write"] },
  ])("shows only Dashboard for $permissions", (user) => {
    expect(getAllowedNavigation(user)).toEqual([{ route: "root" }]);
  });

  it("keeps settings access independent of editorial permissions", () => {
    const contentWriter = {
      permissions: ["content.read", "content.write"],
    };
    const settingsWriter = { permissions: ["settings.read", "settings.write"] };

    expect(hasRouteAccess("settings", contentWriter)).toBe(false);
    expect(hasRouteAccess("settings", settingsWriter)).toBe(true);
    expect(getRoutePermissions("settings", settingsWriter)).toEqual({
      canUpdate: true,
    });
    expect(getRoutePermissions("home", contentWriter)).toEqual({
      canUpdate: true,
    });
  });

  it.each([
    { permissions: ["content.read"], write: false },
    {
      permissions: ["content.read", "content.write"],
      write: true,
    },
  ])("maps FAQ actions from $permissions", ({ permissions, write }) => {
    expect(getRoutePermissions("faqs", { permissions })).toEqual({
      canCreate: write,
      canDelete: write,
      canUpdate: write,
    });
  });
});
