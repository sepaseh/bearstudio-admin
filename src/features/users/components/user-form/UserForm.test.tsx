import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { AdminApiError } from "@/shared/api";
import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import {
  createUser,
  fetchUser,
  updateUser,
  updateUserPassword,
} from "../../api";
import type { ManagedUser } from "../../types";
import { UserForm } from "./UserForm";

const { handleAccessError, messages, onFinish } = vi.hoisted(() => ({
  handleAccessError: vi.fn(),
  messages: { error: vi.fn(), success: vi.fn() },
  onFinish: vi.fn(),
}));
vi.mock("../../api", () => ({
  createUser: vi.fn(),
  fetchUser: vi.fn(),
  updateUser: vi.fn(),
  updateUserPassword: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));

const user: ManagedUser = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ada Lovelace",
  mobile: "9121234567",
  roles: [{ id: "22222222-2222-4222-8222-222222222222", name: "Reader" }],
  isActive: true,
};
const actorId = "33333333-3333-4333-8333-333333333333";

const RoutedUserForm = ({ id }: { id?: string }) => {
  const goBack = useGoBack();
  return (
    <UserForm
      id={id}
      onClose={goBack}
      onFinish={() => {
        onFinish();
        goBack();
      }}
    />
  );
};

const renderForm = (
  hash = "#create",
  id?: string,
  permissions = ["users.read", "users.write", "roles.read"],
  currentId = actorId,
) =>
  render(
    <MemoryRouter initialEntries={["/users" + hash]}>
      <Link to="/users">Leave user form</Link>
      <Link to="/users#update">Reopen user form</Link>
      <Routes>
        <Route
          element={
            <Outlet
              context={{
                currentUser: { id: currentId, permissions },
                handleAccessError,
              }}
            />
          }
        >
          <Route path="/users" element={<RoutedUserForm id={id} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const enter = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillPassword = (password: string, label: string = i18n.t("password")) => {
  enter(label, password);
  enter(i18n.t("confirmPassword"), password);
};

const submit = () => screen.getByRole("button", { name: i18n.t("submit") });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchUser).mockResolvedValue(user);
  vi.mocked(createUser).mockResolvedValue(user);
  vi.mocked(updateUser).mockResolvedValue(user);
  vi.mocked(updateUserPassword).mockResolvedValue(undefined);
  await i18n.changeLanguage("en");
});

it("creates a user without roles, with normalized digits and the exact entered password", async () => {
  const view = renderForm();
  await screen.findByRole("textbox", { name: i18n.t("name") });
  expect(screen.queryByRole("group", { name: i18n.t("roles") })).toBeNull();
  enter(i18n.t("name"), "  Ada Lovelace  ");
  enter(i18n.t("mobile"), " ۹۱۲١٢٣٤٥٦٧ ");
  fillPassword(" Synthetic123! ");
  await view.user.click(submit());

  await waitFor(() =>
    expect(createUser).toHaveBeenCalledExactlyOnceWith(
      {
        name: user.name,
        mobile: user.mobile,
        password: " Synthetic123! ",
      },
      expect.any(AbortSignal),
    ),
  );
  expect(onFinish).toHaveBeenCalledOnce();
  expect(messages.success).toHaveBeenCalledWith(i18n.t("userCreated"));
});

