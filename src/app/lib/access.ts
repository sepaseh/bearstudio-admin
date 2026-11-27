import {
  type AccessRule,
  type NavigationItem,
  navigationTree,
  type RouteKey,
  routeTree,
} from "@/app/config";
import type { PermissionKey } from "@/features/roles";

type Viewer = { permissions: readonly string[] };

const hasAccess = (access: AccessRule, user?: Viewer): boolean => {
  if (access === "public") return true;
  if (!user) return false;
  if (access === "authenticated") return true;

  return user.permissions.includes(access);
};

export const hasRouteAccess = (route: RouteKey, user?: Viewer): boolean =>
  hasAccess(routeTree[route].permissions.access, user);

const filterNavigation = (
  items: readonly NavigationItem[],
  user?: Viewer,
): NavigationItem[] =>
  items.flatMap<NavigationItem>((item): NavigationItem[] => {
    if ("route" in item) {
      return hasRouteAccess(item.route, user) ? [item] : [];
    }

    const children = filterNavigation(item.children, user);
    return children.length ? [{ ...item, children }] : [];
  });

export const getAllowedNavigation = (user?: Viewer): NavigationItem[] =>
  filterNavigation(navigationTree, user);

const hasPermission = (permission: PermissionKey, user?: Viewer): boolean =>
  Boolean(user?.permissions.includes(permission));

type RouteActionPermissions<Key extends RouteKey> = {
  [Action in keyof (typeof routeTree)[Key]["permissions"]["actions"]]: boolean;
};

export const getRoutePermissions = <Key extends RouteKey>(
  route: Key,
  user?: Viewer,
): RouteActionPermissions<Key> => {
  const actions: Record<string, PermissionKey> =
    routeTree[route].permissions.actions;
  return Object.fromEntries(
    Object.entries(actions).map(([action, permission]) => [
      action,
      hasPermission(permission, user),
    ]),
  ) as RouteActionPermissions<Key>;
};
