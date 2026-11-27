// @vitest-environment jsdom
import { act, fireEvent, waitFor } from "@testing-library/react";
import type * as ReactI18next from "react-i18next";
import { MemoryRouter, Outlet, Route, Routes, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as rolesApi from "@/features/roles/api";
import { RoleForm } from "@/features/roles/components/role-form/RoleForm";
import type { ManagedRole } from "@/features/roles/types";
import * as usersApi from "@/features/users/api";
import { UserForm } from "@/features/users/components/user-form/UserForm";
import { UserRoleForm } from "@/features/users/components/user-role-form/UserRoleForm";
import type { ManagedUser } from "@/features/users/types";
import { AdminApiError } from "@/shared/api";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

const mocks = vi.hoisted(() => ({
  currentUser: { id: "operator", permissions: [] as string[] },
  handleAccessError: vi.fn<(error: unknown) => boolean>(),
  messageAPI: { error: vi.fn(), success: vi.fn() },
  t: (key: string) => key,
}));

vi.mock("@/features/roles/api", () => ({
  createRole: vi.fn(),
  fetchPermissions: vi.fn(),
  fetchRole: vi.fn(),
  updateRole: vi.fn(),
}));

vi.mock("@/features/users/api", () => ({
  createUser: vi.fn(),
  fetchUser: vi.fn(),
  updateUser: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserRoles: vi.fn(),
}));

vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: mocks.messageAPI }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactI18next>()),
  useTranslation: () => ({ t: mocks.t }),
}));

const role: ManagedRole = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Synthetic readers",
  permissions: ["articles.read"],
};
const user: ManagedUser = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Synthetic operator",
  mobile: "9120000000",
  roles: [{ id: role.id, name: role.name }],
  isActive: true,
};
const createPassword = " Synthetic Fixture!41 ";
const loadRoles = vi.fn();

const Exit = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate("/")}>
      Leave drawer
    </button>
  );
};

const renderAtHash = (node: React.ReactNode, hash: string) =>
  render(
    <MemoryRouter initialEntries={["/" + hash]}>
      <Routes>
        <Route element={<Outlet context={mocks} />}>
          <Route
            path="/"
            element={
              <>
                <Exit />
                {node}
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "submit" }));

const completeCreate = async () => {
  await screen.findByRole("textbox", { name: "name" });
  fill("name", "  New operator  ");
  fill("mobile", " ۹۱۲۰۰۰۰۰۰۱ ");
  fill("password", createPassword);
  fill("confirmPassword", createPassword);
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUser.permissions = [
    "users.read",
    "users.write",
    "roles.read",
    "roles.write",
    "articles.read",
    "articles.write",
  ];
  vi.mocked(rolesApi.fetchPermissions).mockResolvedValue([
    { id: "articles.read", name: "View articles", group: "Articles" },
    { id: "articles.write", name: "Manage articles", group: "Articles" },
    { id: "content.read", name: "View content", group: "Content" },
    { id: "media.write", name: "Manage media", group: "Media" },
  ]);
  vi.mocked(rolesApi.fetchRole).mockResolvedValue(role);
  vi.mocked(rolesApi.createRole).mockResolvedValue(role);
  vi.mocked(rolesApi.updateRole).mockResolvedValue(role);
  vi.mocked(usersApi.fetchUser).mockResolvedValue(user);
  vi.mocked(usersApi.createUser).mockResolvedValue(user);
  vi.mocked(usersApi.updateUser).mockResolvedValue(user);
  vi.mocked(usersApi.updateUserPassword).mockResolvedValue(undefined);
  vi.mocked(usersApi.updateUserRoles).mockResolvedValue(user);
  loadRoles.mockResolvedValue([role]);
});

