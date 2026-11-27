// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminApiError } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { deleteRole, fetchPermissions, fetchRoles } from "./api";
import { RolesPage } from "./Roles";
import type { ManagedRole } from "./types";

const { handleAccessError, messages, modal } = vi.hoisted(() => ({
  handleAccessError: vi.fn(),
  messages: { error: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn() },
}));
vi.mock("./api", () => ({
  deleteRole: vi.fn(),
  fetchPermissions: vi.fn(),
  fetchRoles: vi.fn(),
  sortRoles: vi.fn(),
}));
vi.mock("./components/role-form/RoleForm", () => ({ RoleForm: () => null }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, modalAPI: modal }),
}));

const role: ManagedRole = {
  id: "role-1",
  name: "Operators",
  permissions: ["users.read"],
};
const user = {
  permissions: ["roles.read"],
};
const renderPage = (path = "/roles") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <Outlet context={{ currentUser: user, handleAccessError }} />
          }
        >
          <Route path="*" element={<RolesPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  user.permissions = ["roles.read"];
  vi.mocked(fetchRoles).mockResolvedValue([role]);
  vi.mocked(fetchPermissions).mockResolvedValue([]);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("roles listing", () => {
  it("renders read-only roles without requesting editor-only permission metadata", async () => {
    renderPage();

    await screen.findByText("Operators");
    expect(fetchPermissions).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: i18n.t("order") })).toBeNull();
    for (const action of ["create", "update", "delete"] as const) {
      expect(screen.queryByRole("button", { name: i18n.t(action) })).toBeNull();
    }
    expect(modal.confirm).not.toHaveBeenCalled();
  });

  it("confirms deletion, waits for it, and refreshes the role list", async () => {
    user.permissions.push("roles.write", "users.read");
    const pendingDelete = deferred<void>();
    vi.mocked(deleteRole).mockReturnValue(pendingDelete.promise);
    renderPage();
    await screen.findByText("Operators");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("delete") }));
    expect(deleteRole).not.toHaveBeenCalled();
    const confirmation = modal.confirm.mock.calls[0][0] as {
      onOk: () => Promise<void>;
    };
    let pending!: Promise<void>;
    act(() => {
      pending = confirmation.onOk();
    });
    expect(deleteRole).toHaveBeenCalledExactlyOnceWith(
      "role-1",
      expect.any(AbortSignal),
    );
    expect(fetchRoles).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingDelete.resolve();
      await pending;
    });

    expect(fetchRoles).toHaveBeenCalledTimes(2);
    expect(messages.success).toHaveBeenCalledWith(i18n.t("roleDeleted"));
  });

  it("aborts its list request and ignores a late rejected read after unmount", async () => {
    const pending = deferred<ManagedRole[]>();
    vi.mocked(fetchRoles).mockReturnValue(pending.promise);
    const { unmount } = renderPage();
    const signal = vi.mocked(fetchRoles).mock.calls[0][0]!;
    unmount();

    await act(async () => {
      pending.reject(new Error("Synthetic obsolete response"));
    });

    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("shows an assigned-role rejection and leaves the existing roles visible", async () => {
    user.permissions.push("roles.write", "users.read");
    vi.mocked(deleteRole).mockRejectedValue(
      new AdminApiError("Synthetic role assigned", 409, {
        code: "ROLE_IN_USE",
      }),
    );
    renderPage();
    await screen.findByText("Operators");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("delete") }));
    const confirmation = modal.confirm.mock.calls[0][0] as {
      onOk: () => Promise<void>;
    };

    await act(async () => confirmation.onOk());

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Synthetic role assigned"),
    );
    expect(fetchRoles).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Operators")).toBeDefined();
  });

  it("continues with explicit confirmation after the recent-sign-in flow", async () => {
    user.permissions.push("roles.write", "users.read");
    const expired = new AdminApiError("Sign in again", 403, {
      code: "REAUTH_REQUIRED",
    });
    vi.mocked(deleteRole).mockRejectedValueOnce(expired);
    handleAccessError.mockReturnValueOnce(true);
    renderPage();
    await screen.findByText("Operators");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("delete") }));
    const confirmation = modal.confirm.mock.calls[0][0] as {
      onOk: () => Promise<void>;
    };

    await act(async () => confirmation.onOk());

    expect(handleAccessError).toHaveBeenCalledWith(expired);
    expect(deleteRole).toHaveBeenCalledOnce();
    expect(messages.error).not.toHaveBeenCalled();
    expect(screen.getByText("Operators")).toBeVisible();
  });

  it("does not offer mutations for a role outside the operator's grants", async () => {
    user.permissions.push("roles.write");
    renderPage();
    await screen.findByText("Operators");

    expect(screen.queryByRole("button", { name: i18n.t("update") })).toBeNull();
    expect(screen.queryByRole("button", { name: i18n.t("delete") })).toBeNull();
    expect(screen.queryByRole("button", { name: i18n.t("order") })).toBeNull();
    expect(
      screen.getByRole("button", { name: i18n.t("create") }),
    ).toBeEnabled();
  });

  it("displays the complete list without a description column", async () => {
    vi.mocked(fetchRoles).mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        ...role,
        id: `role-${index + 1}`,
        name: `Role ${index + 1}`,
      })),
    );
    renderPage("/roles?page=2&name=team");

    expect(await screen.findByText("Role 25")).toBeVisible();
    expect(screen.getByText("Role 1")).toBeVisible();
    expect(
      screen.queryByRole("columnheader", { name: i18n.t("description") }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(fetchRoles).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
  });
});
