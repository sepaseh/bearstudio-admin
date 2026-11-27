// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type * as AntdModule from "antd";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminApiError } from "@/shared/api";
import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { createRole, fetchPermissions, fetchRole, updateRole } from "../../api";
import type { ManagedRole, PermissionDefinition } from "../../types";
import { RoleForm } from "./RoleForm";

const { drawerOpenChange, handleAccessError, messages, onFinish } = vi.hoisted(
  () => ({
    drawerOpenChange: vi.fn(),
    handleAccessError: vi.fn(),
    messages: { error: vi.fn(), success: vi.fn() },
    onFinish: vi.fn(),
  }),
);
vi.mock("../../api", () => ({
  createRole: vi.fn(),
  fetchPermissions: vi.fn(),
  fetchRole: vi.fn(),
  updateRole: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));
vi.mock("antd", async (importOriginal) => {
  const antd = await importOriginal<typeof AntdModule>();
  const { Drawer } = antd;

  return {
    ...antd,
    Drawer: (props: AntdModule.DrawerProps) => (
      <Drawer
        {...props}
        afterOpenChange={(open) => {
          props.afterOpenChange?.(open);
          drawerOpenChange(open);
        }}
      />
    ),
  };
});

const currentUser = {
  permissions: ["roles.read", "roles.write", "users.read", "users.write"],
};
const permissions: PermissionDefinition[] = [
  { group: "User management", id: "users.read", name: "Read users" },
  { group: "User management", id: "users.write", name: "Update users" },
  { group: "Media", id: "media.write", name: "Manage media" },
];
const role: ManagedRole = {
  id: "role-1",
  name: "Operators",
  permissions: ["users.read"],
};
const FormNavigation = () => {
  const { hash } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate("/roles#other")}>
        Leave role form
      </button>
      <output aria-label="Role form hash">{hash}</output>
    </>
  );
};
const RoleFormFixture = ({ id }: { id?: string }) => {
  const onClose = useGoBack();
  const handleFormFinish = () => {
    onFinish();
    onClose();
  };
  return <RoleForm id={id} onClose={onClose} onFinish={handleFormFinish} />;
};
const renderForm = (entry = "/roles#create", id?: string, navigation = false) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      {navigation && <FormNavigation />}
      <Routes>
        <Route
          element={<Outlet context={{ currentUser, handleAccessError }} />}
        >
          <Route path="/roles" element={<RoleFormFixture id={id} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  currentUser.permissions = [
    "roles.read",
    "roles.write",
    "users.read",
    "users.write",
  ];
  vi.mocked(fetchPermissions).mockResolvedValue(permissions);
  vi.mocked(fetchRole).mockResolvedValue(role);
  vi.mocked(createRole).mockResolvedValue({
    ...role,
    id: "created-role",
    permissions: [],
  });
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("role drawer", () => {
  it("closes the named create dialog with its cancel action", async () => {
    renderForm();
    expect(
      await screen.findByRole("dialog", { name: i18n.t("create") }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("cancel") }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(createRole).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("selects a permission group and submits the owned permission names", async () => {
    renderForm();
    await screen.findByRole("checkbox", { name: "Read users" });
    const name = await screen.findByRole("textbox", { name: i18n.t("name") });
    expect(name).toHaveValue("");
    expect(
      screen.queryByRole("textbox", { name: i18n.t("description") }),
    ).not.toBeInTheDocument();
    fireEvent.change(name, { target: { value: "Operators" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "User management" }));
    expect(
      (screen.getByRole("checkbox", { name: "Read users" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Update users",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(screen.queryByRole("checkbox", { name: "Manage media" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(createRole).toHaveBeenCalledExactlyOnceWith(
      {
        name: "Operators",
        permissions: ["users.read", "users.write"],
      },
      expect.any(AbortSignal),
    );
    expect(updateRole).not.toHaveBeenCalled();
  });

  it("loads an edited role before submitting its changed name", async () => {
    renderForm("/roles#update", "role-1");
    const name = await screen.findByDisplayValue("Operators");
    fireEvent.change(name, { target: { value: "Reviewers" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() =>
      expect(updateRole).toHaveBeenCalledExactlyOnceWith(
        "role-1",
        {
          name: "Reviewers",
        },
        expect.any(AbortSignal),
      ),
    );
    expect(createRole).not.toHaveBeenCalled();
  });

  it("clears the saved permissions explicitly", async () => {
    renderForm("/roles#update", "role-1");
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Read users" }),
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() =>
      expect(updateRole).toHaveBeenCalledExactlyOnceWith(
        "role-1",
        { permissions: [] },
        expect.any(AbortSignal),
      ),
    );
  });

  it("keeps the draft and waits for explicit resubmission on recent-sign-in failure", async () => {
    const error = new AdminApiError("Sign in again", 403, {
      code: "REAUTH_REQUIRED",
    });
    vi.mocked(createRole).mockRejectedValueOnce(error);
    handleAccessError.mockReturnValueOnce(true);
    renderForm();
    await screen.findByRole("checkbox", { name: "Read users" });
    const name = screen.getByRole("textbox", { name: i18n.t("name") });
    fireEvent.change(name, { target: { value: "Keep this draft" } });
    const submit = screen.getByRole("button", { name: i18n.t("submit") });
    fireEvent.click(submit);

    await waitFor(() => expect(handleAccessError).toHaveBeenCalledWith(error));
    expect(name).toHaveValue("Keep this draft");
    expect(messages.error).not.toHaveBeenCalled();
    expect(createRole).toHaveBeenCalledOnce();
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.click(submit);
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  });

  it("shows role details and enables saving after they arrive in an already opened drawer", async () => {
    const pendingRole = deferred<ManagedRole>();
    vi.mocked(fetchRole).mockReturnValueOnce(pendingRole.promise);
    renderForm("/roles#update", "role-1");
    await waitFor(() => expect(drawerOpenChange).toHaveBeenCalledWith(true));
    expect(screen.queryByRole("textbox", { name: i18n.t("name") })).toBeNull();
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: i18n.t("submit"),
    });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(updateRole).not.toHaveBeenCalled();

    await act(async () => {
      pendingRole.resolve(role);
    });

    const name = screen.getByRole("textbox", { name: i18n.t("name") });
    expect(name).toHaveValue("Operators");
    expect(submit).toBeEnabled();
  });

  it("rejects unauthorized hashes without fetching role details", async () => {
    currentUser.permissions = ["roles.read"];
    renderForm("/roles#update", "role-1");
    await act(async () => undefined);

    expect(fetchRole).not.toHaveBeenCalled();
    expect(fetchPermissions).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits for the permission catalog before offering a retry on create", async () => {
    const pending = deferred<PermissionDefinition[]>();
    vi.mocked(fetchPermissions).mockReturnValueOnce(pending.promise);
    renderForm();

    expect(
      await screen.findByRole("dialog", { name: i18n.t("create") }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: i18n.t("retry") })).toBeNull();
    await act(async () =>
      pending.reject(new Error("Synthetic permission read failure")),
    );

    expect(await screen.findByText(i18n.t("unexpectedError"))).toBeVisible();
    expect(screen.queryByText("Synthetic permission read failure")).toBeNull();
    expect(
      screen.getByRole("button", { name: i18n.t("submit") }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("retry") }));
    expect(
      await screen.findByRole("checkbox", { name: "Read users" }),
    ).toBeEnabled();
    expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();
    expect(fetchPermissions).toHaveBeenCalledTimes(2);
    expect(fetchRole).not.toHaveBeenCalled();
  });

  it.each(["success", "error"])(
    "ignores a late save %s after leaving the form even when transport ignores abort",
    async (outcome) => {
      const pending = deferred<ManagedRole>();
      vi.mocked(createRole).mockReturnValue(pending.promise);
      renderForm("/roles#create", undefined, true);
      await screen.findByRole("checkbox", { name: "Read users" });
      fireEvent.change(
        await screen.findByRole("textbox", { name: i18n.t("name") }),
        {
          target: { value: "Operators" },
        },
      );
      fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));
      await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1));
      const signal = vi.mocked(createRole).mock.calls[0][1]!;

      fireEvent.click(screen.getByRole("button", { name: "Leave role form" }));
      expect(signal.aborted).toBe(true);
      await act(async () => {
        if (outcome === "success")
          pending.resolve({
            ...role,
            id: "created-role",
            permissions: [],
          });
        else pending.reject(new Error("Synthetic obsolete save"));
      });

      expect(messages.success).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Role form hash").textContent).toBe(
        "#other",
      );
    },
  );

  it("cancels a detail read when closing the drawer and ignores its late response", async () => {
    const pending = deferred<ManagedRole>();
    vi.mocked(fetchRole).mockReturnValue(pending.promise);
    const { unmount } = renderForm("/roles#update", "role-1");
    const signal = vi.mocked(fetchRole).mock.calls[0][1]!;
    unmount();

    await act(async () => {
      pending.resolve({ ...role, name: "Obsolete", permissions: [] });
    });

    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
