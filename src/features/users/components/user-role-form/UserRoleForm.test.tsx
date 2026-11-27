import { act, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import { fetchUser, updateUserRoles } from "../../api";
import type { LoadUserRoles, ManagedUser } from "../../types";
import { UserRoleForm } from "./UserRoleForm";

const { loadRoles, messages, onFinish } = vi.hoisted(() => ({
  loadRoles: vi.fn<LoadUserRoles>(),
  messages: { error: vi.fn(), success: vi.fn() },
  onFinish: vi.fn(),
}));
vi.mock("../../api", () => ({ fetchUser: vi.fn(), updateUserRoles: vi.fn() }));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));

const assigned = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Assigned role",
};
const reader = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Reader",
  permissions: ["users.read"],
};
const editor = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Editor",
  permissions: ["users.write"],
};
const elevated = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Elevated",
  permissions: ["settings.write"],
};
const record: ManagedUser = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Ada",
  mobile: "9121234567",
  isActive: true,
  roles: [assigned],
};
const grants = ["users.read", "users.write", "roles.read"];

const RoutedRoles = () => {
  const goBack = useGoBack();
  return (
    <UserRoleForm
      id={record.id}
      loadRoles={loadRoles}
      onClose={goBack}
      onFinish={() => {
        onFinish();
        goBack();
      }}
    />
  );
};

const renderForm = (permissions = grants, hash = "#roles") =>
  render(
    <MemoryRouter initialEntries={["/users" + hash]}>
      <Routes>
        <Route
          element={
            <Outlet context={{ currentUser: { id: "actor", permissions } }} />
          }
        >
          <Route path="/users" element={<RoutedRoles />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const submit = () => screen.getByRole("button", { name: i18n.t("submit") });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchUser).mockResolvedValue(record);
  vi.mocked(updateUserRoles).mockResolvedValue(record);
  loadRoles.mockResolvedValue([reader, editor, elevated]);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

it("lists roles as checkboxes and keeps assigned and newly selected roles", async () => {
  const { user } = renderForm();
  expect(
    await screen.findByRole("checkbox", { name: assigned.name }),
  ).toBeChecked();
  expect(
    await screen.findByRole("checkbox", { name: elevated.name }),
  ).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: reader.name }));
  await user.click(screen.getByRole("checkbox", { name: editor.name }));

  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(loadRoles).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
  expect(updateUserRoles).not.toHaveBeenCalled();
  for (const role of [assigned, reader, editor])
    expect(screen.getByRole("checkbox", { name: role.name })).toBeChecked();

  await user.click(submit());
  await waitFor(() =>
    expect(updateUserRoles).toHaveBeenCalledExactlyOnceWith(
      record.id,
      { roleIds: [assigned.id, reader.id, editor.id] },
      expect.any(AbortSignal),
    ),
  );
});

it("keeps selected roles after a controlled rejection for an explicit retry", async () => {
  vi.mocked(updateUserRoles).mockRejectedValueOnce(
    new Error("Synthetic conflict"),
  );
  const { user } = renderForm();
  await user.click(await screen.findByRole("checkbox", { name: reader.name }));
  await user.click(submit());

  await waitFor(() =>
    expect(messages.error).toHaveBeenCalledWith("Synthetic conflict"),
  );
  expect(screen.getByRole("checkbox", { name: reader.name })).toBeChecked();
  expect(onFinish).not.toHaveBeenCalled();
  await user.click(submit());

  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  expect(updateUserRoles).toHaveBeenCalledTimes(2);
});

it("requires both the user mutation grant and permission to read roles even on a direct hash", async () => {
  renderForm(["users.read", "users.write"]);
  await act(async () => undefined);
  expect(fetchUser).not.toHaveBeenCalled();
  expect(loadRoles).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("ignores sibling drawer hashes", async () => {
  renderForm(grants, "#update");
  await act(async () => undefined);
  expect(fetchUser).not.toHaveBeenCalled();
});

it("keeps the role drawer open and retries a failed user detail read", async () => {
  const pending = deferred<ManagedUser>();
  vi.mocked(fetchUser).mockReturnValueOnce(pending.promise);
  const { user } = renderForm();
  const drawer = await screen.findByRole("dialog", { name: i18n.t("roles") });
  expect(screen.queryByRole("button", { name: i18n.t("retry") })).toBeNull();
  expect(submit()).toBeDisabled();

  await act(async () => pending.reject(new Error("Synthetic detail failure")));

  expect(drawer).toBeVisible();
  expect(await screen.findByText(i18n.t("unexpectedError"))).toBeVisible();
  expect(messages.error).not.toHaveBeenCalled();
  expect(submit()).toBeDisabled();
  expect(loadRoles).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: i18n.t("retry") }));

  expect(
    await screen.findByRole("checkbox", { name: assigned.name }),
  ).toBeChecked();
  expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();
  expect(submit()).toBeEnabled();
  expect(fetchUser).toHaveBeenCalledTimes(2);
  expect(fetchUser).toHaveBeenLastCalledWith(
    record.id,
    expect.any(AbortSignal),
  );
  expect(updateUserRoles).not.toHaveBeenCalled();
});

it("cancels an abandoned detail fetch and ignores a late error", async () => {
  const pending = deferred<ManagedUser>();
  vi.mocked(fetchUser).mockReturnValueOnce(pending.promise);
  const { unmount } = renderForm();
  const signal = vi.mocked(fetchUser).mock.calls[0][1];
  unmount();

  await act(async () => pending.reject(new Error("Obsolete lookup")));
  expect(signal?.aborted).toBe(true);
  expect(messages.error).not.toHaveBeenCalled();
  expect(loadRoles).not.toHaveBeenCalled();
});