it("requires the canonical mobile and matching password confirmation", async () => {
  const view = renderForm();
  await screen.findByRole("textbox", { name: i18n.t("name") });
  enter(i18n.t("name"), user.name);
  enter(i18n.t("mobile"), "09121234567");
  enter(i18n.t("password"), "Synthetic123!");
  enter(i18n.t("confirmPassword"), "Wrong123456!");
  await view.user.click(submit());

  await waitFor(() => {
    expect(screen.getByLabelText(i18n.t("mobile"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(i18n.t("confirmPassword"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
  expect(createUser).not.toHaveBeenCalled();
});

it.each([
  { hash: "#create", label: "password", password: "longbutlowercase123" },
  {
    hash: "#password",
    label: "newPassword",
    password: "Aa1!" + "😀".repeat(63),
  },
] as const)(
  "shows the password rules before sending $hash",
  async ({ hash, label, password }) => {
    const view = renderForm(hash, hash === "#password" ? user.id : undefined);
    await screen.findByLabelText(i18n.t(label));
    if (hash === "#create") {
      enter(i18n.t("name"), user.name);
      enter(i18n.t("mobile"), user.mobile);
    }
    await waitFor(() => expect(submit()).toBeEnabled());
    fillPassword(password, i18n.t(label));
    await view.user.click(submit());
    await waitFor(() =>
      expect(screen.getByText(i18n.t("passwordRequirements"))).toBeVisible(),
    );
    expect(createUser).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  },
);

it("edits changed name and active state, keeping the canonical mobile immutable", async () => {
  const view = renderForm("#update", user.id);
  await screen.findByDisplayValue(user.name);
  expect(screen.getByLabelText(i18n.t("mobile"))).toHaveAttribute("readonly");
  expect(screen.queryByRole("group", { name: i18n.t("roles") })).toBeNull();
  enter(i18n.t("name"), "Ada Byron");
  await view.user.click(screen.getByRole("switch", { name: i18n.t("status") }));
  await view.user.click(submit());

  await waitFor(() =>
    expect(updateUser).toHaveBeenCalledExactlyOnceWith(
      user.id,
      { name: "Ada Byron", isActive: false },
      expect.any(AbortSignal),
    ),
  );
  expect(updateUserPassword).not.toHaveBeenCalled();
});

it.each([
  { hash: "#update", title: "update", field: "name" },
  { hash: "#password", title: "changePassword", field: "newPassword" },
] as const)(
  "keeps $hash open and retries a failed user read",
  async ({ hash, title, field }) => {
    vi.mocked(fetchUser).mockRejectedValueOnce(
      new Error("Synthetic read error"),
    );
    const view = renderForm(hash, user.id);
    const drawer = within(
      await screen.findByRole("dialog", { name: i18n.t(title) }),
    );
    const retry = await drawer.findByRole("button", { name: i18n.t("retry") });

    expect(submit()).toBeDisabled();
    expect(messages.error).not.toHaveBeenCalled();
    await view.user.click(retry);

    await waitFor(() => expect(submit()).toBeEnabled());
    expect(drawer.getByLabelText(i18n.t(field))).toBeVisible();
    expect(fetchUser).toHaveBeenNthCalledWith(
      2,
      user.id,
      expect.any(AbortSignal),
    );
  },
);

it("cannot deactivate the current operator through their own edit drawer", async () => {
  const view = renderForm(
    "#update",
    user.id,
    ["users.read", "users.write"],
    user.id,
  );
  await screen.findByDisplayValue(user.name);
  expect(screen.getByRole("switch", { name: i18n.t("status") })).toBeDisabled();
  enter(i18n.t("name"), "Ada Byron");
  await view.user.click(submit());

  await waitFor(() =>
    expect(updateUser).toHaveBeenCalledExactlyOnceWith(
      user.id,
      { name: "Ada Byron" },
      expect.any(AbortSignal),
    ),
  );
});

it("waits for fresh details when reopening the same user's edit form", async () => {
  const pending = deferred<ManagedUser>();
  vi.mocked(fetchUser)
    .mockResolvedValueOnce(user)
    .mockReturnValueOnce(pending.promise);
  renderForm("#update", user.id);
  await screen.findByDisplayValue(user.name);

  fireEvent.click(screen.getByText("Reopen user form"));
  await waitFor(() => expect(fetchUser).toHaveBeenCalledTimes(2));
  expect(submit()).toBeDisabled();
  expect(screen.queryByRole("button", { name: i18n.t("retry") })).toBeNull();

  await act(async () => pending.resolve({ ...user, name: "Ada Byron" }));
  expect(await screen.findByDisplayValue("Ada Byron")).toBeVisible();
  expect(submit()).toBeEnabled();
});

it("keeps password input after a recent-sign-in requirement and only submits again explicitly", async () => {
  const recent = new AdminApiError("Sign in again", 403, {
    code: "REAUTH_REQUIRED",
  });
  vi.mocked(updateUserPassword).mockRejectedValueOnce(recent);
  handleAccessError.mockReturnValueOnce(true);
  const view = renderForm("#password", user.id);
  const drawer = within(
    await screen.findByRole("dialog", { name: i18n.t("changePassword") }),
  );
  await drawer.findByText(user.name);
  const password = " Synthetic234! ";
  fillPassword(password, i18n.t("newPassword"));
  await view.user.click(submit());

  await waitFor(() =>
    expect(handleAccessError).toHaveBeenCalledExactlyOnceWith(recent),
  );
  expect(updateUserPassword).toHaveBeenCalledOnce();
  expect(drawer.getByLabelText(i18n.t("newPassword"))).toHaveValue(password);
  expect(messages.error).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();

  await view.user.click(submit());
  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  expect(updateUserPassword).toHaveBeenNthCalledWith(
    2,
    user.id,
    { newPassword: password },
    expect.any(AbortSignal),
  );
});

it("ignores a late user save after leaving the form", async () => {
  const pending = deferred<ManagedUser>();
  vi.mocked(createUser).mockReturnValueOnce(pending.promise);
  const view = renderForm();
  await screen.findByRole("textbox", { name: i18n.t("name") });
  enter(i18n.t("name"), user.name);
  enter(i18n.t("mobile"), user.mobile);
  fillPassword("Synthetic123!");
  await view.user.click(submit());
  await waitFor(() => expect(createUser).toHaveBeenCalledOnce());
  const signal = vi.mocked(createUser).mock.calls[0][1];

  fireEvent.click(screen.getByText("Leave user form"));
  expect(signal?.aborted).toBe(true);
  await act(async () => pending.resolve(user));

  expect(onFinish).not.toHaveBeenCalled();
  expect(messages.success).not.toHaveBeenCalled();
});