describe("access forms with the Bear Studio contract", () => {
  it("creates a user without role selection even when the writer can read roles", async () => {
    const onFinish = vi.fn();
    renderAtHash(<UserForm onClose={vi.fn()} onFinish={onFinish} />, "#create");

    await completeCreate();
    expect(screen.queryByRole("group", { name: "roles" })).toBeNull();
    submit();

    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(usersApi.createUser).toHaveBeenCalledWith(
      {
        name: "New operator",
        mobile: "9120000001",
        password: createPassword,
      },
      expect.any(AbortSignal),
    );
    expect(loadRoles).not.toHaveBeenCalled();
  });

  it("retains the submitted draft on REAUTH_REQUIRED and does not replay it", async () => {
    const error = new AdminApiError("Sign in again", 403, {
      code: "REAUTH_REQUIRED",
    });
    vi.mocked(usersApi.createUser).mockRejectedValueOnce(error);
    mocks.handleAccessError.mockReturnValueOnce(true);
    const onFinish = vi.fn();
    renderAtHash(<UserForm onClose={vi.fn()} onFinish={onFinish} />, "#create");

    await completeCreate();
    submit();

    await waitFor(() =>
      expect(mocks.handleAccessError).toHaveBeenCalledWith(error),
    );
    expect(screen.getByLabelText("name")).toHaveValue("  New operator  ");
    expect(screen.getByLabelText("password")).toHaveValue(createPassword);
    expect(usersApi.createUser).toHaveBeenCalledOnce();
    expect(onFinish).not.toHaveBeenCalled();

    submit();
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(usersApi.createUser).toHaveBeenCalledTimes(2);
  });

  it("cancels an obsolete submission and ignores a late completion", async () => {
    const response = deferred<ManagedUser>();
    vi.mocked(usersApi.createUser).mockReturnValueOnce(response.promise);
    const onFinish = vi.fn();
    renderAtHash(<UserForm onClose={vi.fn()} onFinish={onFinish} />, "#create");
    await completeCreate();
    submit();
    await waitFor(() => expect(usersApi.createUser).toHaveBeenCalledOnce());

    const signal = vi.mocked(usersApi.createUser).mock.calls[0][1]!;
    fireEvent.click(
      screen.getByRole("button", { name: "Leave drawer", hidden: true }),
    );
    await waitFor(() => expect(signal.aborted).toBe(true));
    await act(async () => response.resolve(user));

    expect(onFinish).not.toHaveBeenCalled();
    expect(mocks.messageAPI.success).not.toHaveBeenCalled();
  });

  it("patches the edited name without sending mobile, role IDs or activation", async () => {
    renderAtHash(
      <UserForm id={user.id} onClose={vi.fn()} onFinish={vi.fn()} />,
      "#update",
    );
    await screen.findByDisplayValue(user.name);
    expect(screen.getByLabelText("mobile")).toHaveAttribute("readonly");
    fill("name", "Updated operator");
    submit();

    await waitFor(() =>
      expect(usersApi.updateUser).toHaveBeenCalledWith(
        user.id,
        { name: "Updated operator" },
        expect.any(AbortSignal),
      ),
    );
  });

  it("sets only the confirmed new password on its separate action", async () => {
    renderAtHash(
      <UserForm id={user.id} onClose={vi.fn()} onFinish={vi.fn()} />,
      "#password",
    );
    await screen.findByLabelText("newPassword");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "submit" })).toBeEnabled(),
    );
    fill("newPassword", createPassword);
    fill("confirmPassword", createPassword);
    submit();

    await waitFor(() =>
      expect(usersApi.updateUserPassword).toHaveBeenCalledWith(
        user.id,
        { newPassword: createPassword },
        expect.any(AbortSignal),
      ),
    );
    expect(usersApi.updateUser).not.toHaveBeenCalled();
  });

  it("loads live role permissions and omits grants outside the operator's scope", async () => {
    const { user } = renderAtHash(
      <RoleForm onClose={vi.fn()} onFinish={vi.fn()} />,
      "#create",
    );
    const read = await screen.findByRole("checkbox", { name: "View articles" });
    const write = screen.getByRole("checkbox", { name: "Manage articles" });
    expect(
      screen.queryByRole("checkbox", { name: "View content" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Manage media" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(read).toBeEnabled());
    await user.click(read);
    await user.click(write);
    expect(read).toBeChecked();
    expect(write).toBeChecked();
    fill("name", "New role");
    submit();

    await waitFor(() =>
      expect(rolesApi.createRole).toHaveBeenCalledWith(
        {
          name: "New role",
          permissions: ["articles.read", "articles.write"],
        },
        expect.any(AbortSignal),
      ),
    );
  });

  it("submits membership by GUID and can remove the final role from a user", async () => {
    const { user: operator } = renderAtHash(
      <UserRoleForm
        id={user.id}
        loadRoles={loadRoles}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
      "#roles",
    );
    const checkbox = await screen.findByRole("checkbox", { name: role.name });
    expect(checkbox).toBeChecked();
    await waitFor(() => expect(checkbox).toBeEnabled());
    await operator.click(checkbox);
    submit();

    await waitFor(() =>
      expect(usersApi.updateUserRoles).toHaveBeenCalledWith(
        user.id,
        { roleIds: [] },
        expect.any(AbortSignal),
      ),
    );
  });
});
